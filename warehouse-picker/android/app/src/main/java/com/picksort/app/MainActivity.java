package com.picksort.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Pick & Sort: shows the bundled web page (assets/www/index.html) full screen.
 * Everything runs on the phone. The app has no internet permission.
 */
public class MainActivity extends Activity {
    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int PICK_FILE = 1;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        // Serve the bundled files from a fixed private address, so the page's storage stays put.
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }
        });

        // "Choose file" button: open the phone's file picker.
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*"); // CSV and Excel files come with many different types; show everything
                try {
                    startActivityForResult(Intent.createChooser(pick, "Choose a file"), PICK_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.loadUrl(START_URL);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_FILE && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[]{data.getData()};
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /** Phone back button: let the page close the step screen or settings first. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(window.appBack && window.appBack()) ? 'y' : 'n'", result -> {
            if (!"\"y\"".equals(result)) MainActivity.super.onBackPressed();
        });
    }

    /** What the page can ask the phone to do (window.AndroidApp in JavaScript). */
    private class Bridge {
        private File settingsFile() { return new File(getFilesDir(), "settings.json"); }

        /** The saved shelf setup, or "" if none yet. */
        @JavascriptInterface
        public String readSettings() {
            File f = settingsFile();
            if (!f.exists()) return "";
            try (FileInputStream in = new FileInputStream(f)) {
                byte[] buf = new byte[(int) f.length()];
                int off = 0, n;
                while (off < buf.length && (n = in.read(buf, off, buf.length - off)) > 0) off += n;
                return new String(buf, 0, off, StandardCharsets.UTF_8);
            } catch (IOException e) {
                return "";
            }
        }

        /** Save the shelf setup. Written to a temporary file first so a crash can't leave half a file. */
        @JavascriptInterface
        public void writeSettings(String json) {
            File tmp = new File(getFilesDir(), "settings.json.tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(json.getBytes(StandardCharsets.UTF_8));
                out.getFD().sync();
            } catch (IOException e) {
                return;
            }
            if (!tmp.renameTo(settingsFile())) {
                settingsFile().delete();
                tmp.renameTo(settingsFile());
            }
        }

        /** Save a file the page made (a PDF, template or settings file), then open or share it. */
        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            final byte[] data = Base64.decode(base64, Base64.DEFAULT);
            final String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
            boolean inDownloads = false;

            // Keep a copy in Downloads/Pick and Sort (Android 10 and newer; no permission needed).
            if (Build.VERSION.SDK_INT >= 29) {
                try {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Pick and Sort");
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (u != null) {
                        try (OutputStream out = getContentResolver().openOutputStream(u)) {
                            if (out != null) { out.write(data); inDownloads = true; }
                        }
                    }
                } catch (Exception ignored) { }
            }

            // A private copy to hand to a PDF viewer or the share menu.
            final File dir = new File(getCacheDir(), "exports");
            dir.mkdirs();
            final File f = new File(dir, safe);
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(data);
            } catch (IOException e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Couldn't save " + safe, Toast.LENGTH_LONG).show());
                return;
            }
            final boolean saved = inDownloads;
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, saved ? "Saved to Downloads › Pick and Sort" : "File ready", Toast.LENGTH_SHORT).show();
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", f);
                boolean pdf = "application/pdf".equals(mime);
                Intent i = pdf
                        ? new Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime)
                        : new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivity(Intent.createChooser(i, pdf ? "Open the PDF with" : "Send the file to"));
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "No app found to open it. It's in your Downloads.", Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}

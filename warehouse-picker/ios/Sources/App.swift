import UIKit
import WebKit
import QuickLook

/// Pick & Sort for iPhone and iPad: shows the bundled web page (Resources/www/index.html)
/// full screen. Everything runs on the device; nothing is sent anywhere.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = WebViewController()
        window?.makeKeyAndVisible()
        return true
    }
}

final class WebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, QLPreviewControllerDataSource {
    private var webView: WKWebView!
    private var previewURL: URL?
    private let selfTest = ProcessInfo.processInfo.arguments.contains("-selftest")

    /// The saved shelf setup lives in Application Support/settings.json.
    private var settingsURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("settings.json")
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let contentController = WKUserContentController()
        contentController.add(WeakHandler(self), name: "app")
        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never // the page handles the notch itself
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.12, green: 0.37, blue: 0.55, alpha: 1)
        view = webView
        installBridge(savedSettings: (try? String(contentsOf: settingsURL, encoding: .utf8)) ?? "")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let www = Bundle.main.url(forResource: "www", withExtension: nil) else { return }
        webView.loadFileURL(www.appendingPathComponent("index.html"), allowingReadAccessTo: www)
    }

    /// window.NativeApp for the page: the same calls the Android app offers.
    private func installBridge(savedSettings: String) {
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        let js = """
        (function () {
          var saved = \(jsonString(savedSettings));
          window.NativeApp = {
            readSettings: function () { return saved; },
            writeSettings: function (json) { saved = json; window.webkit.messageHandlers.app.postMessage({ type: 'settings', json: json }); },
            saveFile: function (name, mime, b64) { window.webkit.messageHandlers.app.postMessage({ type: 'file', name: name, mime: mime, data: b64 }); }
          };
        })();
        """
        controller.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    private func jsonString(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: s, options: [.fragmentsAllowed]),
              let out = String(data: data, encoding: .utf8) else { return "\"\"" }
        return out
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        if type == "settings", let json = body["json"] as? String {
            try? json.data(using: .utf8)?.write(to: settingsURL, options: .atomic)
            installBridge(savedSettings: json) // so a reload of the page still sees the newest settings
            if selfTest { print("SELFTEST-SETTINGS saved \(json.count) chars") }
        } else if type == "file", let name = body["name"] as? String, let mime = body["mime"] as? String,
                  let b64 = body["data"] as? String, let data = Data(base64Encoded: b64) {
            saveFile(name: name, mime: mime, data: data)
        }
    }

    /// Keep the file in the app's folder (visible in the Files app), then show or share it.
    private func saveFile(name: String, mime: String, data: Data) {
        let safe = name.replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "_", options: .regularExpression)
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let url = docs.appendingPathComponent(safe)
        do { try data.write(to: url, options: .atomic) } catch { return }
        if selfTest { print("SELFTEST-FILE \(safe) \(data.count) bytes"); return }
        if mime == "application/pdf" {
            previewURL = url
            let preview = QLPreviewController() // has Share / Print / Save to Files built in
            preview.dataSource = self
            present(preview, animated: true)
        } else {
            let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            share.popoverPresentationController?.sourceView = view
            share.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            present(share, animated: true)
        }
    }

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int { previewURL == nil ? 0 : 1 }
    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        (previewURL ?? URL(fileURLWithPath: "/")) as NSURL
    }

    /// If iOS ever stops the page in the background, reload it instead of showing a blank screen.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    /// Automatic check used by the build server: load the example, make both PDFs, report back.
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard selfTest else { return }
        let js = """
        (function () {
          document.getElementById('exampleBtn').click();
          var r = { native: !!window.NativeApp, libs: !!(window.jspdf && window.XLSX),
                    orders: plan.orders.length, picks: plan.picks.length, unpack: plan.unpack.length };
          saveSettings(); pickPdf(); unpackPdf();
          return JSON.stringify(r);
        })()
        """
        webView.evaluateJavaScript(js) { result, error in
            if let error = error { print("SELFTEST FAIL \(error)"); return }
            let r = (result as? String) ?? ""
            print("SELFTEST RESULT \(r)")
            let ok = r.contains("\"native\":true") && r.contains("\"libs\":true") && r.contains("\"orders\":5") && r.contains("\"unpack\":13")
            print(ok ? "SELFTEST OK" : "SELFTEST FAIL unexpected result")
            self.selfTestPackingSlip()
        }
    }

    /// Reads a packing slip laid out like the real ones (A4, bin and quantity beside the
    /// second line of the name, "Product - Colour - Size") with Safari's engine on the phone.
    private func selfTestPackingSlip() {
        let js = """
        const doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Order #53796', 465, 60);
        doc.setFontSize(14); doc.text('MOONLIGHT', 50, 95);
        doc.setFontSize(10); doc.text('Items', 50, 320); doc.text('Bin', 394, 320); doc.text('Quantity', 475, 320);
        doc.setFont('helvetica', 'normal');
        const item = (y, lines, bin, qty) => { lines.forEach((t, i) => doc.text(t, 94, y + i * 15)); doc.text(bin, 392, y + 23); doc.text(qty, 494, y + 23); };
        item(346, ['Lil Legs Limited Capsule Toddler Sweatshirt', 'Set - Deep Red - 2T', 'LL2207-2T', '735380754426'], 'C87', '1');
        item(424, ['Bebe Organic Cuddle Horse Blanket - Faded', 'Blue', 'BO9019', '4741631147998'], 'A52', '2');
        item(502, ['Bib', 'BB100', '4741631100103'], 'B3', '1');
        doc.setFont('helvetica', 'bold'); doc.text('Total items: 4', 471, 590);
        const r = parseSlips(await pdfWords(doc.output('arraybuffer')));
        return JSON.stringify(r.orders.map(o => ({ order: o.order, total: o.total, unsure: !!o.unsure,
          items: o.items.map(i => [i.name, i.details, i.sku, i.barcode, i.bin, i.qty].join('|')) })));
        """
        webView.callAsyncJavaScript(js, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .failure(let error): print("SELFTEST PDF FAIL \(error)")
            case .success(let value):
                let r = (value as? String) ?? ""
                print("SELFTEST PDF RESULT \(r)")
                let want = [
                    "\"order\":\"53796\"", "\"total\":4", "\"unsure\":false",
                    "Lil Legs Limited Capsule Toddler Sweatshirt Set|Deep Red - 2T|LL2207-2T|735380754426|C87|1",
                    "Bebe Organic Cuddle Horse Blanket|Faded Blue|BO9019|4741631147998|A52|2",
                    "Bib||BB100|4741631100103|B3|1",
                ]
                print(want.allSatisfy { r.contains($0) } ? "SELFTEST PDF OK" : "SELFTEST PDF FAIL wrong reading")
            }
        }
    }
}

/// Avoids a retain cycle between the web view and its message handler.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}

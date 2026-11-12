#!/bin/sh
# Builds the installable website into web/dist (works offline once opened).
# Host web/dist anywhere that serves static files (GitHub Pages, Render, ...).
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/vendor
cp ../android/app/src/main/assets/www/vendor/jspdf.umd.min.js ../android/app/src/main/assets/www/vendor/xlsx.full.min.js dist/vendor/
cp manifest.webmanifest icon-192.png icon-512.png apple-touch-icon.png dist/
VERSION=$(cat ../index.html sw.js manifest.webmanifest | cksum | cut -d' ' -f1)
sed "s/__VERSION__/$VERSION/" sw.js > dist/sw.js
# Point at the bundled libraries, and add the "install to home screen" bits.
sed -e 's#https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js#vendor/jspdf.umd.min.js#' \
    -e 's#https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js#vendor/xlsx.full.min.js#' \
    ../index.html | awk '
  /<\/body>/ { print "<script>if (\"serviceWorker\" in navigator) navigator.serviceWorker.register(\"sw.js\"); if (navigator.storage && navigator.storage.persist) navigator.storage.persist();</script>" }
  { print }
  /<\/title>/ {
    print "<link rel=\"manifest\" href=\"manifest.webmanifest\">"
    print "<link rel=\"icon\" href=\"icon-192.png\">"
    print "<link rel=\"apple-touch-icon\" href=\"apple-touch-icon.png\">"
    print "<meta name=\"mobile-web-app-capable\" content=\"yes\">"
    print "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">"
    print "<meta name=\"apple-mobile-web-app-title\" content=\"Pick &amp; Sort\">"
    print "<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\">"
  }' > dist/index.html
if grep -q cdnjs dist/index.html; then echo "index.html still points at the internet" >&2; exit 1; fi
echo "Website built in $(pwd)/dist (version $VERSION)"

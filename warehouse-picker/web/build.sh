#!/bin/sh
# Builds the installable website into web/dist (works offline once opened).
# Host web/dist anywhere that serves static files (GitHub Pages, Render, ...).
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/vendor
cp ../android/app/src/main/assets/www/vendor/*.js dist/vendor/
cp manifest.webmanifest icon-192.png icon-512.png apple-touch-icon.png dist/
VERSION=$(cat ../index.html sw.js pwa.js manifest.webmanifest | cksum | cut -d' ' -f1)
sed "s/__VERSION__/$VERSION/" sw.js > dist/sw.js
# Point at the bundled libraries, and add the "install to home screen" bits.
sed -e 's#https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js#vendor/jspdf.umd.min.js#' \
    -e 's#https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js#vendor/xlsx.full.min.js#' \
    -e 's#https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/#vendor/#g' \
    -e 's#https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/#vendor/#g' \
    -e 's#https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/#vendor/#g' \
    ../index.html | awk '
  /<\/body>/ { while ((getline line < "pwa.js") > 0) body = body line "\n"; print "<script>\n" body "</script>" }
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
if grep -q "cdnjs\|jsdelivr" dist/index.html; then echo "index.html still points at the internet" >&2; exit 1; fi
echo "Website built in $(pwd)/dist (version $VERSION)"

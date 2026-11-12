#!/bin/sh
# Copy the page (../index.html) into the app, pointing it at the bundled libraries
# instead of the internet. Run before building.
set -e
cd "$(dirname "$0")"
mkdir -p Resources/www/vendor
sed -e 's#https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js#vendor/jspdf.umd.min.js#' \
    -e 's#https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js#vendor/xlsx.full.min.js#' \
    -e 's#https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/#vendor/#g' \
    ../index.html > Resources/www/index.html
cp ../android/app/src/main/assets/www/vendor/*.js Resources/www/vendor/
if grep -q cdnjs Resources/www/index.html; then echo "index.html still points at the internet" >&2; exit 1; fi
echo "Web files ready in Resources/www"

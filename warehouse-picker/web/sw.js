/* Keeps the whole app on the device so it opens and works with no internet.
   __VERSION__ changes with every new build; the phone then picks up the new
   version in the background and uses it the next time the app is opened. */
const CACHE = "pick-and-sort-__VERSION__";
const FILES = ["./", "index.html", "manifest.webmanifest", "vendor/jspdf.umd.min.js", "vendor/xlsx.full.min.js", "vendor/pdf.min.js", "vendor/pdf.worker.min.js", "vendor/qrcode.min.js",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("pick-and-sort-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return; // the linked-devices database always goes to the internet
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});

// Added to the hosted website only (see build.sh).
// Keeps the app on the phone for offline use, and picks up new versions:
// it checks whenever the app is opened or brought back to the screen.
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then(reg => {
    document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return; // first install, nothing to swap
    if (typeof current === "undefined" || !current) location.reload(); // nothing loaded yet: switch now
    else toast("A new version is ready. It opens next time you start the app.");
  });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

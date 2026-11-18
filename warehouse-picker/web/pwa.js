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
    // switch now (the list and ticks are kept), unless someone is in the middle of scanning or step by step
    const busy = () => (typeof scan !== "undefined" && scan.el) || !document.getElementById("stepper").classList.contains("hidden");
    const go = () => { try { if (typeof saveList === "function" && typeof current !== "undefined" && current) saveList(); } catch (e) {} location.reload(); };
    if (!busy()) return go();
    const bar = document.createElement("button");
    bar.className = "updatebar"; bar.type = "button"; bar.textContent = "New version ready: tap to update";
    bar.onclick = go; document.body.append(bar);
  });
  // check for a new version every 10 minutes while the app is open, too
  setInterval(() => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}), 600000);
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

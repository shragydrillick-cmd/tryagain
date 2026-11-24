// dailyGuard (used by the Shopify connection): our own count of the server's work each day, for each kind of request.
// Above a kind's limit that kind refuses until midnight (UTC), so a fault that repeats itself can't run up a bill;
// the other kinds carry on (looking up orders can't use up saving a change).
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
let db = null;
const { HttpsError } = require("firebase-functions/v2/https");
async function dailyGuard(kind, limit = 5000) {
  if (!db) { if (!getApps().length) initializeApp(); db = getFirestore(); }
  const ref = db.doc(`usage/${new Date().toISOString().slice(0, 10)}`);
  const n = await db.runTransaction(async tx => {
    const s = await tx.get(ref), d = s.exists ? s.data() : {}, mine = (d[kind] || 0) + 1;
    tx.set(ref, { calls: (d.calls || 0) + 1, [kind]: mine, at: Date.now() }, { merge: true });
    return mine;
  });
  if (n > limit) throw new HttpsError("resource-exhausted", `Daily limit reached for ${kind}: it stops until tomorrow so nothing runs away.`);
  return n;
}
module.exports = { dailyGuard };

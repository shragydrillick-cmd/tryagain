// dailyGuard (used by the Shopify connection): our own count of the server's work each day. Above the
// limit it refuses until midnight (UTC), so a fault that repeats itself can't run up a bill.
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
let db = null;
const { HttpsError } = require("firebase-functions/v2/https");
async function dailyGuard(kind, limit = 5000) {
  if (!db) { if (!getApps().length) initializeApp(); db = getFirestore(); }
  const ref = db.doc(`usage/${new Date().toISOString().slice(0, 10)}`);
  const n = await db.runTransaction(async tx => {
    const s = await tx.get(ref), calls = (s.exists ? s.data().calls || 0 : 0) + 1;
    tx.set(ref, { calls, [kind]: FieldValue.increment(1), at: Date.now() }, { merge: true });
    return calls;
  });
  if (n > limit) throw new HttpsError("resource-exhausted", "Daily limit reached: the server stops until tomorrow so nothing runs away.");
  return n;
}
module.exports = { dailyGuard };

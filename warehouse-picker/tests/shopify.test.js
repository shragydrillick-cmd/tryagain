// The Shopify connection (needs the Firebase emulator, see README). The real server code (firebase/functions/shopify.js)
// runs here against the emulator and a pretend Shopify: the admin connects the store from Settings → More (Shopify asks,
// says yes, comes back), the store's key is kept where no phone can read it, Packing's Find shows the store's open
// orders, Pack puts the "Packed ..." tag on the order in Shopify. Plus the safety checks: no sign-in, not the admin,
// something pretending to be Shopify, an old or made-up "state".
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"; process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = "pick-and-sort"; process.env.SHOPIFY_CLIENT_SECRET = "test-secret";
const FN = require("path").join(__dirname, "../firebase/functions/");
const express = require(FN + "node_modules/express"), crypto = require("crypto");
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8765/index.html", EMU = "http://127.0.0.1:9099", P = "pick-and-sort", SRV = "http://localhost:8766";
process.env.SHOPIFY_TEST_BASE = SRV + "/fake";
const { handle, signedByShopify, cleanShop, toPackOrder } = require(FN + "shopify.js");
let bad = 0; const ok = (l, c, x = "") => { if (!c) bad++; console.log(`${c ? "ok  " : "FAIL"} ${l}${x ? "  (" + x + ")" : ""}`); };
const sign = q => { const m = Object.keys(q).sort().map(k => `${k}=${q[k]}`).join("&"); return { ...q, hmac: crypto.createHmac("sha256", "test-secret").update(m).digest("hex") }; };

// the pretend Shopify: hands out a key for the right code, answers orders, records tags
const fake = { tags: [], codes: new Set(["good-code"]) };
const ORDERS = [
  { id: "gid://shopify/Order/5501", name: "#1001", createdAt: "2026-11-20T15:00:00Z", tags: [], customer: { displayName: "Rivka Klein" }, shippingAddress: { name: "Rivka Klein", address1: "1200 50th St", city: "Brooklyn", zip: "11219" },
    shippingLine: { title: "Local Delivery" }, lineItems: { nodes: [{ title: "Fleece blanket", variantTitle: "Blue", quantity: 2, currentQuantity: 2, unfulfilledQuantity: 2, sku: "FB-BLU", variant: { barcode: "5012345000015", sku: "FB-BLU" } }] } },
  { id: "gid://shopify/Order/5502", name: "#1002", createdAt: "2026-11-21T15:00:00Z", tags: ["vip"], customer: { displayName: "Sara Weiss" }, shippingAddress: { address1: "5 Maple Ave", city: "Monsey", zip: "10952" },
    shippingLine: { title: "UPS Ground" }, lineItems: { nodes: [{ title: "Notebook", variantTitle: "Default Title", quantity: 1, currentQuantity: 1, unfulfilledQuantity: 1, sku: "NB-A5", variant: { barcode: "5012345000039" } },
      { title: "Pen set", variantTitle: "", quantity: 1, currentQuantity: 0, unfulfilledQuantity: 0, sku: "PEN", variant: null }] } }];
const app = express();
app.use((req, res, next) => { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Headers", "Authorization, Content-Type"); next(); });
app.use(express.json());
app.post("/fake/:shop/admin/oauth/access_token", (req, res) => {
  if (req.body.client_secret !== "test-secret" || !fake.codes.has(req.body.code)) return res.status(400).json({ error: "invalid" });
  fake.codes.delete(req.body.code); res.json({ access_token: "shpat_" + req.params.shop, scope: "read_orders" });
});
app.post("/fake/:shop/admin/api/:v/graphql.json", (req, res) => {
  if (req.get("x-shopify-access-token") !== "shpat_" + req.params.shop) return res.status(401).end();
  if (/tagsAdd/.test(req.body.query)) { fake.tags.push(req.body.variables); return res.json({ data: { tagsAdd: { userErrors: [] } } }); }
  res.json({ data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: ORDERS } } });
});
app.all(/^\/shopify(\/.*)?$/, (req, res) => handle(req, res));
const server = app.listen(8766);

(async () => {
  // the small pieces first
  ok("Shopify's signature: right one passes, changed one fails", signedByShopify(sign({ shop: "a.myshopify.com", code: "x", timestamp: "1" })) && !signedByShopify({ ...sign({ shop: "a.myshopify.com", code: "x" }), code: "y" }) && !signedByShopify({ shop: "a.myshopify.com" }));
  ok("store address: name, full address, link; nothing else", cleanShop("Practice-Store") === "practice-store.myshopify.com" && cleanShop("https://x1.myshopify.com/admin") === "x1.myshopify.com" && cleanShop("evil.com") === "" && cleanShop("a.myshopify.com.evil.com") === "");
  const o2 = toPackOrder(ORDERS[1], "practice-store.myshopify.com");
  ok("a Shopify order becomes a pack order (UPS = shipping, fulfilled lines left out, no 'Default Title')", o2.number === "1002" && o2.delivery.type === "shipping" && o2.items.length === 1 && o2.items[0].details === "" && o2.items[0].barcode === "5012345000039" && /admin\.shopify\.com\/store\/practice-store\/orders\/5502/.test(o2.shopifyUrl));

  await fetch(`${EMU}/emulator/v1/projects/${P}/accounts`, { method: "DELETE" }); await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: "DELETE" });
  const b = await chromium.launch(); const errs = [];
  const open = async (c, n) => { const p = await c.newPage(); p.on("pageerror", e => errs.push(n + ": " + e.message));
    await p.addInitScript(srv => { try { if (!sessionStorage.getItem("x")) { if (!localStorage.getItem("keep")) localStorage.clear(); sessionStorage.setItem("x", "1"); } localStorage.setItem("keep", "1");
      ["pick-and-sort-emulator", "pick-and-sort-accounts-on", "pick-and-sort-test-features"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("pick-and-sort-shopify-base", srv + "/shopify"); } catch (e) {} }, SRV);
    await p.goto(BASE); return p; };
  const google = (p, sub, email) => p.evaluate(([sub, email]) => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }))), [sub, email]);
  const signIn = async (p, sub, email) => { await p.waitForFunction(() => document.getElementById("gate") && /Sign in/.test(document.getElementById("gate").innerText)); await google(p, sub, email); await p.waitForFunction(() => !document.getElementById("gate") && acct); };
  const ca = await b.newContext({ viewport: { width: 1200, height: 800 } }), cb = await b.newContext({ viewport: { width: 1200, height: 800 } });
  let a = await open(ca, "admin"); await signIn(a, "o1", "owner@test.com");
  await a.click("#navBtn"); await a.evaluate(() => go("admin")); await a.waitForSelector('input[aria-label="New company name"]');
  await a.fill('input[aria-label="New company name"]', "S & O"); await a.click('button:has-text("Add company")'); await a.waitForSelector('input[aria-label="Email to add"]');
  await a.fill('input[aria-label="Email to add"]', "w@test.com"); await a.click('button:text-is("Add")'); await a.waitForTimeout(600);
  // a worker (not admin) in the company
  const w = await open(cb, "worker"); await signIn(w, "w1", "w@test.com");
  await w.click("#navBtn"); await w.evaluate(() => go("more")); await w.waitForFunction(() => /admin connects it|Connect/.test(document.getElementById("settingsView").innerText), null, { timeout: 8000 }).catch(() => {});
  ok("worker: no Connect button, the admin connects it", !(await w.$('input[aria-label="Shopify store address"]')) && /admin connects it/.test(await w.innerText("#settingsView")), (await w.innerText("#settingsView")).slice(0, 600));
  const wtok = await w.evaluate(() => fb.auth.currentUser.getIdToken());
  const r403 = await fetch(SRV + "/shopify/start", { method: "POST", headers: { Authorization: "Bearer " + wtok, "Content-Type": "application/json" }, body: JSON.stringify({ shop: "practice-store" }) });
  ok("worker asking the server to connect: refused", r403.status === 403, r403.status + " " + await r403.text());
  ok("no sign-in: refused", (await fetch(SRV + "/shopify/orders")).status === 401);
  ok("orders before a store is connected: says so", /No Shopify store/.test((await (await fetch(SRV + "/shopify/orders", { headers: { Authorization: "Bearer " + wtok } })).json()).error));

  // the admin connects: Shopify asks, says yes, and comes back
  await a.evaluate(() => go("more")); await a.waitForFunction(() => shop.status && !shop.busy && document.querySelector('input[aria-label="Shopify store address"]'));
  let asked = null;
  await a.route("https://practice-store.myshopify.com/**", r => { asked = new URL(r.request().url()); const q = sign({ code: "good-code", shop: "practice-store.myshopify.com", state: asked.searchParams.get("state"), timestamp: String(Math.floor(Date.now() / 1000)) });
    r.fulfill({ status: 302, headers: { location: SRV + "/shopify/callback?" + new URLSearchParams(q) } }); });
  await a.fill('input[aria-label="Shopify store address"]', "practice-store"); await a.click('button:text-is("Connect")');
  await a.waitForURL(/shopify=connected|localhost:8765\/(\?|$)/, { timeout: 15000 }).catch(() => {});
  ok("Shopify was asked with our app, the right permissions and our callback", asked && asked.searchParams.get("client_id") === "55a9bba1b5e7545f3227a01633c9693e" && /write_orders/.test(asked.searchParams.get("scope")) && asked.searchParams.get("redirect_uri") === "https://pick-and-sort.web.app/shopify/callback", asked ? asked.href.slice(0, 120) : (await a.innerText("body").catch(() => "")).slice(-400));
  await a.waitForLoadState("load"); await a.waitForFunction(() => typeof acct !== "undefined" && acct, null, { timeout: 10000 }).catch(async () => console.log("at", a.url(), (await a.innerText("body").catch(() => "")).slice(0, 300)));
  await a.click("#navBtn").catch(() => {}); await a.evaluate(() => { if (view !== "settings") document.getElementById("navBtn").click(); go("more"); }); await a.waitForTimeout(2000);
  ok("back in Pick & Sort: Settings shows the connected store", /practice-store\.myshopify\.com[\s\S]*Connected/.test(await a.innerText("#settingsView")));
  const keyRead = await a.evaluate(async () => { try { const s = await fb.db.collection("shopifyTokens").doc(acct.company).get(); return "read " + JSON.stringify(s.data()); } catch (e) { return e.code; } });
  ok("the store's key can't be read from the app, not even by the owner", keyRead === "permission-denied", keyRead);
  // the same "state" again (or a made-up one) is refused, as is anything not signed by Shopify
  const replay = await fetch(SRV + "/shopify/callback?" + new URLSearchParams(sign({ code: "good-code", shop: "practice-store.myshopify.com", state: asked.searchParams.get("state"), timestamp: "1" })), { redirect: "manual" });
  const forged = await fetch(SRV + "/shopify/callback?" + new URLSearchParams({ code: "x", shop: "practice-store.myshopify.com", state: "abc", hmac: "00" }), { redirect: "manual" });
  ok("callback used twice, or not from Shopify: refused", replay.status === 400 && forged.status === 400);

  // Packing: Find shows the store's orders; Pack tags it in Shopify
  await a.click("#navBtn"); await a.click("#navBtn").catch(() => {}); await a.evaluate(() => { if (view === "settings") document.getElementById("navBtn").click(); });
  await a.evaluate(() => { shop.at = 0; openPacking(); }); await a.waitForTimeout(2500);
  ok("Packing: says the orders come from the Shopify store", /Shopify: practice-store · 2 open orders/.test(await a.innerText("#packPanel")), await a.$eval("#packPanel .shopline", x => x.innerText).catch(() => ""));
  await a.evaluate(() => openFind()); await a.waitForTimeout(500);
  const found = await a.innerText("#packFind").catch(() => "");
  ok("Find an order: the Shopify orders (not the practice ones)", /1001/.test(found) && /1002/.test(found) && !/70001/.test(found));
  await a.evaluate(async () => { startPack(findPackOrder("1001"), true); pk.o.items.forEach((it, i) => pk.got.set(i, it.qty)); drawPack(); await packAction("pack"); });
  await a.waitForTimeout(1500);
  ok("Pack: the Packed tag went on the order in Shopify", fake.tags.length === 1 && fake.tags[0].id === "gid://shopify/Order/5501" && /^Packed /.test(fake.tags[0].tags[0]), JSON.stringify(fake.tags));
  ok("…and the order shows as packed here", await a.evaluate(() => !!findPackOrder("1001").packedAt));
  // the worker's device sees the same store
  const ord = await (await fetch(SRV + "/shopify/orders", { headers: { Authorization: "Bearer " + wtok } })).json();
  ok("worker: gets the store's orders, with names and areas", ord.orders.length === 2 && ord.orders[0].customer === "Rivka Klein" && ord.orders[0].city === "Brooklyn");
  // Orders → From Shopify: filter by area, tick, add to the list; items without a bin go to "Please look"
  await a.evaluate(() => { try { closePack(); } catch (e) {} closeFind(); closePacking(); });
  ok("Orders: a From Shopify button", await a.isVisible("#shopifyAddBtn"));
  await a.click("#shopifyAddBtn"); await a.waitForFunction(() => shop.orders && !shop.busy && document.querySelectorAll("#addOrders .aorow").length === 2, null, { timeout: 8000 }).catch(() => {});
  await a.selectOption('#addOrders select[aria-label="Area"]', "Brooklyn");
  const rows = await a.$$eval("#addOrders .aorow", r => r.map(x => x.innerText.replace(/\s+/g, " ")));
  ok("filtered by area: only the Brooklyn order", rows.length === 1 && /#1001.*Rivka Klein.*Brooklyn.*2× Fleece blanket \(Blue\)/.test(rows[0]), rows.join(" // "));
  await a.selectOption('#addOrders select[aria-label="Area"]', ""); await a.selectOption('#addOrders select[aria-label="Sort"]', "oldest");
  ok("sorted oldest first", /#1001/.test(await a.$eval("#addOrders .aorow", x => x.innerText)));
  await a.check('#addOrders input[aria-label="Select all shown"]');
  ok("select all: the button says Add 2 orders", /Add 2 orders to pick/.test(await a.innerText("#addOrders .aobar")));
  await a.click("#addOrders .aobar button"); await a.waitForTimeout(800);
  await a.click('button:text-is("Replace")').catch(() => {}); await a.waitForTimeout(800);
  const look = await a.innerText("#review").catch(() => "");
  ok("added: both orders on the list, and Please look asks for the bins", await a.evaluate(() => plan && plan.orders.length === 2) && /Please look/.test(look) && /missing bin/.test(look), look.slice(0, 200));
  await a.click("#shopifyAddBtn"); await a.waitForTimeout(600);
  ok("opened again: orders already on the list aren't shown", (await a.$$("#addOrders .aorow")).length === 0);
  await a.evaluate(() => closeAddOrders());
  // disconnect
  await a.evaluate(() => { document.getElementById("navBtn").click(); go("more"); }); await a.waitForTimeout(800);
  await a.click('button:text-is("Disconnect")'); await a.waitForTimeout(300); await a.click('#settingsView button:has-text("Disconnect")').catch(() => {}); await a.waitForTimeout(1500);
  ok("Disconnect: the key is gone, Connect is back", !!(await a.$('input[aria-label="Shopify store address"]')) && /No Shopify store/.test((await (await fetch(SRV + "/shopify/orders", { headers: { Authorization: "Bearer " + wtok } })).json()).error));
  ok("no page errors", !errs.length, errs.join(" / "));
  console.log(bad ? `${bad} FAILED` : "all ok"); await b.close(); server.close(); process.exit(bad ? 1 : 0);
})();

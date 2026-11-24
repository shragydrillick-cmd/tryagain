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
const { handle, signedByShopify, cleanShop, toPackOrder, shopFromSessionToken } = require(FN + "shopify.js");
// Shopify's session token, as App Bridge gives it inside the store's admin
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (p, key = "test-secret") => { const hp = b64({ alg: "HS256", typ: "JWT" }) + "." + b64(p); return hp + "." + crypto.createHmac("sha256", key).update(hp).digest("base64url"); };
const now = () => Math.floor(Date.now() / 1000);
const sess = (o = {}) => jwt({ iss: "https://practice-store.myshopify.com/admin", dest: "https://practice-store.myshopify.com", aud: "55a9bba1b5e7545f3227a01633c9693e", sub: "42", exp: now() + 60, nbf: now() - 5, iat: now() - 5, ...o });
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
  if (req.body.grant_type === "urn:ietf:params:oauth:grant-type:token-exchange") { // inside the admin: session token for the store's key
    fake.exchanged = (fake.exchanged || 0) + 1;
    return req.body.client_secret === "test-secret" && shopFromSessionToken(req.body.subject_token) === req.params.shop ? res.json({ access_token: "shpat_" + req.params.shop, scope: "read_orders" }) : res.status(400).json({ error: "invalid" });
  }
  if (req.body.client_secret !== "test-secret" || !fake.codes.has(req.body.code)) return res.status(400).json({ error: "invalid" });
  fake.codes.delete(req.body.code); res.json({ access_token: "shpat_" + req.params.shop, scope: "read_orders" });
});
app.post("/fake/:shop/admin/api/:v/graphql.json", (req, res) => {
  if (req.get("x-shopify-access-token") !== "shpat_" + req.params.shop) return res.status(401).end();
  if (/tagsAdd/.test(req.body.query)) { fake.tags.push(req.body.variables); return res.json({ data: { tagsAdd: { userErrors: [] } } }); }
  if (/partnerDevelopment/.test(req.body.query)) return res.json({ data: { shop: { currencyCode: "USD", plan: { partnerDevelopment: fake.dev !== false } },
    products: { nodes: [{ title: "Fleece blanket", variants: { nodes: [{ id: "gid://shopify/ProductVariant/1", title: "Blue" }, { id: "gid://shopify/ProductVariant/2", title: "Gray" }] } }] } } });
  // the store's inventory: products, and the changes Pick & Sort sends back
  if (/products\(first: 100/.test(req.body.query) && fake.productsFail) { fake.productCalls = (fake.productCalls || 0) + 1; return res.status(500).end(); }
  if (/products\(first: 100/.test(req.body.query)) return res.json({ data: { products: { pageInfo: { hasNextPage: false }, nodes: [
    { id: "gid://shopify/Product/9", title: "Fleece blanket", vendor: "Cozy Co", status: "ACTIVE", options: [{ name: "Color" }, { name: "Size" }], variants: { nodes: [
      { id: "gid://shopify/ProductVariant/91", title: "Blue / One", sku: "FB-BLU", barcode: "5012345000015", inventoryQuantity: fake.qty91 ?? 4, selectedOptions: [{ name: "Color", value: "Blue" }, { name: "Size", value: "One" }], inventoryItem: { id: "gid://shopify/InventoryItem/191" } },
      { id: "gid://shopify/ProductVariant/92", title: "Gray / One", sku: "FB-GRY", barcode: "", inventoryQuantity: 0, selectedOptions: [{ name: "Color", value: "Gray" }, { name: "Size", value: "One" }], inventoryItem: { id: "gid://shopify/InventoryItem/192" } }] } }] } } });
  if (/productSet/.test(req.body.query)) { // the whole product: give each size an id (new ones get new ids)
    const inp = req.body.variables.input; (fake.sets = fake.sets || []).push(inp); let n = 500 + fake.sets.length * 10;
    return res.json({ data: { productSet: { userErrors: [], product: { id: inp.id || "gid://shopify/Product/77", variants: { nodes: inp.variants.map(v => ({ id: v.id || "gid://shopify/ProductVariant/" + (++n),
      inventoryItem: { id: "gid://shopify/InventoryItem/" + n }, selectedOptions: v.optionValues.map(o => ({ name: o.optionName, value: o.name })) })) } } } } });
  }
  if (/productDelete/.test(req.body.query)) { (fake.deleted = fake.deleted || []).push(req.body.variables.id); return res.json({ data: { productDelete: { deletedProductId: req.body.variables.id, userErrors: [] } } }); }
  if (/productUpdate/.test(req.body.query)) { (fake.edits = fake.edits || []).push(["product", req.body.variables.input]); return res.json({ data: { productUpdate: { userErrors: [] } } }); }
  if (/productVariantsBulkUpdate/.test(req.body.query)) { (fake.edits = fake.edits || []).push(["variant", req.body.variables.v[0]]); return res.json({ data: { productVariantsBulkUpdate: { userErrors: [] } } }); }
  if (/locations\(first: 1\)/.test(req.body.query)) return res.json({ data: { productVariant: { inventoryQuantity: fake.qty91 ?? 4 }, locations: { nodes: [{ id: "gid://shopify/Location/1" }] } } });
  if (/inventoryAdjustQuantities/.test(req.body.query)) { const c = req.body.variables.input.changes[0]; (fake.edits = fake.edits || []).push(["stock", c]); fake.qty91 = (fake.qty91 ?? 4) + c.delta; return res.json({ data: { inventoryAdjustQuantities: { userErrors: [] } } }); }
  if (/orderCreate/.test(req.body.query)) { fake.created = (fake.created || []).concat(req.body.variables.order); return res.json({ data: { orderCreate: { order: { name: "#" + (1100 + fake.created.length) }, userErrors: [] } } }); }
  // like the real store without read_customers: the customer record is refused (the name on the delivery address is fine)
  if (/customer \{/.test(req.body.query)) return res.json({ errors: [{ message: "Access denied for customer field. Required access: `read_customers` access scope." }] });
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

  ok("session token: genuine one gives the store; changed, other app, out of date: nothing", shopFromSessionToken(sess()) === "practice-store.myshopify.com"
    && shopFromSessionToken(sess().slice(0, -2) + "xx") === "" && shopFromSessionToken(sess({ aud: "other" })) === "" && shopFromSessionToken(sess({ exp: now() - 100 })) === ""
    && shopFromSessionToken(jwt({ dest: "https://practice-store.myshopify.com", aud: "55a9bba1b5e7545f3227a01633c9693e", exp: now() + 60 }, "wrong")) === "" && shopFromSessionToken(sess({ dest: "https://evil.com" })) === "");
  await fetch(`${EMU}/emulator/v1/projects/${P}/accounts`, { method: "DELETE" }); await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: "DELETE" });
  const launch = await fetch(SRV + "/shopify/app?" + new URLSearchParams(sign({ shop: "practice-store.myshopify.com", timestamp: "1" })), { redirect: "manual" });
  ok("opened from the store's Apps: goes to the test address, ready to connect", launch.status === 302 && launch.headers.get("location") === "https://pick-and-sort--test-6xyzdn76.web.app/?shopify=connect&shop=practice-store.myshopify.com", launch.headers.get("location"));
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
  ok("worker: gets the store's orders, with names (from the delivery address) and areas", ord.orders.length === 2 && ord.orders[0].customer === "Rivka Klein" && ord.orders[0].city === "Brooklyn");
  // Orders → From Shopify: filter by area, tick, add to the list; items without a bin go to "Please look"
  await a.evaluate(() => { try { closePack(); } catch (e) {} closeFind(); closePacking(); });
  ok("the Orders page (in the menu)", await a.evaluate(() => typeof showPage === "function"));
  await a.evaluate(() => { shop.orders = null; }); await a.evaluate(() => { closeAddOrders(); showPage("orders"); }); await a.waitForFunction(() => !shop.busy, null, { timeout: 8000 }).catch(() => {}); await a.waitForTimeout(300);
  ok("Add orders: the store's orders show by themselves once they arrive", (await a.$$("#addOrders .aorow")).length === 2 && !/Getting the orders/.test(await a.innerText("#addOrders")));
  await a.selectOption('#addOrders select[aria-label="Area"]', "Brooklyn");
  const rows = await a.$$eval("#addOrders .aorow", r => r.map(x => x.innerText.replace(/\s+/g, " ")));
  ok("filtered by area: only the Brooklyn order (number, where, when, status)", rows.length === 1 && /#1001 · Brooklyn · .*(Packed|New)/.test(rows[0]) && !/Fleece blanket/.test(rows[0]), rows.join(" // "));
  await a.selectOption('#addOrders select[aria-label="Area"]', ""); await a.selectOption('#addOrders select[aria-label="Sort"]', "oldest");
  ok("sorted oldest first", /#1001/.test(await a.$eval("#addOrders .aorow", x => x.innerText)));
  await a.check('#addOrders input[aria-label="Select all shown"]');
  ok("select all: the button says Add to list (2)", /Add to list \(2\)/.test(await a.innerText("#addOrders .aobar")));
  await a.click('#addOrders button:has-text("Add to list")'); await a.evaluate(() => runStage("pick")); await a.waitForTimeout(500);
  await a.click('#addOrders button:text-is("Start new with these")').catch(() => {}); await a.waitForTimeout(800);
  const look = await a.innerText("#review").catch(() => "");
  ok("added: both orders on the list, and Please look asks for the bins", await a.evaluate(() => plan && plan.orders.length === 2) && /Please look/.test(look) && /missing bin/.test(look), look.slice(0, 200));
  await a.evaluate(() => { closeAddOrders(); showPage("orders"); }); await a.waitForTimeout(600);
  ok("opened again: orders already on the list aren't shown", (await a.$$("#addOrders .aorow")).length === 0);
  await a.evaluate(() => closeAddOrders());
  // disconnect
  await a.evaluate(() => { document.getElementById("navBtn").click(); go("more"); }); await a.waitForTimeout(800);
  await a.click('button:text-is("Disconnect")'); await a.waitForTimeout(300); await a.click('#settingsView button:has-text("Disconnect")').catch(() => {}); await a.waitForTimeout(1500);
  ok("Disconnect: the key is gone, Connect is back", !!(await a.$('input[aria-label="Shopify store address"]')) && /No Shopify store/.test((await (await fetch(SRV + "/shopify/orders", { headers: { Authorization: "Bearer " + wtok } })).json()).error));
  // inside the store's Shopify admin: the admin opens Pick & Sort there and it connects by itself, no redirect
  const cs = await b.newContext({ viewport: { width: 1000, height: 700 } });
  await cs.addInitScript(t => { window.shopify = { idToken: async () => t, config: { shop: "practice-store.myshopify.com" } }; }, sess({ exp: now() + 3600 }));
  const e = await open(cs, "in shopify"); await signIn(e, "o1", "owner@test.com");
  ok("inside Shopify: the test features are on", await e.evaluate(() => IN_SHOPIFY && TEST_FEATURES) && await e.isVisible("#menuBtn"));
  await e.click("#navBtn"); await e.evaluate(() => go("more"));
  await e.waitForFunction(() => shop.status && shop.status.connected && !shop.busy, null, { timeout: 10000 }).catch(() => {}); await e.waitForTimeout(300);
  ok("inside Shopify: connected by itself with Shopify's session token", fake.exchanged === 1 && /practice-store\.myshopify\.com[\s\S]*Connected/.test(await e.innerText("#settingsView")), String(fake.exchanged));
  for (let k = 0; k < 4 && await e.evaluate(() => view === "settings"); k++) await e.click("#navBtn"); await e.evaluate(() => { closeAddOrders(); showPage("orders"); }); await e.waitForFunction(() => !shop.busy && document.querySelectorAll("#addOrders .aorow").length, null, { timeout: 8000 }).catch(() => {});
  ok("inside Shopify: From Shopify lists the store's orders", (await e.$$("#addOrders .aorow")).length === 2);
  const wtok2 = await w.evaluate(() => fb.auth.currentUser.getIdToken());
  const wx = await fetch(SRV + "/shopify/exchange", { method: "POST", headers: { Authorization: "Bearer " + wtok2, "Content-Type": "application/json" }, body: JSON.stringify({ idToken: sess() }) });
  const fx = await fetch(SRV + "/shopify/exchange", { method: "POST", headers: { Authorization: "Bearer " + await e.evaluate(() => fb.auth.currentUser.getIdToken()), "Content-Type": "application/json" }, body: JSON.stringify({ idToken: jwt({ dest: "https://practice-store.myshopify.com", aud: "55a9bba1b5e7545f3227a01633c9693e", exp: now() + 60 }, "wrong") }) });
  ok("exchange: a worker, or a made-up session token, is refused", wx.status === 403 && fx.status === 400, wx.status + " " + fx.status);
  // Make 5 practice orders (test stores only): paid, with a customer, an address and Local Delivery / UPS
  await e.evaluate(() => closeAddOrders()); await e.click("#navBtn"); await e.evaluate(() => go("more"));
  await e.waitForSelector('button:text-is("Make 5 practice orders")'); await e.click('button:text-is("Make 5 practice orders")');
  await e.waitForFunction(() => /Made 5 practice orders/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const c = fake.created || [];
  ok("Make 5 practice orders: 5 paid orders made in the store", c.length === 5 && c.every(o => o.financialStatus === "PAID" && o.lineItems.length && o.shippingAddress.city && /Local Delivery|UPS/.test(o.shippingLines[0].title)), JSON.stringify(c[0] || {}).slice(0, 150));
  fake.dev = false;
  const real = await fetch(SRV + "/shopify/testorders", { method: "POST", headers: { Authorization: "Bearer " + await e.evaluate(() => fb.auth.currentUser.getIdToken()), "Content-Type": "application/json" }, body: "{}" });
  ok("…and never in a real store", real.status === 403 && (fake.created || []).length === 5);
  const wt = await fetch(SRV + "/shopify/testorders", { method: "POST", headers: { Authorization: "Bearer " + wtok2, "Content-Type": "application/json" }, body: "{}" });
  ok("…and not by a worker", wt.status === 403);
  // Bins → Inventory: the store's products come in (the practice items go); changes go back to the store
  await e.evaluate(() => { bins = practiceBins(); bins.settings = { inventoryEdits: true }; saveBins(); go("binsInventory"); });
  await e.waitForFunction(() => bins.shopifyAt && !shopInv.busy, null, { timeout: 10000 }).catch(() => {});
  const invRows = await e.$$eval("#settingsView .invrow", r => r.map(x => x.innerText.replace(/\s+/g, " ")));
  // Shopify failing: tried once and the reason shown, not tried over and over (the screen used to blink)
  fake.productsFail = true; await e.evaluate(() => { shopInv.tried = 0; renderSettings(); }); await e.waitForTimeout(3000);
  ok("inventory failing: tried once, says why, with Try again (no blinking)", fake.productCalls === 1 && /Couldn't get the inventory from Shopify[\s\S]*Try again/.test(await e.innerText("#settingsView")), String(fake.productCalls));
  fake.productsFail = false; await e.click('#settingsView button:text-is("Try again")'); await e.waitForFunction(() => !shopInv.busy && bins.shopifyAt, null, { timeout: 8000 }).catch(() => {});
  ok("Inventory: the store's products, with how many (the practice items gone)", invRows.length === 1 && /Fleece blanket.*Cozy Co.*2 variants.*4/.test(invRows[0]) && /From Shopify: practice-store · 1 item/.test(await e.innerText("#settingsView")), invRows.join(" // "));
  const vs = await e.evaluate(() => bins.products[0].variants.map(v => `${optText(v)}|${v.sku}|${v.barcode}|${v.stock}`).join(", "));
  ok("…each size with its colour, size, SKU, barcode and how many", vs === "Blue / One|FB-BLU|5012345000015|4, Gray / One|FB-GRY||0", vs);
  await e.click("#settingsView .invrow");
  await e.fill('input[aria-label="Barcode of Gray / One"]', "5012345000022"); await e.press('input[aria-label="Barcode of Gray / One"]', "Tab");
  await e.click('button[aria-label="How many Blue / One: one more"]'); await e.click('button[aria-label="How many Blue / One: one more"]');
  await e.waitForFunction(() => (window.__x = 1), null); await e.waitForTimeout(2500);
  const ed = fake.edits || [];
  ok("barcode changed here: it went to the store", ed.some(([k, x]) => k === "variant" && x.id === "gid://shopify/ProductVariant/92" && x.barcode === "5012345000022"), JSON.stringify(ed).slice(0, 300));
  ok("how many changed here (4 → 6): the store's inventory went up by 2", fake.qty91 === 6 && ed.filter(([k]) => k === "stock").length === 2, String(fake.qty91));
  await e.click('#settingsView button:text-is("Details")');
  await e.fill('#binSheet input[aria-label="Item name"]', "Fleece blanket XL"); await e.press('#binSheet input[aria-label="Item name"]', "Tab"); await e.waitForTimeout(1200);
  ok("renamed here: the store's product renamed", (fake.edits || []).some(([k, x]) => k === "product" && x.title === "Fleece blanket XL"));
  await e.click('#binsUndo button:text-is("Undo")'); await e.waitForTimeout(1200);
  ok("Undo: the old name goes back to the store too", (fake.edits || []).filter(([k]) => k === "product").pop()[1].title === "Fleece blanket");
  // sizes and colours: add a colour, remove a size: the whole product goes to the store
  await e.fill('#binSheet input[aria-label="New colour"]', "Pink"); await e.click('#binSheet button:text-is("Add")'); await e.waitForTimeout(1500);
  const set1 = (fake.sets || [])[0];
  ok("added a colour here: the store's product gets it (the others keep their ids)", set1 && set1.id === "gid://shopify/Product/9" && set1.variants.length === 3 && set1.variants.filter(v => v.id).length === 2
    && set1.productOptions[0].name === "Color" && set1.productOptions[0].values.map(x => x.name).join() === "Blue,Gray,Pink", JSON.stringify(set1 || {}).slice(0, 300));
  ok("…and the new size has the store's id here now", await e.evaluate(() => bins.products[0].variants.find(v => v.colour === "Pink").sid === "gid://shopify/ProductVariant/511"));
  await e.waitForFunction(() => !document.getElementById("binsUndo"), null, { timeout: 10000 }).catch(() => {}); // the Undo bar from adding Pink has gone
  await e.click('#binSheet .chip:has-text("One") >> nth=1');
  await e.click('#binSheet button:has-text("Remove this size")');
  await e.click('#binSheet button:has-text("Tap again")');
  await e.waitForTimeout(1500);
  const set2 = (fake.sets || [])[1];
  ok("removed a size here: it's left out of the store's product", set2 && set2.variants.length === 2 && !set2.variants.some(v => v.id === "gid://shopify/ProductVariant/92"), JSON.stringify(set2 || {}).slice(0, 200));
  // a brand-new item here: made in the store as a draft, with its sizes, barcodes and how many
  await e.evaluate(() => { closeSheet(); B.newItem = { title: "Wool Hat", vendor: "Cozy Co", colours: "Red", sizes: "S, M", sku: "WH", barcode: "0099" }; B.newFrom = "binsInventory"; go("binsNewItem"); });
  await e.click('button:has-text("Add the item (2 variants)")'); await e.waitForTimeout(1500);
  const set3 = (fake.sets || [])[2];
  ok("new item: made in the store as a draft, with its two sizes", set3 && !set3.id && set3.status === "DRAFT" && set3.title === "Wool Hat" && set3.variants.length === 2 && set3.variants[0].barcode === "0099", JSON.stringify(set3 || {}).slice(0, 250));
  await e.fill('input[aria-label="How many Red / S"]', "7"); await e.press('input[aria-label="How many Red / S"]', "Tab"); await e.waitForTimeout(1500);
  ok("…and its amount goes to the store", (fake.edits || []).some(([k, x]) => k === "stock" && /InventoryItem\/53/.test(x.inventoryItemId)), JSON.stringify((fake.edits || []).slice(-2)));
  // delete an item here: deleted in the store
  await e.click('#settingsView button:text-is("Details")'); await e.click('#binSheet button:has-text("Delete this item")'); await e.click('#binSheet button:has-text("Tap again")'); await e.waitForTimeout(1500);
  ok("deleted here: deleted in the store", (fake.deleted || []).includes("gid://shopify/Product/77"), JSON.stringify(fake.deleted || []));
  await e.evaluate(() => { bins.settings.inventoryEdits = false; saveBins(); closeSheet(); renderSettings(); });
  ok("with Allow inventory changes off: how many can't be changed for store items", !(await e.$('button[aria-label="How many Blue / One: one more"]')));
  ok("no page errors", !errs.length, errs.join(" / "));
  console.log(bad ? `${bad} FAILED` : "all ok"); await b.close(); server.close(); process.exit(bad ? 1 : 0);
})();

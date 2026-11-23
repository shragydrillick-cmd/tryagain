// The Shopify connection. One small server function behind the website's own address (pick-and-sort.web.app/shopify/...),
// so the app talks to it like any other page and Shopify's secret never reaches a phone.
//
//   /shopify/app       Shopify opens this when the app is installed or opened from the store's admin.
//   /shopify/start     (signed-in company admin) where to send them to let Pick & Sort into their store.
//   /shopify/callback  Shopify comes back here once they've said yes; the store's key is kept for the company.
//   /shopify/orders    (signed-in, in the company) the store's open orders that aren't sent out yet, for packing.
//   /shopify/packed    (signed-in, in the company) puts the "Packed ..." tag on an order.
//   /shopify/exchange  (company admin, inside the store's admin) connect with Shopify's session token, no redirect.
//   /shopify/status    (signed-in, in the company) whether a store is connected, and which.
//   /shopify/disconnect (company admin) forgets the store's key.
//
// The store's key is in Firestore under shopifyTokens/{company}, which the database rules let nobody read: only this code
// (running as the project itself) can. The client secret comes from the GitHub secret SHOPIFY_CLIENT_SECRET at deploy.
const crypto = require("crypto");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { dailyGuard } = require("./guard");

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || "55a9bba1b5e7545f3227a01633c9693e";
const SCOPES = "read_orders,write_orders,read_products,write_products,read_fulfillments,read_inventory,write_inventory,read_locations,read_customers";
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const HOME = "https://pick-and-sort.web.app";
// where the app opens from Shopify (and comes back to after connecting): the test address while Shopify is only there
const LAUNCH = process.env.SHOPIFY_LAUNCH || "https://pick-and-sort--test-6xyzdn76.web.app";
// where the app may ask to come back to after connecting: the main address and its test copies
const RETURN_OK = /^https:\/\/pick-and-sort(--[a-z0-9-]+)?\.(web\.app|firebaseapp\.com)$/;
// the automatic tests run the app on this computer (only when they point the server at a pretend Shopify)
const backOk = u => RETURN_OK.test(u || "") || (!!process.env.SHOPIFY_TEST_BASE && /^http:\/\/localhost:\d+$/.test(u || ""));
const SHOP_OK = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

const secret = () => process.env.SHOPIFY_CLIENT_SECRET || "";
// tests point this at a pretend Shopify; for real it's the store's own address
const shopBase = shop => (process.env.SHOPIFY_TEST_BASE ? `${process.env.SHOPIFY_TEST_BASE}/${shop}` : `https://${shop}`);
let db = null;
const getDb = () => { if (!db) { if (!getApps().length) initializeApp(); db = getFirestore(); } return db; };

class Problem extends Error { constructor(status, msg) { super(msg); this.status = status; } }

/** Shopify signs what it sends with the client secret: check it, so nobody can pretend to be Shopify. */
function signedByShopify(query) {
  const given = String(query.hmac || ""); if (!given || !secret()) return false;
  const msg = Object.keys(query).filter(k => k !== "hmac" && k !== "signature").sort()
    .map(k => `${k}=${Array.isArray(query[k]) ? query[k].join(",") : query[k]}`).join("&");
  const want = crypto.createHmac("sha256", secret()).update(msg).digest("hex");
  return given.length === want.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(want));
}
/** Shopify's session token (a JWT signed with the client secret): the store it's for, or "" if it isn't genuine or is out of date. */
function shopFromSessionToken(tok) {
  const parts = tok.split("."); if (parts.length !== 3 || !secret()) return "";
  const want = crypto.createHmac("sha256", secret()).update(parts[0] + "." + parts[1]).digest("base64url");
  if (parts[2].length !== want.length || !crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(want))) return "";
  let h, p; try { h = JSON.parse(Buffer.from(parts[0], "base64url")); p = JSON.parse(Buffer.from(parts[1], "base64url")); } catch (e) { return ""; }
  const now = Date.now() / 1000;
  if (h.alg !== "HS256" || p.aud !== CLIENT_ID || !(p.exp > now - 10) || (p.nbf && p.nbf > now + 10)) return "";
  let shop = ""; try { shop = cleanShop(new URL(p.dest).hostname); } catch (e) {}
  return shop;
}
const cleanShop = s => { s = String(s || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""); if (s && !s.includes(".")) s += ".myshopify.com"; return SHOP_OK.test(s) ? s : ""; };

/** Who's asking: their Firebase sign-in, and their place in an accepted company. */
async function caller(req, needAdmin) {
  const m = /^Bearer (.+)$/.exec(req.get("authorization") || ""); if (!m) throw new Problem(401, "Sign in first.");
  let tok; try { getDb(); tok = await getAuth().verifyIdToken(m[1]); } catch (e) { throw new Problem(401, "Sign in again."); }
  const u = await getDb().doc(`users/${tok.uid}`).get();
  if (!u.exists || u.data().status !== "allowed" || !u.data().company) throw new Problem(403, "This account isn't in a company.");
  const c = await getDb().doc(`companies/${u.data().company}`).get();
  if (!c.exists || c.data().status !== "approved") throw new Problem(403, "The company isn't accepted yet.");
  const isAdmin = ["admin", "owner"].includes(u.data().role);
  if (needAdmin && !isAdmin) throw new Problem(403, "Only the company's admin can connect the Shopify store.");
  return { uid: tok.uid, email: tok.email || "", company: u.data().company, isAdmin };
}
async function storeKey(company) {
  const t = await getDb().doc(`shopifyTokens/${company}`).get();
  if (!t.exists) throw new Problem(409, "No Shopify store is connected yet.");
  return t.data();
}
async function graphql(key, query, variables) {
  const r = await fetch(`${shopBase(key.shop)}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": key.token }, body: JSON.stringify({ query, variables }) });
  if (r.status === 401 || r.status === 403) throw new Problem(409, "Shopify refused the store's key: connect the store again in Settings.");
  if (!r.ok) throw new Problem(502, `Shopify answered ${r.status}.`);
  return r.json();
}

// people: "all" (the customer's record and the delivery address), "address" (the delivery address, with the name on it),
// "none". The customer's record needs read_customers; without it the name on the delivery address is used.
const ORDER_FIELDS = (people) => `id name createdAt tags displayFulfillmentStatus
  ${people === "all" ? "customer { displayName } " : ""}${people !== "none" ? "shippingAddress { name firstName lastName address1 address2 city zip }" : ""}
  shippingLine { title }
  lineItems(first: 100) { nodes { name title variantTitle quantity currentQuantity unfulfilledQuantity sku variant { barcode sku } } }`;
const ORDERS = withPeople => `query($n: Int!, $after: String) {
  orders(first: $n, after: $after, sortKey: CREATED_AT, reverse: true, query: "status:open AND (fulfillment_status:unfulfilled OR fulfillment_status:partial)") {
    pageInfo { hasNextPage endCursor } nodes { ${ORDER_FIELDS(withPeople)} } } }`;
/** A Shopify order in the shape the app packs: number, customer, area, local delivery or shipping, items. */
function toPackOrder(o, shop) {
  const a = o.shippingAddress || {}, title = (o.shippingLine && o.shippingLine.title) || "";
  const local = /local|deliver|pick ?up|pickup/i.test(title) && !/ups|usps|fedex|dhl|ground|priority|express/i.test(title);
  const idNum = String(o.id).split("/").pop();
  return {
    number: String(o.name || "").replace(/^#/, ""), id: o.id, created: Date.parse(o.createdAt) || null,
    customer: (o.customer && o.customer.displayName) || a.name || [a.firstName, a.lastName].filter(Boolean).join(" ") || "", address: [a.address1, a.address2].filter(Boolean).join(", "), city: a.city || "", zip: a.zip || "",
    delivery: { type: local || !title ? "local" : "shipping", title, date: null },
    tags: o.tags || [], packed: (o.tags || []).some(t => /^packed\b/i.test(t)),
    shopifyUrl: `https://admin.shopify.com/store/${shop.replace(/\.myshopify\.com$/, "")}/orders/${idNum}`,
    items: (o.lineItems && o.lineItems.nodes || []).map(l => ({
      name: l.title || l.name || "", details: l.variantTitle && l.variantTitle !== "Default Title" ? l.variantTitle : "",
      sku: l.sku || (l.variant && l.variant.sku) || "", barcode: (l.variant && l.variant.barcode) || "", bin: "",
      qty: l.unfulfilledQuantity != null ? l.unfulfilledQuantity : l.currentQuantity != null ? l.currentQuantity : l.quantity })).filter(x => x.qty > 0),
  };
}
/** How many are in the building (on hand, at every location); what Shopify calls available leaves out what's ordered. */
function onHand(v) {
  const lv = v.inventoryItem && v.inventoryItem.inventoryLevels && v.inventoryItem.inventoryLevels.nodes;
  if (lv && lv.length) return lv.reduce((a, l) => a + (Number((((l.quantities || [])[0]) || {}).quantity) || 0), 0);
  return v.inventoryQuantity;
}
async function openOrders(key) {
  // names and addresses are "protected customer data" in Shopify: if the app hasn't been allowed them yet, the orders come without
  // names and addresses are "protected customer data": if Shopify refuses them, the orders come without (and its reason is kept)
  let people = "all", peopleErr = "", out = [], after = null;
  for (let page = 0; page < 5; page++) {
    let d = await graphql(key, ORDERS(people), { n: 100, after });
    while (d.errors && people !== "none") {
      if (!peopleErr) { peopleErr = d.errors.map(e => e.message).join("; ").slice(0, 300); console.error("orders with people refused:", JSON.stringify(d.errors).slice(0, 1000)); }
      people = people === "all" ? "address" : "none";
      d = await graphql(key, ORDERS(people), { n: 100, after });
    }
    if (d.errors) throw new Problem(502, "Shopify: " + (d.errors[0] && d.errors[0].message || "error"));
    const c = d.data.orders; out = out.concat(c.nodes.map(o => toPackOrder(o, key.shop)));
    if (!c.pageInfo.hasNextPage) break; after = c.pageInfo.endCursor;
  }
  return { orders: out.filter(o => o.items.length), people, peopleErr };
}

async function route(req, res) {
  const path = (req.path || "").replace(/^\/shopify/, "").replace(/\/+$/, "") || "/";
  const q = req.query || {};
  const body = typeof req.body === "object" && req.body ? req.body : (() => { try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; } })();

  if (path === "/app" || path === "/") { // opened from Shopify
    const shop = cleanShop(q.shop);
    if (!shop || !signedByShopify(q)) return res.redirect(302, LAUNCH + "/");
    const known = await getDb().collection("shopifyTokens").where("shop", "==", shop).limit(1).get();
    return res.redirect(302, LAUNCH + "/?shopify=" + (known.empty ? "connect&shop=" + encodeURIComponent(shop) : "open"));
  }
  if (path === "/callback") { // Shopify, after the admin said yes
    const shop = cleanShop(q.shop);
    if (!shop || !signedByShopify(q)) throw new Problem(400, "This didn't come from Shopify.");
    const sref = getDb().doc(`shopifyStates/${String(q.state || "x").replace(/[^a-zA-Z0-9]/g, "") || "x"}`);
    const st = await sref.get();
    if (!st.exists || st.data().shop !== shop || Date.now() - st.data().at > 15 * 60e3) throw new Problem(400, "That took too long or didn't start here: tap Connect again in Pick & Sort.");
    await sref.delete();
    const r = await fetch(`${shopBase(shop)}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: secret(), code: String(q.code || "") }) });
    const t = r.ok ? await r.json() : null;
    if (!t || !t.access_token) throw new Problem(502, "Shopify didn't give the key. Try Connect again.");
    const { company, uid, email, back } = st.data(), at = Date.now();
    await getDb().doc(`shopifyTokens/${company}`).set({ shop, token: t.access_token, scope: t.scope || "", at, by: uid });
    await getDb().doc(`companies/${company}/settings/shopify`).set({ shop, at, byEmail: email });
    return res.redirect(302, (backOk(back) ? back : LAUNCH) + "/?shopify=connected");
  }

  if (req.method === "OPTIONS") return res.status(204).end();
  if (path === "/start") {
    const who = await caller(req, true), shop = cleanShop(body.shop);
    if (!shop) throw new Problem(400, "Type the store's Shopify address, like your-store.myshopify.com.");
    await dailyGuard("shopifyStart", 200);
    const state = crypto.randomBytes(24).toString("hex");
    await getDb().doc(`shopifyStates/${state}`).set({ shop, company: who.company, uid: who.uid, email: who.email, at: Date.now(), back: backOk(body.back) ? body.back : LAUNCH });
    const url = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPES, redirect_uri: HOME + "/shopify/callback", state });
    return res.json({ url });
  }
  // inside the store's admin: Shopify's own proof of which store this is (its session token), swapped for the store's key.
  // No redirect, and only someone signed in to that store's admin can get one.
  if (path === "/exchange") {
    const who = await caller(req, true), shop = shopFromSessionToken(String(body.idToken || ""));
    if (!shop) throw new Problem(400, "Shopify didn't confirm the store. Close Pick & Sort in Shopify and open it again.");
    await dailyGuard("shopifyStart", 200);
    const r = await fetch(`${shopBase(shop)}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: secret(), grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: String(body.idToken),
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token", requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token" }) });
    const t = r.ok ? await r.json() : null;
    if (!t || !t.access_token) { console.error("token exchange", r.status, await r.text().catch(() => "")); throw new Problem(502, "Shopify didn't give the key. Check the app is installed on this store, then try again."); }
    const at = Date.now();
    await getDb().doc(`shopifyTokens/${who.company}`).set({ shop, token: t.access_token, scope: t.scope || "", at, by: who.uid });
    await getDb().doc(`companies/${who.company}/settings/shopify`).set({ shop, at, byEmail: who.email });
    return res.json({ connected: true, shop, at });
  }
  if (path === "/status") {
    const who = await caller(req, false);
    const t = await getDb().doc(`shopifyTokens/${who.company}`).get();
    return res.json(t.exists ? { connected: true, shop: t.data().shop, at: t.data().at, scope: t.data().scope || "", need: SCOPES } : { connected: false, need: SCOPES });
  }
  if (path === "/orders") {
    const who = await caller(req, false); await dailyGuard("shopifyOrders");
    const key = await storeKey(who.company);
    return res.json({ shop: key.shop, at: Date.now(), ...(await openOrders(key)) });
  }
  if (path === "/packed") {
    const who = await caller(req, false); await dailyGuard("shopifyPacked");
    const key = await storeKey(who.company);
    const id = String(body.id || ""), tag = String(body.tag || "Packed").slice(0, 60);
    if (!/^gid:\/\/shopify\/Order\/\d+$/.test(id)) throw new Problem(400, "Which order?");
    const d = await graphql(key, `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`, { id, tags: [tag] });
    const err = d.errors ? d.errors[0].message : d.data && d.data.tagsAdd.userErrors.length ? d.data.tagsAdd.userErrors[0].message : "";
    if (err) throw new Problem(502, "Shopify: " + err);
    return res.json({ ok: true });
  }
  // practice orders in a development (test) store only: real orders made straight in the store, paid, no checkout or tax
  if (path === "/testorders") {
    const who = await caller(req, true); await dailyGuard("shopifyTestOrders", 100);
    const key = await storeKey(who.company), n = Math.max(1, Math.min(10, Number(body.count) || 5));
    const info = await graphql(key, `{ shop { currencyCode plan { partnerDevelopment } } products(first: 50, query: "status:active") { nodes { title variants(first: 20) { nodes { id title } } } } }`);
    if (info.errors) throw new Problem(502, "Shopify: " + info.errors[0].message);
    if (!info.data.shop.plan.partnerDevelopment) throw new Problem(403, "Practice orders are only made in a development (test) store.");
    const variants = info.data.products.nodes.flatMap(p => p.variants.nodes.map(v => v.id));
    if (!variants.length) throw new Problem(409, "The store has no products yet: add a product or two in Shopify first.");
    const people = [["Rivka", "Klein"], ["Sara", "Weiss"], ["Chaya", "Gross"], ["Leah", "Stern"], ["Miriam", "Friedman"], ["Esther", "Katz"], ["Dina", "Roth"], ["Malky", "Adler"]];
    const places = [["1200 50th St", "Brooklyn", "11219", "Local Delivery"], ["1650 Ocean Pkwy", "Brooklyn", "11230", "Local Delivery"], ["5 Maple Ave", "Monsey", "10952", "UPS Ground"],
      ["220 Lee Ave", "Brooklyn", "11211", "Local Delivery"], ["710 Main St", "Lakewood", "08701", "UPS Ground"], ["70-15 Main St", "Queens", "11367", "UPS Ground"]];
    const pick = a => a[crypto.randomInt(a.length)], made = [], problems = [];
    for (let i = 0; i < n; i++) {
      const [first, last] = pick(people), [address1, city, zip, ship] = pick(places), lines = new Map();
      for (let k = 1 + crypto.randomInt(3); k > 0; k--) { const v = pick(variants); lines.set(v, (lines.get(v) || 0) + 1 + (crypto.randomInt(4) === 0 ? 1 : 0)); }
      const order = { email: `${first}.${last}@example.com`.toLowerCase(), financialStatus: "PAID", test: true,
        lineItems: [...lines].map(([variantId, quantity]) => ({ variantId, quantity })),
        shippingAddress: { firstName: first, lastName: last, address1, city, zip, provinceCode: zip.startsWith("08") ? "NJ" : "NY", countryCode: "US" },
        shippingLines: [{ title: ship, priceSet: { shopMoney: { amount: "0.00", currencyCode: info.data.shop.currencyCode } } }] };
      const d = await graphql(key, `mutation($order: OrderCreateOrderInput!) { orderCreate(order: $order, options: { inventoryBehaviour: BYPASS, sendReceipt: false, sendFulfillmentReceipt: false }) { order { name } userErrors { field message } } }`, { order });
      const err = d.errors ? d.errors[0].message : d.data.orderCreate.userErrors.length ? d.data.orderCreate.userErrors.map(e => e.message).join("; ") : "";
      if (err) problems.push(err); else made.push(d.data.orderCreate.order.name);
    }
    if (!made.length) throw new Problem(502, "Shopify: " + (problems[0] || "no orders made"));
    return res.json({ made, problems });
  }
  // the store's inventory: every product with its sizes / colours, barcodes, SKUs and how many
  if (path === "/products") {
    const who = await caller(req, false); await dailyGuard("shopifyProducts");
    const key = await storeKey(who.company);
    let out = [], after = null;
    for (let page = 0; page < 20; page++) {
      const d = await graphql(key, `query($after: String) { products(first: 100, after: $after, query: "status:active OR status:draft") { pageInfo { hasNextPage endCursor }
        nodes { id title vendor status options { name } variants(first: 100) { nodes { id title sku barcode price inventoryQuantity selectedOptions { name value }
          inventoryItem { id tracked inventoryLevels(first: 10) { nodes { quantities(names: ["on_hand"]) { quantity } } } } } } } } }`, { after });
      if (d.errors) throw new Problem(502, "Shopify: " + d.errors[0].message);
      out = out.concat(d.data.products.nodes.map(p => ({ id: p.id, title: p.title, vendor: p.vendor || "", status: p.status, optionNames: (p.options || []).map(o => o.name),
        variants: p.variants.nodes.map(v => ({ id: v.id, title: v.title, sku: v.sku || "", barcode: v.barcode || "", price: v.price, stock: onHand(v), item: v.inventoryItem && v.inventoryItem.id,
          options: (v.selectedOptions || []).filter(o => !(o.name === "Title" && o.value === "Default Title")) })) })));
      if (!d.data.products.pageInfo.hasNextPage) break; after = d.data.products.pageInfo.endCursor;
    }
    return res.json({ products: out, at: Date.now() });
  }
  // changes made in Pick & Sort, written to the store: a product's name / company, a variant's barcode / SKU, how many
  if (path === "/edit") {
    const who = await caller(req, false); await dailyGuard("shopifyEdit");
    const key = await storeKey(who.company), e = body || {}, gid = (x, kind) => new RegExp(`^gid://shopify/${kind}/\\d+$`).test(String(x || ""));
    const fail = d => { const err = d.errors ? d.errors[0].message : Object.values(d.data || {}).map(x => x && x.userErrors || []).flat().map(x => x.message).join("; "); if (err) throw new Problem(502, "Shopify: " + err); };
    if (e.kind === "product") {
      if (!gid(e.id, "Product")) throw new Problem(400, "Which product?");
      const input = { id: e.id }; if (e.title != null) input.title = String(e.title).slice(0, 255); if (e.vendor != null) input.vendor = String(e.vendor).slice(0, 255);
      fail(await graphql(key, `mutation($input: ProductInput!) { productUpdate(input: $input) { userErrors { message } } }`, { input }));
    } else if (e.kind === "variant") {
      if (!gid(e.product, "Product") || !gid(e.id, "ProductVariant")) throw new Problem(400, "Which variant?");
      const v = { id: e.id }; if (e.barcode != null) v.barcode = String(e.barcode).slice(0, 255); if (e.sku != null) v.inventoryItem = { sku: String(e.sku).slice(0, 255) };
      fail(await graphql(key, `mutation($p: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $p, variants: $v) { userErrors { message } } }`, { p: e.product, v: [v] }));
    } else if (e.kind === "stock") {
      if (!gid(e.item, "InventoryItem") || !gid(e.id, "ProductVariant")) throw new Problem(400, "Which variant?");
      const want = Math.max(0, Math.floor(Number(e.quantity) || 0));
      // the change goes on the store's first location; the difference from what Shopify has now in all
      const now = await graphql(key, `query($v: ID!) { productVariant(id: $v) { inventoryQuantity inventoryItem { inventoryLevels(first: 10) { nodes { quantities(names: ["on_hand"]) { quantity } } } } } locations(first: 1) { nodes { id } } }`, { v: e.id });
      fail(now);
      const loc = now.data.locations.nodes[0]; if (!loc) throw new Problem(409, "The store has no location for inventory.");
      const delta = want - (onHand(now.data.productVariant) || 0); // on hand = in the building, ordered or not (shipping takes it off)
      if (delta) {
        const change = { delta, inventoryItemId: e.item, locationId: loc.id };
        const m = `mutation($input: InventoryAdjustQuantitiesInput!) { inventoryAdjustQuantities(input: $input) { userErrors { message } } }`;
        let d = await graphql(key, m, { input: { reason: "correction", name: "available", changes: [{ ...change, changeFromQuantity: null }] } });
        if (d.errors && /changeFromQuantity/.test(JSON.stringify(d.errors))) d = await graphql(key, m, { input: { reason: "correction", name: "available", changes: [change] } }); // older API versions
        fail(d);
      }
      return res.json({ ok: true, quantity: want });
    } else throw new Problem(400, "What to change?");
    return res.json({ ok: true });
  }
  // a whole product as it is in Pick & Sort (new, or sizes / colours added, removed or renamed): Shopify is made the same.
  // Sizes that aren't listed any more are removed; new ones get the price of the others; a new product starts as a draft.
  if (path === "/productset") {
    const who = await caller(req, false); await dailyGuard("shopifyEdit");
    const key = await storeKey(who.company), q = body.product || {};
    if (q.id && !/^gid:\/\/shopify\/Product\/\d+$/.test(q.id)) throw new Problem(400, "Which product?");
    const vs = (q.variants || []).slice(0, 100);
    if (!String(q.title || "").trim() || !vs.length) throw new Problem(400, "A product needs a name and at least one size / colour.");
    const [n1, n2] = [(q.optionNames || [])[0] || "Color", (q.optionNames || [])[1] || "Size"];
    const hasC = vs.some(v => v.colour), hasS = vs.some(v => v.size), uniq = a => [...new Set(a)];
    const opts = [];
    if (hasC) opts.push({ name: n1, values: uniq(vs.map(v => v.colour || "Default")).map(name => ({ name })) });
    if (hasS) opts.push({ name: hasC ? n2 : (q.optionNames || []).find(n => /size/i.test(n)) || "Size", values: uniq(vs.map(v => v.size || "One size")).map(name => ({ name })) });
    if (!opts.length) opts.push({ name: "Title", values: [{ name: "Default Title" }] });
    const price = (vs.find(v => v.price) || {}).price || "0.00";
    const input = { title: String(q.title).slice(0, 255), vendor: String(q.vendor || "").slice(0, 255), productOptions: opts,
      variants: vs.map(v => ({ ...(v.id && /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(v.id) ? { id: v.id } : { price: v.price || price, inventoryItem: { tracked: true, sku: v.sku || "" } }),
        ...(v.id ? { inventoryItem: { sku: v.sku || "" } } : {}), barcode: v.barcode || "",
        optionValues: opts[0].name === "Title" ? [{ optionName: "Title", name: "Default Title" }]
          : [hasC ? { optionName: opts[0].name, name: v.colour || "Default" } : null, hasS ? { optionName: opts[hasC ? 1 : 0].name, name: v.size || "One size" } : null].filter(Boolean) })) };
    if (q.id) input.id = q.id; else input.status = "DRAFT";
    const d = await graphql(key, `mutation($input: ProductSetInput!) { productSet(input: $input, synchronous: true) { product { id variants(first: 100) { nodes { id selectedOptions { name value } inventoryItem { id } } } } userErrors { field message } } }`, { input });
    const err = d.errors ? d.errors[0].message : d.data.productSet.userErrors.map(x => x.message).join("; ");
    if (err) throw new Problem(502, "Shopify: " + err);
    const pr = d.data.productSet.product;
    return res.json({ id: pr.id, variants: pr.variants.nodes.map(v => ({ id: v.id, item: v.inventoryItem && v.inventoryItem.id, options: v.selectedOptions })) });
  }
  if (path === "/productdelete") {
    const who = await caller(req, false); await dailyGuard("shopifyEdit");
    const key = await storeKey(who.company);
    if (!/^gid:\/\/shopify\/Product\/\d+$/.test(String(body.id || ""))) throw new Problem(400, "Which product?");
    const d = await graphql(key, `mutation($id: ID!) { productDelete(input: { id: $id }) { deletedProductId userErrors { message } } }`, { id: body.id });
    const err = d.errors ? d.errors[0].message : d.data.productDelete.userErrors.map(x => x.message).join("; ");
    if (err) throw new Problem(502, "Shopify: " + err);
    return res.json({ ok: true });
  }
  if (path === "/disconnect") {
    const who = await caller(req, true);
    await getDb().doc(`shopifyTokens/${who.company}`).delete();
    await getDb().doc(`companies/${who.company}/settings/shopify`).delete();
    return res.json({ ok: true });
  }
  throw new Problem(404, "Not here.");
}

/** The whole thing, for the server function (and the tests). Errors come back as { error } with a plain message. */
async function handle(req, res) {
  try { await route(req, res); }
  catch (e) {
    const status = e.status || (e.code === "resource-exhausted" ? 429 : 500);
    if (status >= 500) console.error(e);
    const msg = e.status || status === 429 ? e.message : "Something went wrong on the server.";
    if ((req.path || "").includes("/callback")) return res.status(status).type("html").send(`<!doctype html><meta name=viewport content="width=device-width"><body style="font:16px system-ui;padding:24px"><h2>Pick &amp; Sort</h2><p>${msg.replace(/</g, "&lt;")}</p><p><a href="${LAUNCH}/">Back to Pick &amp; Sort</a></p>`);
    res.status(status).json({ error: msg });
  }
}
module.exports = { handle, signedByShopify, cleanShop, toPackOrder, shopFromSessionToken };

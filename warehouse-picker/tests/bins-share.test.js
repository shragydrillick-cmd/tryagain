// Real bins on the test address (needs the Firebase emulator, see README): Orders has just Add orders (from the store);
// Bins are shared by everyone in the company: an item placed on one device shows on the other; two people changing
// different sizes at the same time both keep their change; a deleted item goes on both. Orders added from the store get
// each item's bin from Bins; an item with no bin yet waits under Please look and gets its bin as soon as it's set.
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/index.html', EMU = 'http://127.0.0.1:9099', P = 'pick-and-sort';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${P}/accounts`, { method: 'DELETE' }); await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch(); const errs = [];
  const open = async (c, n) => { const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ': ' + e.message));
    await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { if (!localStorage.getItem('keep')) localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('keep', '1');
      ['pick-and-sort-emulator', 'pick-and-sort-accounts-on', 'pick-and-sort-test-features'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    await p.goto(BASE); return p; };
  const google = (p, sub, email) => p.evaluate(([sub, email]) => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }))), [sub, email]);
  const signIn = async (p, sub, email) => { await p.waitForFunction(() => document.getElementById('gate') && /Sign in/.test(document.getElementById('gate').innerText)); await google(p, sub, email); await p.waitForFunction(() => !document.getElementById('gate') && acct); };
  const ca = await b.newContext({ viewport: { width: 1100, height: 800 } }), cb = await b.newContext({ viewport: { width: 390, height: 844 } });
  const a = await open(ca, 'admin'); await signIn(a, 'o1', 'owner@test.com');
  await a.click('#navBtn'); await a.evaluate(() => go('admin')); await a.waitForSelector('input[aria-label="New company name"]');
  await a.fill('input[aria-label="New company name"]', 'S & O'); await a.click('button:has-text("Add company")'); await a.waitForSelector('input[aria-label="Email to add"]');
  await a.click('button:has-text("Turn on")'); await a.waitForTimeout(400);
  await a.fill('input[aria-label="Email to add"]', 'w@test.com'); await a.click('button:text-is("Add")'); await a.waitForTimeout(600);
  await a.click('#navBtn'); await a.click('#navBtn').catch(() => {}); await a.evaluate(() => { if (view === 'settings') document.getElementById('navBtn').click(); });
  // Orders: just Add orders
  const tiles = await a.$$eval('#homeView .addtiles > *', t => t.filter(x => !x.classList.contains('hidden')).map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  ok('test address: Orders has only Add orders', tiles.length === 1 && /^Add orders/.test(tiles[0]), tiles.join(' | '));
  // the admin sets up Bins (the example items) and they reach the worker's phone
  await a.evaluate(() => { bins = practiceBins(); bins.settings = { inventoryEdits: true }; saveBins(); });
  const w = await open(cb, 'worker'); await signIn(w, 'w1', 'w@test.com');
  await w.waitForFunction(() => bins && bins.products && bins.products.length === 12, null, { timeout: 15000 }).catch(() => {});
  ok("Bins are shared: the worker's phone has the admin's items and bins", await w.evaluate(() => bins && bins.products.length === 12 && allVariants().filter(x => x.v.bins.length).length > 20));
  // both change different sizes at the same time
  const [v1, v2] = await a.evaluate(() => { const vs = bins.products[1].variants; return [vs[0].id, vs[1].id]; });
  await Promise.all([
    a.evaluate(id => { const x = allVariants().find(y => y.v.id === id); binsChange('a', () => { x.v.bins = []; addToBin(x.v, 'Z1', 4); }); }, v1),
    w.evaluate(id => { const x = allVariants().find(y => y.v.id === id); binsChange('w', () => { x.v.bins = []; addToBin(x.v, 'Z2', 6); }); }, v2)]);
  await a.waitForTimeout(4000);
  const both = async p => p.evaluate(([i1, i2]) => { const f = id => allVariants().find(y => y.v.id === id).v; return `${binAmounts(f(i1))}|${binAmounts(f(i2))}`; }, [v1, v2]);
  ok('two people at once, different sizes: both changes kept, on both devices', await both(a) === 'Z1 (4)|Z2 (6)' && await both(w) === 'Z1 (4)|Z2 (6)', `${await both(a)} / ${await both(w)}`);
  // a deleted item goes on both
  const gone = await a.evaluate(() => { const p = bins.products[11]; binsChange('del', () => { bins.products = bins.products.filter(x => x !== p); }); return p.id; });
  await w.waitForFunction(id => !bins.products.some(p => p.id === id), gone, { timeout: 10000 }).catch(() => {});
  ok('deleted on one device: gone on the other', await w.evaluate(id => !bins.products.some(p => p.id === id), gone));
  // orders from the store take each item's bin from Bins; one has no bin yet
  const codes = await a.evaluate(() => { const st = practiceStore().orders; const o = st.find(x => x.items.length >= 2); return { n: o.number, codes: o.items.map(i => i.barcode) }; });
  await a.evaluate(c => { // the first item is in Bins in C9; the second is in Bins with no bin
    binsChange('setup', () => { bins.products.push({ id: 'pt1', title: 'Store item A', vendor: 'X', variants: [{ id: 'pt1v1', colour: '', size: '', opts: [], sku: '', barcode: c[0], stock: 3, bins: [{ bin: 'C9', qty: 3, at: 1 }] }] },
      { id: 'pt2', title: 'Store item B', vendor: 'X', variants: [{ id: 'pt2v1', colour: '', size: '', opts: [], sku: '', barcode: c[1], stock: 2, bins: [] }] }); });
  }, codes.codes);
  await a.click('#shopifyAddBtn'); await a.fill('#addOrders input[aria-label="Search orders"]', codes.n); await a.waitForTimeout(600);
  await a.check(`#addOrders input[aria-label="Order ${codes.n}"]`); await a.click('#addOrders button:has-text("Add to list")'); await a.evaluate(() => runStage('pick')); await a.waitForTimeout(800);
  const boxes = await a.evaluate(c => c.map(code => (current.lines.find(l => l.barcode === code) || {}).box), codes.codes);
  ok("added from the store: the item in Bins goes to its bin (C9), the other has none yet", boxes[0] === 'C9' && boxes[1] === '?', boxes.join(','));
  ok('…and the one without a bin waits under Please look', /Please look[\s\S]*missing bin/.test(await a.innerText('#review')));
  // set its bin (on the worker's phone): the list gets it
  await w.evaluate(code => { const x = findCode(code); binsChange('place', () => addToBin(x.v, 'D4', 2)); }, codes.codes[1]);
  await a.waitForFunction(code => (current.lines.find(l => l.barcode === code) || {}).box === 'D4', codes.codes[1], { timeout: 10000 }).catch(() => {});
  ok('its bin set on another phone: the list item gets D4', await a.evaluate(code => current.lines.find(l => l.barcode === code).box, codes.codes[1]) === 'D4');
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

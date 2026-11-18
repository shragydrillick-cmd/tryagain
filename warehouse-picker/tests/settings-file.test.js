// Settings file round trip: everything about the store and the bins must be identical on the other device,
// and picking the same orders there must give the exact same pick order.
const { chromium } = require('playwright'); require('./noauth')(chromium);
const S = require('os').tmpdir();
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const errs = [];
  const fresh = async n => { const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ': ' + e.message)); await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); return p; };
  const a = await fresh('A');
  // a full store: aisles of different shapes, picking patterns, a custom walking order, order numbering, learned barcode, inventory; plus Bins with changes
  await a.evaluate(() => {
    const A = makeAisle({ letter: 'A', shelves: 4, per: '10' }), B = makeAisle({ letter: 'B', shelves: 3, per: '8' }), C = makeAisle({ letter: 'C', shelves: 5, per: '6' }), D = makeAisle({ letter: 'D', shelves: 2, per: '12' });
    B.pattern = 'columns'; B.zigzag = true; C.pattern = 'blocks'; C.block = 3; C.inner = 'reverse'; D.dir = 'rtl'; A.shelves[1].rtl = true;
    settings.units = [A, B, C, D]; settings.walk = [C.id, A.id, D.id, B.id]; settings.orderNumbering = 'file'; settings.theme = 'dark';
    settings.barcodes = { '5012345000107': 'sku:WB-750' };
    settings.inventory = { name: 'inv.csv', loaded: new Date().toISOString(), rows: [{ code: 'X1', bin: 'A3' }, { code: 'X2', bin: 'C14' }] };
    saveSettings();
    bins = practiceBins(); bins.products[0].variants[0].bins.push({ bin: 'D7', at: 1 }); bins.settings = { inventoryEdits: true }; saveBins();
  });
  await a.click('#exampleBtn');
  const pickA = await a.evaluate(() => plan.picks.map(p => p.box + ':' + p.name).join(' > '));
  const want = await a.evaluate(() => ({ settings: JSON.stringify({ ...settings, companyStoreAt: undefined, storeEditedAt: undefined }), bins: JSON.stringify(bins), boxes: buildLocator(settings).size }));
  await a.click('#navBtn'); await a.evaluate(() => go('more'));
  const [dl] = await Promise.all([a.waitForEvent('download'), a.click('button:has-text("Save settings file")')]);
  const file = S + '/full-settings.json'; await dl.saveAs(file);
  // another, empty device
  const z = await fresh('Z');
  const before = await z.evaluate(() => buildLocator(settings).size);
  await z.click('#navBtn'); await z.evaluate(() => go('more'));
  await z.setInputFiles('input[type=file][accept=".json,application/json"]', file); await z.waitForTimeout(800);
  const msg = await z.$eval('#toast', x => x.textContent);
  const got = await z.evaluate(() => ({ settings: JSON.stringify({ ...settings, companyStoreAt: undefined, storeEditedAt: undefined }), bins: JSON.stringify(bins), boxes: buildLocator(settings).size }));
  ok('message says what was loaded', /4 aisles .* Bins \(12 items\).*inventory \(2 items\)/.test(msg), msg);
  ok('aisles, shelves, boxes, picking patterns, walking order: identical', got.settings === want.settings, `${before} boxes before, ${got.boxes} after`);
  ok('Bins: identical (items, sizes, bins, a second bin, settings)', got.bins === want.bins);
  for (let k = 0; k < 6 && await z.evaluate(() => view === 'settings'); k++) await z.click('#navBtn');
  await z.click('#exampleBtn');
  const pickZ = await z.evaluate(() => plan.picks.map(p => p.box + ':' + p.name).join(' > '));
  ok('the same orders give the exact same pick order on both', pickZ === pickA);
  await z.reload(); await z.waitForTimeout(800);
  ok('kept after closing and reopening', await z.evaluate(() => JSON.stringify({ ...settings, companyStoreAt: undefined, storeEditedAt: undefined })) === want.settings && await z.evaluate(() => JSON.stringify(bins)) === want.bins);
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? bad + ' FAILED' : 'all ok'); await b.close(); process.exit(bad ? 1 : 0); })();

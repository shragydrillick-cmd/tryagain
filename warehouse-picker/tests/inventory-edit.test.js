// Bins: adding and fully editing the inventory (Allow inventory changes on): a new item from its name, company,
// colours and sizes (every combination, SKUs from a start); scan its barcodes in order (a barcode used elsewhere is
// refused); add a colour; remove a size; edit details; delete the item; Undo brings it back.
const { chromium } = require('playwright'); require('./noauth')(chromium);
const BASE = process.argv[2] || 'http://localhost:8765/index.html';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('#navBtn'); await p.click('.tile:has(b:text-is("Bins"))');
  await p.click('button:has-text("Add a new item")');
  ok('adding needs Allow inventory changes', /Allow inventory changes first/.test(await p.$eval('#toast', x => x.textContent)));
  await p.evaluate(() => { bins = practiceBins(); bins.settings = { inventoryEdits: true }; saveBins(); go('bins'); });
  await p.click('button:has-text("Add a new item")');
  const type = async (label, text) => { await p.fill(`#settingsView input[aria-label="${label}"]`, text); await p.waitForTimeout(500); };
  await type('Item name', 'Cozy Knit Romper'); await type('Company', 'Bebe Organic'); await type('Colours / styles', 'Oat, Sage'); await type('Sizes', '0-3M, 3-6M, 6-12M'); await type('SKU start (optional)', 'bo7000');
  ok('the form counts every combination', /6 variants: Oat \/ 0-3M, Oat \/ 3-6M, Oat \/ 6-12M, Sage \/ 0-3M/.test(await p.$eval('#settingsView', x => x.innerText)));
  await p.click('button:has-text("Add the item (6 variants)")');
  const item = await p.evaluate(() => { const q = bins.products.find(x => x.title === 'Cozy Knit Romper'); return { n: q.variants.length, skus: q.variants.map(v => v.sku).join(','), vendor: q.vendor }; });
  ok('the item is there with its sizes and SKUs', item.n === 6 && /BO7000-OAT-0-3M/.test(item.skus) && item.vendor === 'Bebe Organic', item.skus);
  ok('it opens on its page: each size, with its barcode and how many', await p.evaluate(() => setPage === 'binsStock') && (await p.$$('#settingsView .stockrow')).length === 6);
  await p.click('#settingsView button:text-is("Details")');
  ok('its box opens, with Change this item', /Cozy Knit Romper.*6 variants.*Change this item.*Scan barcodes in order \(6 without one\)/.test(await p.$eval('#binSheet', x => x.innerText.replace(/\n+/g, ' '))));
  // scan the barcodes in order (typed into the scanner's box)
  await p.click('#binSheet button:has-text("Scan barcodes in order")');
  const scan = async c => { await p.fill('.scanner input[aria-label="Barcode or SKU"]', c); await p.click('.scanner button:text-is("OK")'); };
  await scan('7000000000011'); await scan('7000000000028');
  const used = await p.evaluate(() => bins.products[0].variants[0].barcode);
  await scan(used);
  ok('a barcode already used by another item is refused', /already used/.test(await p.$eval('.scanner .scanresult', x => x.innerText)));
  for (const c of ['7000000000035', '7000000000042', '7000000000059', '7000000000066']) await scan(c);
  await p.click('.scanner button:has-text("Done")');
  const codes = await p.evaluate(() => bins.products.find(x => x.title === 'Cozy Knit Romper').variants.map(v => optText(v) + '=' + v.barcode).join(', '));
  ok('each size got the next barcode, in order', /Oat \/ 0-3M=7000000000011, Oat \/ 3-6M=7000000000028, Oat \/ 6-12M=7000000000035.*Sage \/ 6-12M=7000000000066/.test(codes), codes);
  // add a colour (every size), remove a size, rename
  await p.fill('#binSheet input[aria-label="New colour"]', 'Rose'); await p.click('#binSheet button:text-is("Add")');
  ok('added a colour: every size made for it', await p.evaluate(() => bins.products.find(x => x.title === 'Cozy Knit Romper').variants.filter(v => v.colour === 'Rose').length === 3));
  await p.click('#binSheet .chip:has-text("6-12M") >> nth=0');
  await p.click('#binSheet button:has-text("Remove this size")'); await p.click('#binSheet button:has-text("Tap again")');
  ok('removed one size', await p.evaluate(() => bins.products.find(x => x.title === 'Cozy Knit Romper').variants.length === 8));
  await p.fill('#binSheet input[aria-label="Item name"]', 'Cozy Knit Romper Set'); await p.press('#binSheet input[aria-label="Item name"]', 'Tab'); await p.waitForTimeout(300);
  ok('renamed', await p.evaluate(() => bins.products.some(x => x.title === 'Cozy Knit Romper Set')));
  // delete the item, then Undo
  await p.evaluate(() => { const u = document.getElementById('binsUndo'); if (u) u.remove(); }); // the rename's Undo bar
  await p.click('#binSheet button:has-text("Delete this item")'); await p.click('#binSheet button:has-text("Tap again")');
  ok('deleted', await p.evaluate(() => !bins.products.some(x => x.title === 'Cozy Knit Romper Set')));
  await p.click('#binsUndo button:has-text("Undo")');
  ok('Undo brings it back', await p.evaluate(() => bins.products.some(x => x.title === 'Cozy Knit Romper Set' && x.variants.length === 8)));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

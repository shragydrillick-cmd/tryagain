// Inventory and bins with amounts: Inventory lists every item with how many (and how many still to put away); Scan to
// count in (a known barcode adds how many came in; a new barcode starts a new item with it); a new item's page sets each
// size's barcode and how many; Put away: scan an item, it says which bin and suggests every one not in a bin yet, other
// sizes of the same item can go with it, the bin's sticker confirms (the wrong bin warns); loading a bin (scan the bin,
// then items) suggests the amount and it can be changed; a bin's page shows and changes how many are in it.
const { chromium } = require('playwright'); require('./noauth')(chromium);
const BASE = process.argv[2] || 'http://localhost:8765/index.html';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pick-and-sort-test-features', '1'); }); await p.reload(); // the test address's features
  await p.click('#navBtn'); await p.click('.tile:has(b:text-is("Bins"))');
  const text = sel => p.$eval(sel, x => x.innerText.replace(/\s+/g, ' ')).catch(() => '');
  const scan = async c => { await p.fill('.scanner input[aria-label="Barcode or SKU"]', c); await p.click('.scanner button:text-is("OK")'); await p.waitForTimeout(150); };
  const result = () => text('.scanner .scanresult');
  const done = async () => { await p.click('.scanner button:has-text("Done")'); await p.waitForTimeout(200); };

  // a fresh device: Inventory works straight away (empty); new items need Allow inventory changes
  await p.click('#settingsView button:text-is("Inventory")');
  ok('Inventory on a fresh device: empty, with Scan to count in and Add a new item', /Nothing in the inventory yet/.test(await text('#settingsView')) && !!(await p.$('button:text-is("Scan to count in")')));
  await p.evaluate(() => { bins = practiceBins(); bins.settings = { inventoryEdits: true }; saveBins(); renderSettings(); });
  const rows = await p.$$eval('#settingsView .invrow', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
  ok('practice items: each with how many, and how many still to put away', rows.length === 12 && rows.some(r => /to put away/.test(r)) && rows.some(r => /all in bins/.test(r)), rows.slice(0, 3).join(' // '));

  // Scan to count in: a new barcode -> a new item with it
  await p.click('button:text-is("Scan to count in")'); await scan('0012345678905');
  ok('count in: a new barcode offers a new item', /New barcode.*0012345678905/.test(await result()));
  await p.click('.scanner button:has-text("Add a new item with it")');
  const type = async (label, t) => { await p.fill(`#settingsView input[aria-label="${label}"]`, t); await p.waitForTimeout(500); };
  ok('the new item form has the barcode', /Barcode 0012345678905/.test(await text('#settingsView')));
  await type('Item name', 'Cable Knit Sweater'); await type('Company', 'Lil Legs'); await type('Colours / styles', 'Cream, Navy'); await type('Sizes', '2T, 3T');
  await p.click('button:has-text("Add the item (4 variants)")');
  ok('its page: 4 sizes, the first has the scanned barcode', await p.evaluate(() => setPage) === 'binsStock' && (await p.$$('#settingsView .stockrow')).length === 4
    && await p.inputValue('input[aria-label="Barcode of Cream / 2T"]') === '0012345678905');
  await p.fill('input[aria-label="Barcode of Navy / 2T"]', '0012345678912'); await p.press('input[aria-label="Barcode of Navy / 2T"]', 'Tab');
  await p.fill('input[aria-label="How many Cream / 2T"]', '5'); await p.press('input[aria-label="How many Cream / 2T"]', 'Tab');
  await p.click('button[aria-label="How many Navy / 2T: one more"]'); await p.click('button[aria-label="How many Navy / 2T: one more"]'); await p.click('button[aria-label="How many Navy / 2T: one more"]');
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => { const q = bins.products.find(x => x.title === 'Cable Knit Sweater'); return q.variants.map(v => `${optText(v)}=${v.stock || 0}:${v.barcode}`).join(', '); });
  ok('how many of each, typed or with + (and the second barcode)', /Cream \/ 2T=5:0012345678905.*Navy \/ 2T=3:0012345678912/.test(st), st);
  ok('the page says 8 in the inventory, 8 not in a bin yet', /8 in the inventory · 8 not in a bin yet/.test(await text('#settingsView')));

  // Put away: scan the item: no bin yet, suggests all 5; the other size (Navy 2T, 3 waiting) can go too; scan the bin to confirm
  await p.click('#settingsView button:has-text("Put away (8)")'); await p.waitForTimeout(300);
  ok('put away: "No bin yet", how many = the 5 not in a bin', /No bin yet/.test(await result()) && await p.inputValue('.scanner input[aria-label="How many Cream / 2T"]') === '5');
  ok('…and the same item\'s other size waiting (Navy / 2T, 3) is offered', await p.inputValue('.scanner input[aria-label="How many Navy / 2T"]') === '3');
  await p.check('.scanner input[aria-label="Also put away Navy / 2T"]');
  await scan('C7');
  ok('scanned the bin: both put in C7', /8 put in C7/.test(await result()), await result());
  const c7 = await p.evaluate(() => bins.products.find(x => x.title === 'Cable Knit Sweater').variants.map(v => `${optText(v)}:${binAmounts(v)}:${unplacedQty(v)}`).join(', '));
  ok('C7 has 5 cream and 3 navy, nothing left to put away', /Cream \/ 2T:C7 \(5\):0.*Navy \/ 2T:C7 \(3\):0/.test(c7), c7);

  // more come in: count in the known barcode +4; put away: it says C7, a wrong bin warns, the right one confirms
  await done(); await p.click('#settingsView .backlink'); await p.click('button:text-is("Scan to count in")');
  await scan('0012345678905'); await p.fill('.scanner input[aria-label="How many came in"]', '4'); await p.click('.scanner button:has-text("Add to the inventory")');
  ok('count in: +4, 9 now, 4 not in a bin yet', /Cream \/ 2T: 9 now.*4 not in a bin yet/.test(await result()), await result());
  await done(); await p.click('#settingsView .backlink'); await p.click('#settingsView button:text-is("Put away")');
  await scan('0012345678905');
  ok('put away: it says it goes in C7, 4 of them', /Put in C7/.test(await result()) && await p.inputValue('.scanner input[aria-label="How many Cream / 2T"]') === '4');
  await scan('C8');
  ok('scanned the wrong bin: it warns', /goes in C7, not C8/.test(await result()));
  await p.click('.scanner button:text-is("Back")'); await scan('C7');
  ok('the right bin: 4 more in C7', /4 put in C7/.test(await result()) && await p.evaluate(() => binQty(bins.products.find(x => x.title === 'Cable Knit Sweater').variants[0], 'C7')) === 9);
  await done();

  // loading a bin: scan the bin, then an item; it suggests what's not in a bin yet, changed to 2
  const pv = await p.evaluate(() => { const x = allVariants().find(y => unplacedQty(y.v) >= 2 && y.v.bins.length); return { code: x.v.barcode, un: unplacedQty(x.v), bin: x.v.bins[0].bin, was: binQty(x.v, x.v.bins[0].bin), id: x.v.id }; });
  await p.evaluate(bin => { B.bin = bin; go('binsBin'); }, pv.bin); await p.click(`button:has-text("Scan items into ${pv.bin}")`);
  await scan(pv.code);
  ok('loading a bin: how many = what\'s not in a bin yet', await p.inputValue('.scanner input[aria-label="How many"]') === String(pv.un), `${pv.un}`);
  await p.fill('.scanner input[aria-label="How many"]', '2'); await p.click(".scanner .scanresult .row .btn:not(.secondary)");
  ok('…changed to 2: 2 more in the bin', await p.evaluate(([id, bin]) => binQty(allVariants().find(x => x.v.id === id).v, bin), [pv.id, pv.bin]) === pv.was + 2);
  await done();

  // a bin's page: how many of each, changed there
  await p.evaluate(() => { B.bin = 'C7'; go('binsBin'); });
  ok('the bin\'s page shows how many', await p.inputValue('input[aria-label="How many Cream / 2T in C7"]') === '9');
  await p.fill('input[aria-label="How many Cream / 2T in C7"]', '7'); await p.press('input[aria-label="How many Cream / 2T in C7"]', 'Tab'); await p.waitForTimeout(300);
  ok('…changed to 7: the other 2 show as not in a bin yet', await p.evaluate(() => { const v = bins.products.find(x => x.title === 'Cable Knit Sweater').variants[0]; return binQty(v, 'C7') === 7 && unplacedQty(v) === 2; }));
  // Bins home: the totals
  await p.evaluate(() => go('bins'));
  ok('Bins: Inventory and Put away, with the totals', /In the inventory: \d+ · not in a bin yet: \d+/.test(await text('#settingsView')) && !!(await p.$('#settingsView button:text-is("Put away")')));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

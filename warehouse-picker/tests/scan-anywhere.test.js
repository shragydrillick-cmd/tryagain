// The barcode scanner on a computer (test address): it types fast and presses Enter, and works on any page (not while
// typing in a box): an order's barcode opens it for packing (confirmed), then items count for it; on the main page an
// item on the list starts separating (no camera on a computer: the scanner's box) and goes onto its order, and the next
// scans go into that screen; an item in Bins opens its page, a bin sticker its bin. Typing slowly does nothing; a scan
// into a search box stays a search. A phone keeps the camera.
const { chromium } = require('playwright'); require('./noauth')(chromium);
const BASE = process.argv[2] || 'http://localhost:8765/index.html';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pick-and-sort-test-features', '1'); }); await p.reload();
  const scanner = async code => { await p.keyboard.type(code, { delay: 8 }); await p.keyboard.press('Enter'); await p.waitForTimeout(350); };
  const home = async () => { for (let k = 0; k < 6 && await p.evaluate(() => view === 'settings'); k++) await p.click('#navBtn'); };
  // packing: an order's barcode on the Settings page
  const o = await p.evaluate(() => practiceStore().orders[4]);
  await p.click('#navBtn'); await p.evaluate(() => go('more'));
  await scanner(o.number);
  ok('an order scanned on Settings: it opens for packing, sheet confirmed', await p.evaluate(n => !!pk && pk.o.number === n && pk.paper, o.number));
  await scanner(o.items[0].barcode);
  ok("then an item's barcode counts for that order", await p.evaluate(() => (pk.got.get(0) || 0) === 1));
  await p.evaluate(() => closePack());
  // separating: a list, and an item scanned on the main page
  await home(); await p.evaluate(() => document.getElementById('exampleBtn').click()); await p.waitForTimeout(500);
  const item = await p.evaluate(() => plan.unpack.find(u => u.barcode && u.qty === 1));
  await p.evaluate(() => { document.activeElement.blur(); pickedDone = new Set(plan.picks.map(k => k.step)); });
  await scanner(item.barcode);
  ok('an item scanned on the main page: separating opens, with no camera (the scanner box)', await p.isVisible('.scanner[aria-label="Scan to unpack"]') && !(await p.$('.scanner .scanview')));
  ok('…and the item went onto its order', await p.evaluate(s => unpackDone.has(s) || (placed.get(s) || 0) > 0, item.step), await p.$eval('.scanner .scanresult', x => x.innerText.replace(/\s+/g, ' ')).catch(() => ''));
  const item2 = await p.evaluate(s => plan.unpack.find(u => u.barcode && u.step !== s && u.qty === 1), item.step);
  await p.evaluate(() => document.activeElement.blur()); await scanner(item2.barcode);
  ok('the next scan (even with the box not selected) goes into the separating screen', await p.evaluate(s => unpackDone.has(s) || (placed.get(s) || 0) > 0, item2.step));
  await p.click('.scanner button:has-text("Done")');
  // Bins: an item opens its page, a bin sticker its bin
  await p.evaluate(() => { bins = practiceBins(); saveBins(); });
  const v = await p.evaluate(() => { const x = allVariants().find(y => y.v.bins.length); return { code: x.v.barcode, title: x.p.title, bin: x.v.bins[0].bin }; });
  await p.evaluate(() => document.activeElement.blur()); await scanner(v.code);
  ok("an item in Bins: its page opens", await p.evaluate(() => setPage === 'binsStock') && (await p.innerText('#settingsView')).includes(v.title));
  await scanner(v.bin);
  ok('a bin sticker: that bin opens', await p.evaluate(bin => setPage === 'binsBin' && B.bin === bin, v.bin), await p.evaluate(() => [view, setPage, B.bin, !!pk, !!scan.el, (document.getElementById('toast') || {}).textContent].join(' / ')) + ' ' + v.bin);
  // typing slowly, or into a box: nothing
  await home(); await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.type(o.number, { delay: 150 }); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok('typed slowly (a person, not a scanner): nothing opens', await p.evaluate(() => !pk));
  await p.click('#navBtn'); await p.evaluate(() => go('binsInventory'));
  await p.click('input[aria-label="Search the inventory"]'); await scanner(o.number);
  ok('scanned into a search box: it stays a search', await p.evaluate(() => !pk));
  // a phone keeps the camera
  const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage(); ph.on('pageerror', e => errs.push('phone: ' + e.message));
  await ph.goto(BASE); await ph.evaluate(() => { localStorage.clear(); localStorage.setItem('pick-and-sort-test-features', '1'); }); await ph.reload();
  await ph.evaluate(() => document.getElementById('exampleBtn').click()); await ph.waitForTimeout(400); await ph.evaluate(() => document.getElementById('scanUnpackBtn').click()); await ph.waitForTimeout(300);
  ok('a phone: separating uses the camera', !!(await ph.$('.scanner .scanview')));
  // inside the Shopify app on a phone: Shopify's own scanner (a pretend one that reads the codes it's given, then is closed)
  const sc = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await sc.addInitScript(() => { window.__codes = []; window.shopify = { idToken: async () => 'x', scanner: { capture: () => new Promise((ok, no) => setTimeout(() => window.__codes.length ? ok({ data: window.__codes.shift() }) : no(new Error('closed')), 80)) } }; });
  const sp = await sc.newPage(); sp.on('pageerror', e => errs.push('in shopify: ' + e.message));
  await sp.goto(BASE); await sp.evaluate(() => { localStorage.clear(); localStorage.setItem('pick-and-sort-test-features', '1'); localStorage.setItem('pick-and-sort-test-noauth', '1'); }); await sp.reload();
  await sp.evaluate(() => document.getElementById('exampleBtn').click()); await sp.waitForTimeout(400);
  const two = await sp.evaluate(() => { pickedDone = new Set(plan.picks.map(k => k.step)); const us = plan.unpack.filter(u => u.barcode && u.qty === 1).slice(0, 2); window.__codes = us.map(u => u.barcode); return us.map(u => u.step); });
  await sp.evaluate(() => document.getElementById('scanUnpackBtn').click()); await sp.waitForTimeout(1200);
  ok("inside the Shopify app: separating uses Shopify's scanner (no camera), each scan goes onto its order", !(await sp.$('.scanner .scanview')) && await sp.evaluate(s => s.every(x => unpackDone.has(x) || (placed.get(x) || 0) > 0), two));
  ok('…and when the scanner is closed, a Scan button carries on', await sp.isVisible('.scanner .shopscan button:text-is("Scan")'));
  await sp.click('.scanner button:has-text("Done")');
  const po = await sp.evaluate(() => { const o = practiceStore().orders[2]; window.__codes = [o.number, o.items[0].barcode]; startPack(findPackOrder(o.number), false); return o.number; });
  await sp.waitForTimeout(1000);
  ok("inside the Shopify app: packing uses Shopify's scanner (the sheet, then an item)", await sp.evaluate(n => pk && pk.o.number === n && pk.paper && (pk.got.get(0) || 0) === 1, po) && !(await sp.$('#packVideo')));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

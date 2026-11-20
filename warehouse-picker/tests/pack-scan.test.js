// Packing by scanning (the test address): the order sheet's barcode (drawn by the app) scans; the pack screen wants
// the sheet first, then each item (green), refuses a wrong order's sheet and extra items; when all are green the
// camera goes and Pack & Print / Pack shows; Pack adds the packed time and tag; Find an order filters as you type and
// sorts; Scan an order opens it. Codes are typed into the screen's own box (a scanner or the camera does the same).
const { chromium } = require('playwright'); require('./noauth')(chromium);
const BASE = process.argv[2] || 'http://localhost:8765/index.html';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('pick-and-sort-test-features', '1'); } catch (e) {} });
  await p.goto(BASE);
  const txt = s => p.$eval(s, x => x.innerText.replace(/\n+/g, ' | '));
  const type = async code => { await p.fill('#packScreen input[aria-label="Type a code"]', code); await p.press('#packScreen input[aria-label="Type a code"]', 'Enter'); };

  // 1. the Code 128 barcodes the app draws read back exactly (on screen and from the printed slip)
  const back = await p.evaluate(async () => {
    const read = await barcodeReader(), out = [];
    for (const t of ['70012', 'A151', 'K683BLK8Y', '53796']) {
      const w = await code128(t), cv = document.createElement('canvas'), m = 3; cv.width = (w.reduce((a, b) => a + b, 0) + 20) * m; cv.height = 120;
      const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#000';
      let cx = 10 * m; w.forEach((wd, i) => { if (i % 2 === 0) x.fillRect(cx, 10, wd * m, 100); cx += wd * m; });
      out.push(await read(cv));
    }
    return out.join(',');
  });
  ok('barcodes the app draws scan back exactly', back === '70012,A151,K683BLK8Y,53796', back);
  const slip = await p.evaluate(async () => {
    const o = practiceStore().orders[11]; const doc = newDoc();
    // the same slip as "Print this order's packing slip", rendered like the printed page, then the top right read
    let blob = null; await packingSlipPdf({ ...o, units: 1 }, bl => { blob = bl; });
    await loadPdfJs(); const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise, page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 2 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    const crop = document.createElement('canvas'); crop.width = 420; crop.height = 120; crop.getContext('2d').drawImage(cv, 800, 90, 420, 120, 0, 0, 420, 120);
    return { want: o.number, read: await (await barcodeReader())(crop) };
  });
  ok('the packing slip PDF\'s order barcode scans', slip.read === slip.want, `${slip.read} / ${slip.want}`);

  // 2. a list of orders, all sorted onto their piles -> ready to pack
  await p.click('#exampleBtn');
  await p.evaluate(() => { plan.unpack.forEach(u => unpackDone.add(u.step)); saveList(); });
  await p.click('#packBtn');
  ok('Packing: ready orders with Pack, and Scan an order / Find an order at the bottom', /Ready to pack: 5.*Pack.*Scan an order.*Find an order/.test(await txt('#packPanel')));
  const first = await p.evaluate(() => plan.orders.find(o => orderReady(o.label)).raw);
  await p.click('#packPanel .packcard >> nth=0 >> button:text-is("Pack")');
  ok('on a computer: no camera, the order full screen, the box ready for a scanner', !(await p.$('#packScreen .packcam')) && /Order #/.test(await txt('#packScreen'))
    && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label') === 'Type a code'));
  const o = await p.evaluate(() => ({ number: pk.o.number, items: pk.o.items.map(i => [i.barcode, i.qty]) }));
  await type(o.items[0][0]);
  ok('an item before the sheet: asks for the sheet first', /Scan the order sheet first/.test(await txt('#packScreen .packmsg')));
  const other = await p.evaluate(n => plan.orders.find(x => String(x.raw) !== n).raw, o.number);
  await type(String(other));
  ok('another order\'s sheet: says so, offers to open it', new RegExp(`sheet for order #${other}.*Open #${other}`).test(await txt('#packScreen .packmsg')));
  await type(o.number);
  ok('the right sheet: confirmed', /Order sheet: confirmed/.test(await txt('#packScreen')));
  await type('5012345009999');
  ok('an item not in the order: refused', /not in this order/.test(await txt('#packScreen .packmsg')));
  for (const [code, qty] of o.items) for (let k = 0; k < qty; k++) if (!(await p.$('#packScreen.done'))) await type(code);
  ok('every item green: camera gone, Pack & Print at the bottom', !(await p.$('#packScreen .packcam')) && /Pack & Print/.test(await txt('#packScreen .packactions')));
  await p.click('#packScreen .splitmore');
  ok('the little arrow: Pack only / Print label only', /Pack only.*Print label only/.test(await txt('#packScreen .packactions')));
  // (the test browser has no PDF viewer, so the print window is a stand-in that records what it was sent)
  await p.evaluate(() => { window.__printed = []; window.open = () => ({ closed: false, close() {}, document: { write() {} }, location: { set href(v) { window.__printed.push(v); } } }); });
  await p.click('#packScreen .splitbtn .btn >> nth=0'); await p.waitForTimeout(1500);
  const sent = await p.evaluate(() => window.__printed);
  ok('Pack & Print: packed with its time and tag, and the label goes to a new window to print (not a download)', /Packed\. Tag added: "Packed /.test(await txt('#packScreen')) && sent.length === 1 && /^blob:/.test(sent[0]) && await p.evaluate(n => packed.has(n), first), (sent[0] || '').slice(0, 20));
  await p.click('#packScreen button:has-text("Back to Packing")');
  ok('back on Packing: that order is packed', new RegExp(`Order #${first}.*Packed`).test(await txt('#packPanel')));

  // 3. Find an order: type to filter, sort, delivery kind
  await p.click('#packPanel button:has-text("Find an order")');
  const all = await p.evaluate(() => document.querySelectorAll('#packFind .dlist .drow').length);
  await p.fill('#packFind input[type=search]', 'monsey'); await p.waitForTimeout(400);
  const mons = await p.$$eval('#packFind .dlist .drow', r => r.map(x => x.innerText));
  ok('typing filters (an area)', mons.length > 0 && mons.length < all && mons.every(x => /Monsey/.test(x)), `${mons.length} of ${all}`);
  await p.fill('#packFind input[type=search]', '5012345000077'); await p.waitForTimeout(400);
  const ties = await p.evaluate(() => [...document.querySelectorAll('#packFind .dlist .drow')].map(x => x.innerText.match(/#(\d+)/)[1]));
  ok('typing an item\'s barcode finds every order with it', ties.length > 0 && await p.evaluate(ns => ns.every(n => findPackOrder(n).items.some(i => i.barcode === '5012345000077')), ties));
  await p.fill('#packFind input[type=search]', ''); await p.waitForTimeout(300);
  await p.selectOption('#packFind select[aria-label="Sort"]', 'delivery');
  const dd = await p.evaluate(() => [...document.querySelectorAll('#packFind .dlist .drow')].map(x => x.innerText.match(/#(\d+)/)[1]).map(n => findPackOrder(n).delivery.date || 9e15));
  ok('sort by delivery date', dd.every((d, i) => !i || d >= dd[i - 1]));
  await p.selectOption('#packFind select[aria-label="Delivery"]', 'shipping');
  ok('only UPS / shipped orders', (await p.$$eval('#packFind .dlist .drow', r => r.map(x => x.innerText))).every(x => /UPS/.test(x)));
  await p.click('#packFind .dlist .drow >> nth=0');
  ok('tap an order: it opens to pack (a UPS order says Pack, not Pack & Print)', !!(await p.$('#packScreen')) && await p.evaluate(() => pk.o.delivery.type === 'shipping'));
  await p.evaluate(() => { pk.paper = true; pk.o.items.forEach((it, i) => pk.got.set(i, it.qty)); drawPack(); });
  ok('…when all green its button is Pack', /^Pack\b/.test((await txt('#packScreen .splitbtn')).trim()) && !/Pack & Print/.test(await txt('#packScreen .splitbtn')));
  await p.click('#packScreen button:text-is("Back")');

  // 4. Scan an order (any order, even one that wasn't picked with the app)
  await p.click('#packPanel button:has-text("Scan an order")'); await p.waitForTimeout(200);
  ok('Scan an order on a computer: a box ready for the scanner (no camera)', !(await p.$('.scanner')) && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label') === 'Order number'));
  await p.keyboard.type('70005'); await p.keyboard.press('Enter');
  ok('…scanning the sheet opens the order, already confirmed', await p.evaluate(() => pk && pk.o.number === '70005' && pk.paper));
  // a phone: the camera on top
  const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
  await ph.addInitScript(() => { try { localStorage.setItem('pick-and-sort-test-features', '1'); } catch (e) {} });
  await ph.goto(BASE); await ph.click('#exampleBtn'); await ph.evaluate(() => startPack(findPackOrder('70001'), false));
  ok('on a phone: the camera on top, the order below', !!(await ph.$('#packScreen .packcam video')) && !!(await ph.$('#packScreen .packwrap')));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

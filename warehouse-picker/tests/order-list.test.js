// The test address: Add orders, your list, Pick & Print, and the side menu. Tick orders and Add to list (it stays open:
// one area, then another), see and trim your list, then Pick & Print: onto the pick list (straight to it) and an order
// sheet each, in sorting order, with the sorting number big and each item's bin. Just print / just pick. With orders on
// the pick list already: add these to it, start new, or cancel. The menu: tap opens, tap outside closes; a mouse
// hovering opens it, leaving closes it, a click keeps it open; each item goes where it says.
const { chromium } = require('playwright'); require('./noauth')(chromium);
const BASE = process.argv[2] || 'http://localhost:8765/index.html';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1200, height: 850 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pick-and-sort-test-features', '1'); }); await p.reload();
  await p.evaluate(() => { window.__sheets = []; window.__sheetsSink = async blob => { await loadPdfJs(); const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
    for (let i = 1; i <= pdf.numPages; i++) { const t = await (await pdf.getPage(i)).getTextContent(); window.__sheets.push(t.items.map(x => x.str).join(' ')); } window.__sheetsDone = true; }; });
  // the menu: a click keeps it open; a click outside closes it
  ok('the menu button at the top left', await p.isVisible('#menuBtn'));
  await p.click('#menuBtn');
  ok('clicked: the menu is open, with every place', await p.evaluate(() => sideMenu.isOpen() && sideMenu.isPinned()) && /Add orders[\s\S]*Find an order[\s\S]*Pick list[\s\S]*Sort list[\s\S]*Packing[\s\S]*Catalog[\s\S]*Bins[\s\S]*Put away[\s\S]*Settings/.test(await p.innerText('#sideMenu')));
  await p.mouse.click(900, 500); await p.waitForTimeout(250);
  ok('a click outside closes it', await p.evaluate(() => !sideMenu.isOpen()));
  await p.hover('#menuBtn'); await p.waitForTimeout(200);
  ok('a mouse over the button opens it', await p.evaluate(() => sideMenu.isOpen() && !sideMenu.isPinned()));
  await p.hover('#sideMenu .sideitem >> nth=2'); await p.waitForTimeout(150); await p.mouse.move(900, 600); await p.waitForTimeout(600);
  ok('moving the mouse away closes it', await p.evaluate(() => !sideMenu.isOpen()));
  // Add orders from the menu; one area, Add to list; another area, Add to list
  await p.click('#menuBtn'); await p.click('#sideMenu button:has-text("Add orders")'); await p.waitForTimeout(400);
  ok('menu: Add orders opens it (and the menu closes)', await p.isVisible('#addOrders') && await p.evaluate(() => !sideMenu.isOpen()));
  const areas = await p.$$eval('#addOrders select[aria-label="Area"] option', o => o.map(x => x.value).filter(Boolean));
  await p.selectOption('#addOrders select[aria-label="Area"]', areas[0]); await p.check('#addOrders input[aria-label="Select all shown"]');
  const n1 = await p.evaluate(() => ao.chosen.size);
  await p.click('#addOrders button:has-text("Add to list")');
  ok(`Add to list: ${n1} orders in your list, the screen stays open`, await p.evaluate(() => stage.size) === n1 && await p.isVisible('#addOrders') && new RegExp(`Your list: ${n1} orders`).test(await p.innerText('#addOrders .aobar')));
  ok('…and they no longer show as ones to choose', (await p.$$('#addOrders .aorow')).length === 0);
  await p.selectOption('#addOrders select[aria-label="Area"]', areas[1]);
  await p.check('#addOrders .aorow input >> nth=0'); await p.check('#addOrders .aorow input >> nth=1');
  await p.click('#addOrders button:has-text("Add to list (2)")');
  ok('another area: 2 more added to your list', await p.evaluate(() => stage.size) === n1 + 2);
  await p.click('#addOrders .aobar button:text-is("See")');
  const first = await p.evaluate(() => [...stage.keys()][0]);
  await p.click(`#addOrders button[aria-label="Take #${first} out of the list"]`);
  ok('See: the list, and one taken out', await p.evaluate(() => stage.size) === n1 + 1);
  const listed = await p.evaluate(() => [...stage.keys()]);
  // Pick & Print
  await p.click('#addOrders .aobar button:has-text("Pick & Print")'); await p.waitForFunction(() => window.__sheetsDone, null, { timeout: 15000 }).catch(() => {});
  const onPick = await p.evaluate(() => plan ? plan.orders.map(o => String(o.raw)) : []);
  ok('Pick & Print: every order in the list is on the pick list', listed.every(x => onPick.includes(x)) && onPick.length === listed.length, onPick.join(','));
  ok('…the pick list is showing, Add orders closed, your list emptied', await p.evaluate(() => !ao && stage.size === 0 && document.querySelector('.tabs button.on').dataset.tab === 'pick') && await p.isVisible('#results'));
  const sheets = await p.evaluate(() => window.__sheets), labels = await p.evaluate(() => plan.orders.slice().sort((a, b) => a.label - b.label).map(o => [String(o.label), String(o.raw)]));
  ok('…an order sheet each, in sorting order, each with its sorting number and order number', sheets.length === listed.length && labels.every(([l, raw], i) => sheets[i].includes('SORT #') && sheets[i].split(/\s+/).includes(l) && sheets[i].includes(`Order #${raw}`)), sheets.map(x => x.slice(0, 50)).join(' | '));
  ok('…with each item and its bin', sheets.every(t => /Bin\s+Item\s+Qty/.test(t) && /Total items: \d+/.test(t)), sheets[0].slice(0, 300));
  // again: orders already on the pick list: add these / start new / cancel
  await p.evaluate(() => { window.__sheets = []; window.__sheetsDone = false; openAddOrders(); });
  await p.check('#addOrders .aorow input >> nth=0'); await p.click('#addOrders button:has-text("Add to list (1)")');
  await p.click('#addOrders .aobar button[aria-label="Other choices"]'); await p.click('#addOrders .packmenu button:text-is("Just pick")');
  ok('orders already on the pick list: it asks (add these / start new / cancel)', /already \d+ orders on the pick list[\s\S]*Add these to it[\s\S]*Start new with these[\s\S]*Cancel/.test(await p.innerText('#addOrders .aobar')));
  await p.click('#addOrders button:text-is("Cancel")');
  ok('Cancel: nothing changes', await p.evaluate(n => plan.orders.length === n && stage.size === 1 && !!ao, onPick.length));
  await p.click('#addOrders .aobar button:has-text("Just pick")'); await p.click('#addOrders button:text-is("Add these to it")'); await p.waitForTimeout(500);
  ok('Just pick, Add these to it: one more on the pick list, nothing printed', await p.evaluate(n => plan.orders.length === n + 1 && window.__sheets.length === 0, onPick.length));
  await p.evaluate(() => openAddOrders()); await p.check('#addOrders .aorow input >> nth=0'); await p.click('#addOrders button:has-text("Add to list (1)")');
  await p.click('#addOrders .aobar button[aria-label="Other choices"]'); await p.click('#addOrders .packmenu button:text-is("Just print")'); await p.waitForFunction(() => window.__sheetsDone, null, { timeout: 10000 }).catch(() => {});
  ok('Just print: a sheet, the pick list unchanged', await p.evaluate(n => plan.orders.length === n + 1 && window.__sheets.length === 1, onPick.length));
  // the menu's other places
  const visit = async (label, check) => { await p.click('#menuBtn'); await p.click(`#sideMenu button:has-text("${label}")`); await p.waitForTimeout(300); return p.evaluate(check); };
  ok('menu: Sort list', await visit('Sort list', () => view === 'home' && document.querySelector('.tabs button.on').dataset.tab === 'unpack'));
  ok('menu: Packing', await visit('Packing', () => !!document.getElementById('packPanel')));
  ok('menu: Catalog (from Packing: it closes first)', await visit('Catalog', () => view === 'settings' && /^bins/.test(setPage) && !document.getElementById('packPanel')));
  ok('menu: Pick list (from Settings)', await visit('Pick list', () => view === 'home' && document.querySelector('.tabs button.on').dataset.tab === 'pick'));
  ok('menu: Settings', await visit('Settings', () => view === 'settings' && setPage === 'home'));
  // a phone: tap opens, tap outside closes
  const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage(); ph.on('pageerror', e => errs.push('phone: ' + e.message));
  await ph.goto(BASE); await ph.evaluate(() => { localStorage.clear(); localStorage.setItem('pick-and-sort-test-features', '1'); }); await ph.reload();
  await ph.tap('#menuBtn'); await ph.waitForTimeout(250);
  ok('phone: a tap opens the menu', await ph.evaluate(() => sideMenu.isOpen()) && await ph.isVisible('#sideMenu .sideitem >> nth=0'));
  await ph.tap('#menuShade', { position: { x: 360, y: 500 } }); await ph.waitForTimeout(250);
  ok('phone: a tap outside closes it', await ph.evaluate(() => !sideMenu.isOpen()));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

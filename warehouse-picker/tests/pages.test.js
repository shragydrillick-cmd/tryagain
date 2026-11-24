// The test address, one page per job: Orders (just the orders: number, where, when, status, due; nothing else under it),
// Pick (Step by step; the pick list and its PDF only if wanted), Sort (straight into the scanner; the list of picked items
// if wanted), no Packing button at the top (it's in the menu). Statuses follow an order from New to Packed. Tapping an
// order opens its page (items with bins; pack it, print its papers, add it to your list). Deadlines: due today, late,
// tomorrow; the reminder before the driver comes.
const { chromium } = require('playwright'); require('./noauth')(chromium);
const BASE = process.argv[2] || 'http://localhost:8765/index.html';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1200, height: 850 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pick-and-sort-test-features', '1'); }); await p.reload(); await p.waitForTimeout(300);
  ok('opens on Create list (nothing on the list yet); no Packing button at the top', await p.evaluate(() => uiPage === 'create') && await p.isVisible('#addOrders') && !(await p.isVisible('#packBtn')));
  ok('the old Orders box (with its ?) is not shown anywhere', !(await p.isVisible('#ordersCard')) && !(await p.isVisible('#ordersHelp')));
  ok('the page has nothing else under it (no pick list, step by step, tabs)', !(await p.isVisible('#results')) && !(await p.isVisible('#stepPickBtn')));
  const row = await p.$eval('#addOrders .aorow', x => x.innerText.replace(/\s+/g, ' '));
  const o0 = await p.evaluate(() => aoShown()[0]);
  ok('an order row: number, where, when and its status, not its items', row.includes(`#${o0.number}`) && row.includes(o0.city) && /Unfulfilled/.test(row) && !row.includes(o0.items[0].name), row);
  // its own page
  await p.click(`#addOrders button[aria-label="Open order ${o0.number}"]`);
  const pg = await p.innerText('#orderPage');
  ok("tapping the order opens its page: who, where, every item with its bin", pg.includes(`Order #${o0.number}`) && pg.includes(o0.customer) && o0.items.every(it => pg.includes(it.name)));
  ok("the order's page: the order and its items; everything else under one Actions button", !(await p.isVisible('#orderPage .orderacts')) && await p.isVisible('#orderPage button:has-text("Actions")'));
  await p.click('#orderPage button:has-text("Actions")');
  const acts = await p.innerText('#orderPage .orderacts');
  ok('Actions: pack it, packing slip (one, not also an order sheet), add to your list', /Pack it now[\s\S]*Packing slip[\s\S]*Add to your list/.test(acts) && !/Order sheet/.test(acts), acts.replace(/\s+/g, ' '));
  await p.click('#orderPage button:text-is("Add to your list")'); await p.click('#orderPage button:has-text("Actions")');
  ok('Add to your list from its page: status In your list', await p.evaluate(n => stage.has(n) && orderStage({ number: n }).text === 'In your list', o0.number) && /In your list/.test(await p.innerText('#orderPage')));
  await p.click('#orderPage button:text-is("Pack it now")'); await p.waitForTimeout(300);
  ok('Pack it now: the pack screen for that order', await p.evaluate(n => !!pk && pk.o.number === n, o0.number));
  await p.evaluate(() => closePack());
  // pick it: statuses as it goes
  await p.evaluate(() => runStage('pick')); await p.waitForTimeout(500);
  ok('picked: the Pick page, with Step by step; the list only when asked', await p.evaluate(() => uiPage === 'pick') && await p.isVisible('#pageCtl button:text-is("Step by step")') && !(await p.isVisible('#tab-pick')) && !(await p.isVisible('.actcols')));
  await p.click('#pageCtl button:has-text("Pick list")');
  ok('…Pick list (tick items) shows the list to tick', await p.isVisible('#tab-pick'));
  await p.click('#pageCtl button:has-text("Hide the pick list")');
  // step by step has a List button that shows the pick list
  await p.click('#pageCtl button:text-is("Step by step")'); await p.waitForTimeout(300);
  await p.click('#stepList');
  ok('step by step → List: back on the Pick page with the list showing', await p.evaluate(() => uiPage === 'pick' && document.body.dataset.list === 'on') && await p.isVisible('#tab-pick'));
  const st = () => p.evaluate(n => orderStage({ number: n }).text, o0.number);
  ok('status: On pick list', await st() === 'On pick list');
  await p.evaluate(n => { const po = plan.orders.find(x => String(x.raw) === n); const k = pickOf(plan.unpack.find(u => u.label === po.label)); pickedDone.add(k.step); }, o0.number);
  const all1 = await p.evaluate(n => plan.unpack.filter(u => u.label === plan.orders.find(x => String(x.raw) === n).label).length, o0.number);
  ok(`status: one item picked → ${all1 > 1 ? 'Started picking' : 'Picked'}`, await st() === (all1 > 1 ? 'Started picking' : 'Picked'));
  await p.evaluate(n => { const po = plan.orders.find(x => String(x.raw) === n); plan.unpack.filter(u => u.label === po.label).forEach(u => { const k = pickOf(u); pickedDone.add(k.step); }); }, o0.number);
  ok('status: all picked → Picked', await st() === 'Picked');
  await p.evaluate(n => { const po = plan.orders.find(x => String(x.raw) === n); const u = plan.unpack.find(x => x.label === po.label); placed.set(u.step, 1); }, o0.number);
  ok('status: one sorted → Started sorting (or Ready to pack if that was all)', /Started sorting|Sorted, ready to pack/.test(await st()));
  await p.evaluate(n => { const po = plan.orders.find(x => String(x.raw) === n); plan.unpack.filter(u => u.label === po.label).forEach(u => unpackDone.add(u.step)); }, o0.number);
  ok('status: all sorted → Ready to pack', await st() === 'Sorted, ready to pack');
  await p.evaluate(n => packed.set(plan.orders.find(x => String(x.raw) === n).raw, Date.now()), o0.number);
  ok('status: packed → Packed with its time', /^Packed \w{3} \d+, \d+:\d\d/.test(await st()), await st());
  // the List page: counts; its orders and items with where they're up to; take things off
  await p.evaluate(() => { stage.clear(); aoOrders().slice(0, 4).forEach(o => stage.set(o.number, o)); runStage('pick'); });
  await p.waitForTimeout(300); await p.click('.fsheet button:text-is("Cancel")').catch(() => {});
  await p.click('#addOrders button:text-is("Start new with these")').catch(() => {}); await p.waitForTimeout(400);
  await p.evaluate(() => showPage('list'));
  const lt = await p.innerText('#listPage');
  ok('List: how many orders, how many to pick, bins to visit', /4 orders[\s\S]*\d+ to pick[\s\S]*bins? to visit/.test(lt) && !(await p.isVisible('#results')), lt.slice(0, 120));
  await p.click('#listPage .listtile:has-text("to pick")');
  await p.evaluate(() => { const u = plan.unpack[plan.unpack.length - 1]; pickedDone.add(pickOf(u).step); drawListPage(); });
  const items = await p.$$eval('#listPage .dlist .drow', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
  ok('Items: each with its status, the ones not picked first', items.length >= 4 && /Not picked/.test(items[0]) && /Picked/.test(items[items.length - 1]), items[0].slice(0, 80) + ' … ' + items[items.length - 1].slice(0, 80));
  await p.click('#listPage .listtile:has-text("orders")');
  const before = await p.evaluate(() => plan.orders.length), first = await p.evaluate(() => String(plan.orders.slice().sort((a, b) => a.label - b.label)[0].raw));
  await p.click('#listPage .dlist .drow >> nth=0 >> button:text-is("Remove")'); await p.click('#listPage button:has-text("Tap again")');
  ok('Orders: one taken off the list', await p.evaluate(([n, f]) => plan.orders.length === n - 1 && !plan.orders.some(o => String(o.raw) === f), [before, first]));
  // an order packed before it was on the list (from its own page): once added, the List counts it as packed, its items done
  const pre = await p.evaluate(async () => {
    const o = aoOrders().find(x => !onList(x.number) && orderStage(x).key === 'new');
    startPack(findPackOrder(o.number), true); pk.o.items.forEach((it, i) => pk.got.set(i, it.qty)); await packAction('pack'); closePack();
    stage.clear(); stage.set(o.number, o); return o.number;
  });
  await p.evaluate(() => runStage('pick')); await p.waitForTimeout(300); await p.click('#addOrders button:text-is("Add these to it")'); await p.waitForTimeout(400);
  await p.evaluate(() => { listView = 'items'; showPage('list'); });
  const counts = await p.evaluate(n => { const po = plan.orders.find(o => String(o.raw) === n); return { packedTile: plan.orders.filter(o => packed.has(o.raw)).length, itemsPacked: plan.unpack.filter(u => u.label === po.label).every(u => lineStage(u).text === 'Packed'), stage: orderStage({ number: n }).text }; }, pre);
  ok('packed before it was on the list: the List counts it packed, its items Packed, same as its status', counts.packedTile >= 1 && counts.itemsPacked && /^Packed/.test(counts.stage) && /\d+ packed/.test(await p.innerText('#listPage')), JSON.stringify(counts));
  // Pick: straight to it, no box of text around; Sort: straight into the scanner (a computer: the scanner's box)
  await p.evaluate(() => showPage('pick'));
  ok('Pick: the big Step by step, no "Your lists" box or file name', await p.isVisible('#pageCtl button:text-is("Step by step")') && !(await p.isVisible('#results > h2')) && !(await p.isVisible('#fileName')));
  await p.evaluate(() => showPage('sort', { scan: true })); await p.waitForTimeout(300);
  ok('Sort: straight into scanning; on a computer the scanner box (no camera, no Scan button)', await p.isVisible('.scanner input[aria-label="Barcode or SKU"]') && !(await p.$('.scanner .scanview')) && !(await p.$('.scanner .shopscan')));
  await p.click('.scanner button:text-is("List")'); await p.waitForTimeout(300);
  ok('the sort scanner has List: back on Sort with the list to tick', await p.evaluate(() => uiPage === 'sort' && document.body.dataset.list === 'on' && !scan.el) && await p.isVisible('#tab-unpack'));
  await p.evaluate(() => showPage('sort', { scan: true })); await p.waitForTimeout(300);
  await p.click('.scanner button:has-text("Done")');
  // deadlines
  const due = await p.evaluate(() => {
    settings.deadlines = [{ on: true, kind: 'any', area: '', cutoff: '12:00', driver: '16:00', remind: 15 }];
    const day = startOfDay(Date.now()), at = (d, h) => d + h * 36e5, now = at(day, 13);
    const mk = c => ({ number: 'T' + c, created: c, delivery: { type: 'local' }, city: 'Brooklyn', items: [] });
    return [dueOf(mk(at(day, 10)), now).text, dueOf(mk(at(day, 13.5)), now).text, dueOf(mk(at(day - 864e5, 10)), now).text, dueOf(mk(at(day, 10)), at(day, 17)).text];
  });
  ok('deadlines: in by 12 → Due today; after 12 → Tomorrow; yesterday → Late; after the driver left → Late', /^Due today/.test(due[0]) && /^Due tomorrow/.test(due[1]) && due[2] === 'Late' && due[3] === 'Late', due.join(' | '));
  await p.evaluate(() => { localStorage.removeItem('pick-and-sort-reminded-v1'); const day = startOfDay(Date.now()); practiceStore().orders.push({ number: '79999', created: day + 9 * 36e5, customer: 'Due Test', address: '1 Main St', city: 'Brooklyn', zip: '11219', delivery: { type: 'local', title: 'Local' }, tags: [], items: [{ name: 'Notebook', details: '', sku: 'NB', barcode: '5012345000039', bin: 'A14', qty: 1 }] }); checkDeadlines(day + 15.8 * 36e5); });
  const alert = await p.$eval('#dueAlert', x => x.innerText.replace(/\s+/g, ' ')).catch(() => '');
  ok('the reminder before the driver comes: how many due today aren\'t ready', /\d+ orders? due by .* (isn't|aren't) ready yet/.test(alert) && /#\d+ \(Unfulfilled\)/.test(alert), alert.slice(0, 200));
  await p.evaluate(() => { document.getElementById('dueAlert').remove(); checkDeadlines(startOfDay(Date.now()) + 15.85 * 36e5); });
  ok('…once (not again a minute later)', !(await p.$('#dueAlert')));
  await p.click('#navBtn'); await p.evaluate(() => go('more'));
  ok('Settings → More → Deadlines: the rule to change', /Deadlines[\s\S]*Orders in by[\s\S]*Driver comes at[\s\S]*Remind/.test(await p.innerText('#settingsView')));
  // inside Shopify on a computer: the scanner box too (Shopify's own scanner is for phones)
  const sc = await b.newContext({ viewport: { width: 1200, height: 800 } });
  await sc.addInitScript(() => { window.shopify = { idToken: async () => 'x', scanner: { capture: () => new Promise(() => {}) } }; });
  const sp = await sc.newPage(); sp.on('pageerror', e => errs.push('in shopify: ' + e.message));
  await sp.goto(BASE); await sp.evaluate(() => { localStorage.clear(); localStorage.setItem('pick-and-sort-test-features', '1'); localStorage.setItem('pick-and-sort-test-noauth', '1'); localStorage.setItem('pick-and-sort-scan-mode', 'camera'); }); await sp.reload();
  await sp.evaluate(() => document.getElementById('exampleBtn').click()); await sp.waitForTimeout(400); await sp.evaluate(() => document.getElementById('scanUnpackBtn').click()); await sp.waitForTimeout(300);
  ok("inside Shopify on a computer: the scanner box, not Shopify's scanner (even with the camera chosen)", await sp.isVisible('.scanner input[aria-label="Barcode or SKU"]') && !(await sp.$('.scanner .shopscan')));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

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
  ok('opens on the Orders page; no Packing button at the top', await p.evaluate(() => uiPage === 'orders') && await p.isVisible('#addOrders') && !(await p.isVisible('#packBtn')));
  ok('the Orders page has nothing else under it (no pick list, step by step, tabs)', !(await p.isVisible('#results')) && !(await p.isVisible('#stepPickBtn')));
  const row = await p.$eval('#addOrders .aorow', x => x.innerText.replace(/\s+/g, ' '));
  const o0 = await p.evaluate(() => aoShown()[0]);
  ok('an order row: number, where, when and its status, not its items', row.includes(`#${o0.number}`) && row.includes(o0.city) && /New/.test(row) && !row.includes(o0.items[0].name), row);
  // its own page
  await p.click(`#addOrders button[aria-label="Open order ${o0.number}"]`);
  const pg = await p.innerText('#orderPage');
  ok("tapping the order opens its page: who, where, every item with its bin", pg.includes(`Order #${o0.number}`) && pg.includes(o0.customer) && o0.items.every(it => pg.includes(it.name)));
  ok('…with what can be done: pack it, order sheet, packing slip, driver label, add to your list', /Pack it now[\s\S]*Order sheet[\s\S]*Packing slip[\s\S]*Driver label[\s\S]*Add to your list/.test(pg));
  await p.click('#orderPage button:text-is("Add to your list")');
  ok('Add to your list from its page: status In your list', await p.evaluate(n => stage.has(n) && orderStage({ number: n }).text === 'In your list', o0.number) && /In your list/.test(await p.innerText('#orderPage')));
  await p.click('#orderPage button:text-is("Pack it now (scan)")'); await p.waitForTimeout(300);
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
  ok('status: one sorted → Started sorting (or Ready to pack if that was all)', /Started sorting|Ready to pack/.test(await st()));
  await p.evaluate(n => { const po = plan.orders.find(x => String(x.raw) === n); plan.unpack.filter(u => u.label === po.label).forEach(u => unpackDone.add(u.step)); }, o0.number);
  ok('status: all sorted → Ready to pack', await st() === 'Ready to pack');
  await p.evaluate(n => packed.set(plan.orders.find(x => String(x.raw) === n).raw, Date.now()), o0.number);
  ok('status: packed → Packed', await st() === 'Packed');
  // deadlines
  const due = await p.evaluate(() => {
    settings.deadlines = [{ on: true, kind: 'any', area: '', cutoff: '12:00', driver: '16:00', remind: 15 }];
    const day = startOfDay(Date.now()), at = (d, h) => d + h * 36e5, now = at(day, 13);
    const mk = c => ({ number: 'T' + c, created: c, delivery: { type: 'local' }, city: 'Brooklyn', items: [] });
    return [dueOf(mk(at(day, 10)), now).text, dueOf(mk(at(day, 13.5)), now).text, dueOf(mk(at(day - 864e5, 10)), now).text, dueOf(mk(at(day, 10)), at(day, 17)).text];
  });
  ok('deadlines: in by 12 → Due today; after 12 → Tomorrow; yesterday → Late; after the driver left → Late', /^Due today/.test(due[0]) && due[1] === 'Tomorrow' && due[2] === 'Late' && due[3] === 'Late', due.join(' | '));
  await p.evaluate(() => { localStorage.removeItem('pick-and-sort-reminded-v1'); const day = startOfDay(Date.now()); practiceStore().orders.push({ number: '79999', created: day + 9 * 36e5, customer: 'Due Test', address: '1 Main St', city: 'Brooklyn', zip: '11219', delivery: { type: 'local', title: 'Local' }, tags: [], items: [{ name: 'Notebook', details: '', sku: 'NB', barcode: '5012345000039', bin: 'A14', qty: 1 }] }); checkDeadlines(day + 15.8 * 36e5); });
  const alert = await p.$eval('#dueAlert', x => x.innerText.replace(/\s+/g, ' ')).catch(() => '');
  ok('the reminder before the driver comes: how many due today aren\'t ready', /\d+ orders? due by .* (isn't|aren't) ready yet/.test(alert) && /#\d+ \(New\)/.test(alert), alert.slice(0, 200));
  await p.evaluate(() => { document.getElementById('dueAlert').remove(); checkDeadlines(startOfDay(Date.now()) + 15.85 * 36e5); });
  ok('…once (not again a minute later)', !(await p.$('#dueAlert')));
  await p.click('#navBtn'); await p.evaluate(() => go('more'));
  ok('Settings → More → Deadlines: the rule to change', /Deadlines[\s\S]*Orders in by[\s\S]*Driver comes at[\s\S]*Remind/.test(await p.innerText('#settingsView')));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

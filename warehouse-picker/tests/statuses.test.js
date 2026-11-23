// Where each one is (test address, Use bins for orders on): an order list whose items are in Bins (matched by barcode
// or SKU). Picked ones aren't in the bin any more (the bin shows how many are in it now), then sorted, then packed;
// each item says how many are in its bin, to pick, picked, sorted, packed. Finishing the list takes what was picked out
// of its bin for good, and what was packed out of the inventory. With the switch off, nothing changes.
const { chromium } = require('playwright'); require('./noauth')(chromium);
const BASE = process.argv[2] || 'http://localhost:8765/index.html';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pick-and-sort-test-features', '1'); }); await p.reload();
  // the practice bins, and two orders made of their items: 3 of one size (bin counted), 1 of another
  const set = await p.evaluate(() => {
    bins = practiceBins(); saveBins();
    const xs = allVariants().filter(x => x.v.bins.length && x.v.bins[0].qty >= 3);
    const a = xs[0], c = xs.find(x => x.p !== a.p);
    const csv = `Order,Box,Item,Details,Qty,Barcode,SKU\n5001,${a.v.bins[0].bin},${a.p.title},${optText(a.v)},2,${a.v.barcode},${a.v.sku}\n5002,${a.v.bins[0].bin},${a.p.title},${optText(a.v)},1,${a.v.barcode},${a.v.sku}\n5002,${c.v.bins[0].bin},${c.p.title},${optText(c.v)},1,${c.v.barcode},${c.v.sku}`;
    useRows(parseDelimited(csv), 'test orders');
    return { a: { id: a.v.id, bin: a.v.bins[0].bin, qty: a.v.bins[0].qty, stock: a.v.stock }, c: { id: c.v.id, bin: c.v.bins[0].bin, qty: c.v.bins[0].qty, stock: c.v.stock } };
  });
  const st = id => p.evaluate(id => { const x = allVariants().find(y => y.v.id === id); return statusText(x.v, listFlow()); }, id);
  ok('on the list, nothing picked: "To pick: 3"', /To pick: 3/.test(await st(set.a.id)) && new RegExp(`In ${set.a.bin}: ${set.a.qty}`).test(await st(set.a.id)), await st(set.a.id));
  // pick the first item's box
  await p.evaluate(id => { const x = allVariants().find(y => y.v.id === id); plan.picks.filter(k => scanKey(k.barcode) === scanKey(x.v.barcode)).forEach(k => pickedDone.add(k.step)); }, set.a.id);
  ok('picked: no longer in the bin (it shows how many are in it now)', new RegExp(`In ${set.a.bin}: ${set.a.qty - 3} · .*Picked: 3`).test(await st(set.a.id)) && !/To pick/.test(await st(set.a.id)), await st(set.a.id));
  // sort: 2 onto order 5001
  await p.evaluate(id => { const x = allVariants().find(y => y.v.id === id); const u = plan.unpack.find(k => k.raw === '5001' || String(k.raw) === '5001'); placed.set(u.step, 2); unpackDone.add(u.step); }, set.a.id);
  ok('sorted: 2 sorted, 1 still picked', /Picked: 1 · Sorted: 2/.test(await st(set.a.id)), await st(set.a.id));
  // pack order 5001
  await p.evaluate(() => { packed.set(plan.orders.find(o => String(o.raw) === '5001').raw, Date.now()); });
  ok('packed: 2 packed, 1 picked', /Picked: 1 · Packed: 2/.test(await st(set.a.id)), await st(set.a.id));
  ok('the other item, not picked yet: "To pick: 1"', /To pick: 1/.test(await st(set.c.id)), await st(set.c.id));
  // on screen: the item's page, the bin's page, the inventory list
  await p.click('#navBtn'); await p.evaluate(id => { const x = allVariants().find(y => y.v.id === id); openStock(x.p.id); }, set.a.id);
  ok("the item's page shows each size's statuses", /Picked: 1 · Packed: 2/.test(await p.innerText('#settingsView')));
  await p.evaluate(bin => { B.bin = bin; go('binsBin'); }, set.a.bin);
  ok("the bin's page: how many now (3 picked)", new RegExp(`${set.a.qty - 3} now \\(3 picked\\)`).test(await p.innerText('#settingsView')));
  await p.evaluate(() => go('binsInventory'));
  ok('the inventory list: picked / packed for the item', /Picked: 1 · Packed: 2/.test(await p.innerText('#settingsView')));
  // finish the list: picked units leave the bin, packed ones leave the inventory
  await p.evaluate(() => clearList(true));
  const after = await p.evaluate(([a, c]) => [a, c].map(s => { const v = allVariants().find(y => y.v.id === s.id).v; return [binQty(v, s.bin), stockOf(v)]; }), [set.a, set.c]);
  ok('list finished: 3 out of the bin, 2 out of the inventory; the unpicked one untouched', after[0][0] === set.a.qty - 3 && after[0][1] === set.a.stock - 2 && after[1][0] === set.c.qty && after[1][1] === set.c.stock, JSON.stringify(after));
  ok('…and it says so in History', await p.evaluate(() => /List finished/.test(bins.log[0].text)));
  // switch off: nothing is worked out or taken out
  await p.evaluate(() => { bins.settings.useForOrders = false; saveBins(); });
  await p.evaluate(() => { const x = allVariants().find(y => y.v.bins.length && y.v.bins[0].qty); useRows(parseDelimited(`Order,Box,Item,Details,Qty,Barcode,SKU\n6001,${x.v.bins[0].bin},${x.p.title},,1,${x.v.barcode},${x.v.sku}`), 't'); plan.picks.forEach(k => pickedDone.add(k.step)); window.__x = [x.v.id, x.v.bins[0].qty]; });
  await p.evaluate(() => clearList(true));
  ok('Use bins for orders off: the bins stay as they are', await p.evaluate(() => { const v = allVariants().find(y => y.v.id === window.__x[0]).v; return v.bins[0].qty === window.__x[1] && listFlow().size === 0; }));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

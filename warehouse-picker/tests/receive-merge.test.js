// Loading orders when there are already orders: it asks Replace or Merge. With Merge only what's new is added. Everything already on the phone
// keeps its ticks, piles and Packed, and its order numbers; new orders come after, with what the sending device
// had done on them. A list with nothing new changes nothing.
const { chromium } = require('playwright'); require('./noauth')(chromium);
const BASE = process.argv[2] || 'http://localhost:8765/index.html';
let bad = 0; const ok = (label, cond, extra = '') => { if (!cond) bad++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? '  (' + extra + ')' : ''}`); };
const csv = (orders) => 'Order,Box,Item,Details,Qty,Barcode,SKU\n' + orders.map(([o, box, item, det, qty, bc]) => `${o},${box},${item},${det},${qty},${bc},SKU-${bc.slice(-3)}`).join('\n');
const morning = [['1001', 'A3', 'Velour Set', 'Black - 7Y', 2, '735380912611'], ['1001', 'B7', 'Pleated Skirt', 'Navy - 8Y', 1, '735380000017'],
  ['1002', 'A3', 'Velour Set', 'Black - 7Y', 1, '735380912611'], ['1003', 'C2', 'Pom Pom Hat', 'Cream', 1, '735380000024']];
const afternoon = [...morning, ['1004', 'A3', 'Velour Set', 'Black - 7Y', 1, '735380912611'], ['1005', 'D9', 'Swaddle', 'Sage', 2, '735380000031'],
  ['1006', 'C2', 'Pom Pom Hat', 'Cream', 1, '735380000024']];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const page = async () => { const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload(); return p; };
  const phone = await page(), pc = await page();
  // the phone: the morning list, partly done
  await phone.evaluate(c => useRows(parseDelimited(c), 'morning.csv'), csv(morning));
  await phone.evaluate(() => {
    plan.picks.forEach(p => pickedDone.add(p.step));                                  // everything picked
    placeItem('735380912611'); placeItem('735380912611');                              // two Velour sets on their piles
    const o3 = plan.unpack.find(u => u.raw === '1003'); unpackDone.add(o3.step); packed.set('1003', Date.now()); // order 1003 done and packed
    saveList(); renderPick(); renderUnpack();
  });
  const before = await phone.evaluate(() => ({ labels: plan.orders.map(o => o.raw + '=' + o.label).join(' '), picked: plan.picks.filter(p => pickedDone.has(p.step)).map(pickKey).sort().join(), placed: [...placed.values()].reduce((a, n) => a + n, 0), unpacked: unpackDone.size, packed: [...packed.keys()].join() }));
  // the computer: the whole day (the morning orders again, plus three new ones), and it has picked the swaddles
  await pc.evaluate(c => useRows(parseDelimited(c), 'whole day.csv'), csv(afternoon));
  await pc.evaluate(() => { plan.picks.filter(p => p.box === 'D9').forEach(p => pickedDone.add(p.step)); saveList(); });
  const data = await pc.evaluate(() => listToSend());
  await phone.evaluate(d => receiveList(d, 'from the computer'), data);
  const q = await phone.$eval('#loadMsg', x => x.innerText.replace(/\n+/g, ' | '));
  ok('orders already there: it asks Replace or Merge', /There are already orders uploaded.*Replace.*Merge/.test(q) && await phone.evaluate(() => plan.orders.length) === 3, q.slice(0, 160));
  await phone.click('#loadMsg button:text-is("Merge")');
  const after = await phone.evaluate(() => ({ labels: plan.orders.map(o => o.raw + '=' + o.label).join(' '), picked: plan.picks.filter(p => pickedDone.has(p.step)).map(pickKey).sort(),
    placed: [...placed.values()].reduce((a, n) => a + n, 0), unpacked: unpackDone.size, packed: [...packed.keys()].join(), orders: plan.orders.length, msg: $('loadMsg').innerText,
    picks: plan.picks.map(p => `${p.box} ${p.qty}x ${p.name}${pickedDone.has(p.step) ? ' (picked)' : ''}`) }));
  console.log('  pick list now:', after.picks.join(' | '));
  ok('new orders added, after the old ones', after.orders === 6 && after.labels.startsWith(before.labels) && /1004=4 1005=5 1006=6/.test(after.labels), after.labels);
  ok('everything picked on the phone is still picked', before.picked.split(',').every(k => after.picked.includes(k)));
  ok('the new orders\' Velour set is a pick line of its own, not picked yet', after.picks.some(x => /^A3 1x Velour Set$/.test(x)) && after.picks.some(x => /^A3 3x Velour Set \(picked\)$/.test(x)));
  ok('what the computer had picked for a new order comes too (swaddles)', after.picks.some(x => /^D9 2x Swaddle \(picked\)$/.test(x)));
  ok('piles and sorted orders unchanged', after.placed === before.placed && after.unpacked === before.unpacked, `${after.placed} placed, ${after.unpacked} sorted`);
  ok('Packed unchanged', after.packed === before.packed);
  ok('says what was added', /Merged: added 3 new orders.*unchanged/.test(after.msg), after.msg);
  // reopening keeps it all
  await phone.reload();
  const reopened = await phone.evaluate(() => ({ orders: plan.orders.length, picked: plan.picks.filter(p => pickedDone.has(p.step)).length }));
  ok('kept after closing and reopening', reopened.orders === 6 && reopened.picked === after.picked.length);
  // the same list again: nothing new
  await phone.evaluate(d => receiveList(d, 'from the computer'), data);
  await phone.click('#loadMsg button:text-is("Merge")');
  ok('the same list again changes nothing', await phone.evaluate(() => plan.orders.length) === 6 && /Nothing new/.test(await phone.$eval('#loadMsg', x => x.innerText)));
  // Replace: the old orders are cleared, the new ones used
  await phone.evaluate(c => useRows(parseDelimited(c), 'other.csv'), csv([['2001', 'E1', 'Socks', 'White', 3, '735380000048']]));
  await phone.click('#loadMsg button:text-is("Replace")');
  ok('Replace: only the new orders, nothing ticked', await phone.evaluate(() => plan.orders.length === 1 && plan.orders[0].raw === '2001' && pickedDone.size === 0 && packed.size === 0));
  // a phone with no list gets the list as it is, with the computer's ticks
  const fresh = await page();
  await fresh.evaluate(d => receiveList(d, 'from the computer'), data);
  ok('nothing there yet: no question, just loaded', !/already orders/.test(await fresh.$eval('#loadMsg', x => x.innerText)));
  ok('an empty phone gets the list with what was already done', await fresh.evaluate(() => plan.orders.length === 6 && plan.picks.filter(p => pickedDone.has(p.step)).every(p => p.box === 'D9') && pickedDone.size === 1));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

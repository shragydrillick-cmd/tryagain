// Live sharing turned on while two devices are already working (needs the Firebase emulator, see README):
// with the same orders, both lists are combined (everything done on either device is kept, on both);
// a device with different orders gets the company's list. Then a device that was in the background catches up.
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/index.html', EMU = 'http://127.0.0.1:9099', P = 'pick-and-sort';
let bad = 0; const ok = (label, cond, extra = '') => { if (!cond) bad++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? '  (' + extra + ')' : ''}`); };
(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${P}/accounts`, { method: 'DELETE' }); await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch(); const errs = [];
  const open = async (c, n) => { const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ': ' + e.message));
    await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { if (!localStorage.getItem('keep')) localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('keep', '1'); localStorage.setItem('pick-and-sort-emulator', '1'); localStorage.setItem('pick-and-sort-accounts-on', '1'); } catch (e) {} });
    await p.goto(BASE); return p; };
  const google = (p, sub, email) => p.evaluate(([sub, email]) => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }))), [sub, email]);
  const signIn = async (p, sub, email) => { await p.waitForFunction(() => document.getElementById('gate') && /Sign in/.test(document.getElementById('gate').innerText)); await google(p, sub, email); await p.waitForFunction(() => !document.getElementById('gate') && acct); };
  const ca = await b.newContext({ viewport: { width: 412, height: 900 } }), cb = await b.newContext({ viewport: { width: 412, height: 900 } }), cc = await b.newContext({ viewport: { width: 412, height: 900 } });
  const a = await open(ca, 'A'); await signIn(a, 'o1', 'owner@test.com');
  await a.click('#navBtn'); await a.evaluate(() => go('admin')); await a.waitForSelector('input[aria-label="New company name"]');
  await a.fill('input[aria-label="New company name"]', 'Moonlight layette'); await a.click('button:has-text("Add company")'); await a.waitForSelector('input[aria-label="Email to add"]');
  for (const e of ['b@test.com', 'c@test.com']) { await a.fill('input[aria-label="Email to add"]', e); await a.click('button:text-is("Add")'); await a.waitForTimeout(700); }
  while (await a.evaluate(() => view === 'settings')) await a.click('#navBtn');
  const pb = await open(cb, 'B'); await signIn(pb, 'b1', 'b@test.com');
  const pc = await open(cc, 'C'); await signIn(pc, 'c1', 'c@test.com');
  // live sharing is off: A and B each load the same orders and pick different things; C has other orders
  for (const p of [a, pb]) await p.click('#exampleBtn');
  await a.evaluate(() => { plan.picks.slice(0, 3).forEach(p => pickedDone.add(p.step)); placeItem('5012345000077'); saveList(); renderPick(); });
  await pb.evaluate(() => { plan.picks.slice(-3).forEach(p => pickedDone.add(p.step)); packed.set('10455', Date.now()); saveList(); renderPick(); });
  await pc.evaluate(() => useRows(parseDelimited('Order,Box,Item,Details,Qty\n99001,Z1,Old thing,Red,1'), 'old.csv'));
  const before = { a: await a.evaluate(() => pickedDone.size), b: await pb.evaluate(() => pickedDone.size) };
  // A turns live sharing on
  await a.click('#navBtn'); await a.evaluate(() => go('admin')); await a.click('.drow:has-text("Moonlight") button:has-text("Open")');
  await a.click('button:has-text("Turn on")'); await a.waitForTimeout(7000);
  const st = p => p.evaluate(() => ({ orders: plan ? plan.orders.map(o => o.raw).sort().join(',') : '', picked: plan ? plan.picks.filter(x => pickedDone.has(x.step)).map(pickKey).sort().join(';;') : '', placed: [...placed.values()].reduce((s, n) => s + n, 0) + unpackDone.size, packed: [...packed.keys()].join() }));
  const [sa, sb, sc] = [await st(a), await st(pb), await st(pc)];
  ok('A and B combined: same orders and the same ticks on both', sa.orders === sb.orders && sa.picked === sb.picked && sa.packed === sb.packed, `A ${sa.picked.split(';;').length} picked, B ${sb.picked.split(';;').length}`);
  ok('everything picked on either device is kept', sa.picked.split(';;').length === before.a + before.b, `${before.a} + ${before.b}`);
  ok('the pile placed on A and Packed on B are on both', sa.placed > 0 && sb.placed === sa.placed && sa.packed === '10455');
  ok('C (different orders) got the company\'s list', sc.orders === sa.orders && !/99001/.test(sc.orders), sc.orders);
  // B goes to the background without a connection while A picks more; B comes back
  await cb.setOffline(true);
  await pb.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  while (await a.evaluate(() => view === 'settings')) await a.click('#navBtn');
  await a.evaluate(() => { const p = plan.picks.find(x => !pickedDone.has(x.step)); pickedDone.add(p.step); saveList(); renderPick(); });
  await pb.evaluate(() => { const p = [...plan.picks].reverse().find(x => !pickedDone.has(x.step)); if (p) { pickedDone.add(p.step); saveList(); } }); // B ticks something else too, offline
  await a.waitForTimeout(2500);
  await cb.setOffline(false);
  await pb.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')); });
  await pb.waitForTimeout(8000);
  const [ea, eb] = [await st(a), await st(pb)];
  ok('after the background: both have both new ticks', ea.picked === eb.picked && ea.picked.split(';;').length === sa.picked.split(';;').length + 2, `A ${ea.picked.split(';;').length}, B ${eb.picked.split(';;').length}`);
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

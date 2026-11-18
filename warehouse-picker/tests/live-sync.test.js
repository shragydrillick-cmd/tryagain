// Live sharing, two people at once (needs the Firebase emulator, see README): two devices in one company tick and
// untick the pick list at the same moment. Both must end up with every change, and the same list.
const { chromium } = require('playwright');
const EMU = 'http://127.0.0.1:9099', P = 'pick-and-sort';
(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${P}/accounts`, { method: 'DELETE' }); await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch(); const errs = [];
  const open = async (c, n) => { const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ': ' + e.message));
    await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { if (!localStorage.getItem('keep')) localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('keep', '1'); localStorage.setItem('pick-and-sort-emulator', '1'); localStorage.setItem('pick-and-sort-accounts-on', '1'); } catch (e) {} });
    await p.goto((process.argv[2] || 'http://localhost:8765/index.html')); return p; };
  const google = (p, sub, email) => p.evaluate(([sub, email]) => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }))), [sub, email]);
  const ca = await b.newContext({ viewport: { width: 412, height: 900 } }), cb = await b.newContext({ viewport: { width: 412, height: 900 } });
  const a = await open(ca, 'A'); await a.waitForFunction(() => document.getElementById('gate') && /Sign in/.test(document.getElementById('gate').innerText));
  await google(a, 'o1', 'owner@test.com'); await a.waitForFunction(() => !document.getElementById('gate') && acct);
  await a.click('#navBtn'); await a.evaluate(() => go('admin')); await a.waitForSelector('input[aria-label="New company name"]');
  await a.fill('input[aria-label="New company name"]', 'Moonlight layette'); await a.click('button:has-text("Add company")'); await a.waitForSelector('input[aria-label="Email to add"]');
  await a.click('button:has-text("Turn on")'); await a.waitForTimeout(800);
  await a.fill('input[aria-label="Email to add"]', 'b@test.com'); await a.click('button:text-is("Add")'); await a.waitForTimeout(800);
  while (await a.evaluate(() => view === 'settings')) await a.click('#navBtn');
  const pb = await open(cb, 'B'); await pb.waitForFunction(() => document.getElementById('gate') && /Sign in/.test(document.getElementById('gate').innerText));
  await google(pb, 'b1', 'b@test.com'); await pb.waitForFunction(() => !document.getElementById('gate') && acct && acct.live);
  await a.click('#exampleBtn'); await pb.waitForFunction(() => plan && plan.orders.length === 5, null, { timeout: 10000 }); await a.waitForTimeout(1000);
  // A ticks the first rows, B the last rows, at the same moment, a few times over
  const boxes = p => p.$$('#tab-pick tbody tr:not(.unit-head) input[type=checkbox]');
  for (let k = 0; k < 4; k++) {
    const [ba, bb] = [await boxes(a), await boxes(pb)];
    await Promise.all([ba[k].click(), bb[bb.length - 1 - k].click()]);
    await a.waitForTimeout(40 * (k % 3));
  }
  await a.waitForTimeout(3000);
  // untick at the same moment: A unticks its 1st, B unticks A's 2nd
  { const [ba, bb] = [await boxes(a), await boxes(pb)]; await Promise.all([ba[0].click(), bb[1].click()]); }
  await a.waitForTimeout(4000);
  const sa = await a.evaluate(() => [...pickedDone].sort((x, y) => x - y).join(',')), sb = await pb.evaluate(() => [...pickedDone].sort((x, y) => x - y).join(','));
  const good = sa === sb && sa === '3,4,6,7,8,9' && !errs.length;
  console.log('A has picked:', sa, '| B has picked:', sb, '| expected on both: 3,4,6,7,8,9');
  console.log(good ? 'all ok' : 'FAILED', errs); await b.close(); process.exit(good ? 0 : 1); })();

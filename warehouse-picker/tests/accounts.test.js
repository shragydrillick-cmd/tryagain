// Accounts, companies and live sharing, against the Firebase emulator (auth + firestore) with firebase/firestore.rules,
// OWNER_EMAIL set to owner@test.com. Start it first (see tests/README.md), then: node tests/accounts.test.js
// Prints one line per check; every line must end in "ok".
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/index.html', EMU = 'http://127.0.0.1:9099', PROJECT = 'pick-and-sort';
let bad = 0;
const ok = (label, cond, extra = '') => { if (!cond) bad++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? '  (' + extra + ')' : ''}`); };
(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch(); const errs = [];
  const dev = async (name, w = 390) => {
    const c = await b.newContext({ viewport: { width: w, height: 860 } }); const p = await c.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('pick-and-sort-emulator', '1'); localStorage.setItem('pick-and-sort-accounts-on', '1'); } catch (e) {} });
    await p.goto(BASE); return p;
  };
  const gate = p => p.evaluate(() => { const g = document.getElementById('gate'); return g ? g.innerText.replace(/\n+/g, ' | ').slice(0, 160) : '(app open)'; });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (p, fn, arg, t = 10000) => { try { await p.waitForFunction(fn, arg, { timeout: t }); return true; } catch (e) { return false; } };
  const gateHas = (p, re, t) => until(p, re => { const g = document.getElementById('gate'); return g && new RegExp(re).test(g.innerText); }, re.source, t);
  const open = p => until(p, () => !document.getElementById('gate') && typeof acct !== 'undefined' && acct);
  const google = (p, sub, email) => p.evaluate(([sub, email]) => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }))), [sub, email]);
  const tryDb = (p, fn, arg) => p.evaluate(async ([src, arg]) => { try { await eval(src)(arg); return 'ALLOWED'; } catch (e) { return e.code || e.message; } }, [fn.toString(), arg]);
  const admin = async p => { if (await p.evaluate(() => view !== 'settings')) await p.click('#navBtn'); await p.evaluate(() => go('admin')); await until(p, () => !/Loading/.test(document.getElementById('settingsView').innerText)); };
  const adminText = p => p.$eval('#settingsView', x => x.innerText.replace(/\n+/g, ' | '));

  // 1. the owner: straight in, makes a company, turns live sharing on, adds a worker
  const owner = await dev('owner', 1000);
  await gateHas(owner, /Sign in to continue/);
  await google(owner, 'owner-1', 'owner@test.com');
  ok('owner gets straight in', await open(owner), await owner.evaluate(() => acct && acct.role));
  await admin(owner);
  await owner.fill('input[aria-label="New company name"]', 'Moonlight'); await owner.click('button:has-text("Add company")');
  await until(owner, () => /People in Moonlight/.test(document.getElementById('settingsView').innerText));
  await owner.click('button:has-text("Turn on")');
  await until(owner, () => /Live sharing: On/.test(document.getElementById('settingsView').innerText));
  await owner.fill('input[aria-label="Email to add"]', 'Worker@Test.com'); await owner.click('button:text-is("Add")'); await wait(800);
  ok('owner admin page: company, live sharing on, worker added', /Moonlight.*Live sharing: On.*worker@test.com/.test(await adminText(owner)));
  const moon = await owner.evaluate(() => acct.company);

  // 2. someone new asks to start a company: waits for the owner
  const boss = await dev('boss');
  await gateHas(boss, /Sign in to continue/);
  await google(boss, 'boss-1', 'boss@test.com');
  ok('new person: "Not added yet" with Start a new company', await gateHas(boss, /Not added yet[\s\S]*Start a new company/));
  await boss.fill('#gate input[aria-label="Company name"]', 'Sunrise'); await boss.click('#gate button:has-text("Ask to start this company")');
  ok('after asking: waiting for approval', await gateHas(boss, /Waiting for approval/), await gate(boss));
  const sun = await boss.evaluate(() => fb.db.collection('users').doc(fb.auth.currentUser.uid).get().then(s => s.data().company));
  ok('waiting company: can\'t accept itself', (await tryDb(boss, c => fb.db.collection('companies').doc(c).update({ status: 'approved' }), sun)) === 'permission-denied');
  ok('waiting company: can\'t use a list', (await tryDb(boss, c => fb.db.collection('companies').doc(c).collection('lists').doc('current').set({ x: 1 }), sun)) === 'permission-denied');
  ok('waiting company: can\'t add people', (await tryDb(boss, c => fb.db.collection('invites').doc('x@test.com').set({ company: c, role: 'user' }), sun)) === 'permission-denied');

  // 3. the owner accepts it: the boss's app opens by itself, as its company admin
  await admin(owner);
  ok('owner sees it waiting', /Waiting for your OK.*Sunrise.*boss@test.com/.test(await adminText(owner)));
  await owner.click('.drow:has-text("Sunrise") button:has-text("Accept")');
  ok('accepted: the boss is in by itself', await open(boss), await boss.evaluate(() => acct && `${acct.role} of ${acct.companyName}`));

  // 4. the company admin adds their own people (no owner needed) and runs their own company only
  await admin(boss);
  const bt = await adminText(boss);
  ok('company admin sees only their company', /Admin: Sunrise/.test(bt) && !/Moonlight/.test(bt) && !/Waiting for your OK/.test(bt));
  await boss.fill('input[aria-label="Email to add"]', 'helper@test.com'); await boss.click('button:text-is("Add")'); await wait(800);
  ok('company admin added a person', /helper@test.com/.test(await adminText(boss)));
  ok('company admin can\'t remove their company', (await tryDb(boss, c => fb.db.collection('companies').doc(c).update({ status: 'removed' }), sun)) === 'permission-denied');
  ok('company admin can\'t read another company', (await tryDb(boss, c => fb.db.collection('companies').doc(c).get(), moon)) === 'permission-denied');
  ok('company admin can\'t add people to another company', (await tryDb(boss, c => fb.db.collection('invites').doc('y@test.com').set({ company: c, role: 'user' }), moon)) === 'permission-denied');
  ok('live sharing is off in a new company: no list', (await tryDb(boss, c => fb.db.collection('companies').doc(c).collection('lists').doc('current').get(), sun)) === 'permission-denied');
  const helper = await dev('helper');
  await gateHas(helper, /Sign in to continue/); await google(helper, 'helper-1', 'helper@test.com');
  ok('the person the company admin added gets in', await open(helper), await helper.evaluate(() => acct && `${acct.role} of ${acct.companyName}`));

  // 5. live sharing in Moonlight: the worker (email + password) and the owner share one list
  const worker = await dev('worker');
  await until(worker, () => document.querySelector('#gate input[type=email]'));
  await worker.fill('#gate input[type=email]', 'worker@test.com'); await worker.fill('#gate input[type=password]', 'secret123');
  await worker.click('#gate button:has-text("New account")');
  await gateHas(worker, /Check your email/);
  const codes = await (await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/oobCodes`)).json();
  await fetch(codes.oobCodes.find(c => c.email === 'worker@test.com' && c.requestType === 'VERIFY_EMAIL').oobLink);
  await worker.click('#gate button:has-text("Check again")');
  ok('worker in after confirming their email', await open(worker));
  if (await owner.evaluate(() => view === 'settings')) await owner.click('#navBtn');
  await owner.click('#exampleBtn');
  ok('live: worker gets the owner\'s list', await until(worker, () => typeof plan !== 'undefined' && plan && plan.orders.length === 5, null, 10000));
  await worker.evaluate(() => { ['5012345000077', '5012345000015'].forEach(c => placeItem(c)); saveList(); });
  ok('live: owner sees the worker\'s scans', await until(owner, () => typeof unpackDone !== 'undefined' && unpackDone.size >= 2, null, 10000));
  ok('Sunrise (live off) doesn\'t get Moonlight\'s list', !(await boss.evaluate(() => !!(typeof plan !== 'undefined' && plan))));

  // 6. the company turns live sharing off: the worker stops getting changes
  await admin(owner); await owner.click('.drow:has-text("Moonlight") button:has-text("Open")').catch(() => {});
  await until(owner, () => /Live sharing: On/.test(document.getElementById('settingsView').innerText));
  await owner.click('button:has-text("Turn off")');
  ok('live sharing off reaches the worker', await until(worker, () => acct && acct.live === false, null, 10000));
  ok('live sharing off: the list is closed', (await tryDb(worker, c => fb.db.collection('companies').doc(c).collection('lists').doc('current').get(), moon)) === 'permission-denied');
  await owner.click('button:has-text("Turn on")'); await until(worker, () => acct && acct.live === true, null, 10000);

  // 7. a week without a check: signed out, back in only by signing in online; the clock turned back too
  await worker.evaluate(() => { stopWatching(); stopSync(); acct.checkedAt = Date.now() - 8 * 864e5; keepAcct(); }); // as if the last check was 8 days ago
  await worker.reload();
  ok('a week offline: signed out', await gateHas(worker, /wasn't online for a week/), await gate(worker));
  ok('a week offline: no sign-in left on the phone', !(await worker.evaluate(() => fb.auth && fb.auth.currentUser)));
  await worker.fill('#gate input[type=email]', 'worker@test.com'); await worker.fill('#gate input[type=password]', 'secret123');
  await worker.click('#gate button:text-is("Sign in")');
  ok('signs in again online and is in', await open(worker));
  await worker.evaluate(() => { stopWatching(); stopSync(); acct.lastNow = Date.now() + 2 * 864e5; keepAcct(); }); // as if the clock was turned back 2 days
  await worker.reload();
  ok('clock turned back: signed out', await gateHas(worker, /date or time was changed/), await gate(worker));
  await worker.fill('#gate input[type=email]', 'worker@test.com'); await worker.fill('#gate input[type=password]', 'secret123');
  await worker.click('#gate button:text-is("Sign in")'); await open(worker);
  await worker.reload(); await wait(2500);
  ok('otherwise stays signed in after reopening', await gate(worker) === '(app open)');

  // 8. the owner removes Sunrise: its people are out at once; bring it back and they're in
  await admin(owner);
  await owner.click('.drow:has-text("Sunrise") button:has-text("Remove")'); await owner.click('.drow:has-text("Sunrise") button:has-text("Tap again")');
  ok('company removed: its admin is out at once', await gateHas(boss, /turned off/), await gate(boss));
  ok('company removed: its worker is out too', await gateHas(helper, /turned off/));
  await admin(owner); await owner.click('.drow:has-text("Sunrise") button:has-text("Bring back")'); await wait(800);
  await boss.click('#gate button:has-text("Check again")');
  ok('brought back: in again', await open(boss));
  await helper.click('#gate button:has-text("Check again")');
  ok('brought back: its worker in again too', await open(helper));

  // 9. blocking and removing people
  await admin(owner); await owner.click('.drow:has-text("Moonlight") button:has-text("Open")');
  await until(owner, () => [...document.querySelectorAll('#settingsView .drow')].some(r => /worker@test.com/.test(r.innerText)));
  await owner.locator('#settingsView .drow', { hasText: 'worker@test.com' }).locator('button:has-text("Block")').click();
  ok('blocked: out at once', await gateHas(worker, /No access/));
  ok('blocked: list wiped from the phone', !(await worker.evaluate(() => !!current || !!localStorage.getItem('pick-and-sort-list-v1'))));
  await admin(boss);
  await until(boss, () => [...document.querySelectorAll('#settingsView .drow')].some(r => /helper@test.com/.test(r.innerText)));
  const hrow = boss.locator('#settingsView .drow', { hasText: 'helper@test.com' });
  await hrow.locator('button:has-text("Remove")').click(); await hrow.locator('button:has-text("Tap again")').click();
  ok('company admin removed a person: out at once', await gateHas(helper, /account has been turned off/), await gate(helper));

  // 10. nobody else gets in, or makes themselves anything
  const stranger = await dev('stranger');
  await gateHas(stranger, /Sign in to continue/); await google(stranger, 's-1', 'stranger@test.com');
  await gateHas(stranger, /Not added yet/);
  ok('stranger can\'t make an accepted company', (await tryDb(stranger, () => { const r = fb.db.collection('companies').doc(); const b = fb.db.batch();
    b.set(r, { name: 'x', status: 'approved', live: true, createdBy: fb.auth.currentUser.uid }); b.set(fb.db.collection('users').doc(fb.auth.currentUser.uid), { email: 'stranger@test.com', company: r.id, role: 'admin', status: 'allowed' }); return b.commit(); })) === 'permission-denied');
  ok('stranger can\'t join a company', (await tryDb(stranger, c => fb.db.collection('users').doc(fb.auth.currentUser.uid).set({ email: 'stranger@test.com', company: c, role: 'user', status: 'allowed' }), moon)) === 'permission-denied');
  ok('stranger can\'t make itself owner', (await tryDb(stranger, () => fb.db.collection('users').doc(fb.auth.currentUser.uid).set({ email: 'stranger@test.com', company: '', role: 'owner', status: 'allowed' }))) === 'permission-denied');
  ok('stranger can\'t read a list', (await tryDb(stranger, c => fb.db.collection('companies').doc(c).collection('lists').doc('current').get(), moon)) === 'permission-denied');
  ok('company admin can\'t make themselves owner', (await tryDb(boss, () => fb.db.collection('users').doc(acct.uid).update({ role: 'owner' }))) === 'permission-denied');

  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok');
  await b.close(); process.exit(bad ? 1 : 0);
})();

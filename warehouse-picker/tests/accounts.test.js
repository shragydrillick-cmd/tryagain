// Accounts, companies and live sharing, against the Firebase emulator (auth + firestore) with firebase/firestore.rules,
// OWNER_EMAIL set to owner@test.com. Start it first (see tests/README.md), then: node tests/accounts.test.js
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/index.html', EMU = 'http://127.0.0.1:9099', PROJECT = 'pick-and-sort';
(async () => {
  // a clean emulator
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch(); const errs = [];
  const dev = async (name, w = 390) => {
    const c = await b.newContext({ viewport: { width: w, height: 860 } }); const p = await c.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('pick-and-sort-emulator', '1'); localStorage.setItem('pick-and-sort-accounts-on', '1'); } catch (e) {} });
    await p.goto(BASE); return p;
  };
  const gate = p => p.evaluate(() => { const g = document.getElementById('gate'); return g ? g.innerText.replace(/\n+/g, ' | ').slice(0, 140) : '(app open)'; });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (p, fn, arg, t = 8000) => { try { await p.waitForFunction(fn, arg, { timeout: t }); return true; } catch (e) { return false; } };

  // 1. the owner signs in with Google (the emulator's pretend Google account)
  const owner = await dev('owner', 1000);
  await until(owner, () => document.getElementById('gate') && /Sign in to continue/.test(document.getElementById('gate').innerText));
  console.log('1. first screen:', await gate(owner));
  await owner.evaluate(() => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub: 'owner-1', email: 'owner@test.com', email_verified: true, name: 'Owner' }))));
  await until(owner, () => !document.getElementById('gate'));
  console.log('   owner after Google sign-in:', await gate(owner), '| role:', await owner.evaluate(() => acct && acct.role));

  // 2. Admin: a company, and two people added by email
  await owner.click('#navBtn'); await owner.evaluate(() => go('admin'));
  await until(owner, () => document.querySelector('input[aria-label="New company name"]'));
  await owner.fill('input[aria-label="New company name"]', 'Moonlight'); await owner.click('button:has-text("Add company")');
  await until(owner, () => document.querySelector('input[aria-label="Email to add"]'));
  await owner.fill('input[aria-label="Email to add"]', 'Worker@Test.com'); await owner.click('button:text-is("Add")');
  await wait(800);
  await owner.fill('input[aria-label="Email to add"]', 'boss@test.com'); await owner.selectOption('select[aria-label="Role"]', 'admin'); await owner.click('button:text-is("Add")');
  await wait(800);
  console.log('2. admin page:', (await owner.$eval('#settingsView', x => x.innerText)).replace(/\n+/g, ' | ').slice(0, 260));
  await owner.click('#navBtn');

  // 3. the worker makes an account with email + password, confirms the email, and is in
  const worker = await dev('worker');
  await until(worker, () => document.querySelector('#gate input[type=email]'));
  await worker.fill('#gate input[type=email]', 'worker@test.com'); await worker.fill('#gate input[type=password]', 'secret123');
  await worker.click('#gate button:has-text("New account")');
  await until(worker, () => /Check your email/.test(document.getElementById('gate').innerText));
  console.log('3. worker after New account:', await gate(worker));
  const codes = await (await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/oobCodes`)).json();
  const verify = codes.oobCodes.find(c => c.email === 'worker@test.com' && c.requestType === 'VERIFY_EMAIL');
  await fetch(verify.oobLink); // tapping the link in the email
  await worker.click('#gate button:has-text("Check again")');
  await until(worker, () => !document.getElementById('gate'));
  console.log('   worker after confirming:', await gate(worker), '|', await worker.evaluate(() => acct && `${acct.role} in ${acct.companyName}`));

  // 4. a stranger nobody added
  const stranger = await dev('stranger');
  await until(stranger, () => document.querySelector('#gate input[type=email]'));
  await stranger.evaluate(() => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub: 's-1', email: 'stranger@test.com', email_verified: true }))));
  await until(stranger, () => /Not added yet/.test(document.getElementById('gate').innerText));
  console.log('4. stranger:', await gate(stranger));
  const sneak = await stranger.evaluate(async c => { try { await fb.db.collection('companies').doc(c).collection('lists').doc('current').get(); return 'READ THE LIST (bad)'; } catch (e) { return e.code; } }, await owner.evaluate(() => acct.company));
  const sneak2 = await stranger.evaluate(async () => { try { await fb.db.collection('users').doc(fb.auth.currentUser.uid).set({ email: 'stranger@test.com', company: 'x', role: 'owner', status: 'allowed' }); return 'MADE ITSELF OWNER (bad)'; } catch (e) { return e.code; } });
  console.log('   stranger reading the company list:', sneak, '| making itself owner:', sneak2);

  // 5. live sharing: the owner loads orders, the worker sees them; the worker scans, the owner sees it
  await owner.click('#exampleBtn');
  const got = await until(worker, () => typeof plan !== 'undefined' && plan && plan.orders.length === 5, null, 10000);
  console.log('5. worker got the owner\'s list:', got, '|', await worker.evaluate(() => document.getElementById('syncLine').textContent));
  await worker.evaluate(() => { ['5012345000077', '5012345000015'].forEach(c => placeItem(c)); saveList(); });
  const seen = await until(owner, () => typeof unpackDone !== 'undefined' && unpackDone.size >= 2, null, 10000);
  console.log('   owner sees the worker\'s scans:', seen);
  await owner.click('#packBtn'); console.log('   owner Packing screen:', await owner.$eval('#packPanel .packsum', x => x.textContent)); await owner.click('#packPanel button:has-text("Close")');

  // 6. the worker stays signed in after closing the app
  await worker.reload();
  await wait(2500);
  console.log('6. worker after reopening:', await gate(worker), '| orders', await worker.evaluate(() => plan ? plan.orders.length : 0));
  const other = await worker.evaluate(async () => { try { await fb.db.collection('companies').doc('someone-else').collection('lists').doc('current').get(); return 'READ ANOTHER COMPANY (bad)'; } catch (e) { return e.code; } });
  const promote = await worker.evaluate(async () => { try { await fb.db.collection('users').doc(acct.uid).update({ role: 'admin' }); return 'PROMOTED ITSELF (bad)'; } catch (e) { return e.code; } });
  console.log('   worker reading another company:', other, '| making itself manager:', promote);

  // 7. the owner blocks the worker
  await owner.click('#navBtn'); await owner.evaluate(() => go('admin'));
  await until(owner, () => [...document.querySelectorAll('#settingsView .drow')].some(r => /worker@test.com/.test(r.innerText)));
  const row = owner.locator('#settingsView .drow', { hasText: 'worker@test.com' });
  await row.locator('button:has-text("Block")').click();
  const out = await until(worker, () => document.getElementById('gate') && /No access/.test(document.getElementById('gate').innerText), null, 10000);
  console.log('7. worker blocked live:', out, '|', await gate(worker), '| list left on the phone:', await worker.evaluate(() => !!current || !!localStorage.getItem('pick-and-sort-list-v1')));
  await worker.reload(); await wait(2500); console.log('   worker after reopening:', await gate(worker));
  const after = await worker.evaluate(async c => { try { await fb.db.collection('companies').doc(c).collection('lists').doc('current').get(); return 'STILL READS (bad)'; } catch (e) { return e.code; } }, await owner.evaluate(() => acct.company));
  console.log('   blocked worker reading the list:', after);

  // 8. the manager (boss) signs in and can only manage their own company
  const boss = await dev('boss');
  await until(boss, () => document.querySelector('#gate input[type=email]'));
  await boss.evaluate(() => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub: 'b-1', email: 'boss@test.com', email_verified: true }))));
  await until(boss, () => !document.getElementById('gate'));
  await boss.click('#navBtn'); await boss.evaluate(() => go('admin'));
  await until(boss, () => /People in/.test(document.getElementById('settingsView').innerText));
  console.log('8. manager sees:', (await boss.$eval('#settingsView', x => x.innerText)).replace(/\n+/g, ' | ').slice(0, 200));
  const bossMakeCompany = await boss.evaluate(async () => { try { await fb.db.collection('companies').add({ name: 'x' }); return 'MADE A COMPANY (bad)'; } catch (e) { return e.code; } });
  console.log('   manager making a company:', bossMakeCompany);
  console.log('errors', errs);
  await b.close();
})();

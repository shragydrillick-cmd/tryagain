// The company's store setup: the admin saves it; a worker who signs in (on a new device) gets it; a change is picked up
const { chromium } = require('playwright');
const EMU = 'http://127.0.0.1:9099', P = 'pick-and-sort';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${P}/accounts`, { method: 'DELETE' }); await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch(); const errs = [];
  const open = async (c, n) => { const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ': ' + e.message));
    await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { if (!localStorage.getItem('keep')) localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('keep', '1'); localStorage.setItem('pick-and-sort-emulator', '1'); localStorage.setItem('pick-and-sort-accounts-on', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); return p; };
  const google = (p, sub, email) => p.evaluate(([sub, email]) => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }))), [sub, email]);
  const signIn = async (p, sub, email) => { await p.waitForFunction(() => document.getElementById('gate') && /Sign in/.test(document.getElementById('gate').innerText)); await google(p, sub, email); await p.waitForFunction(() => !document.getElementById('gate') && acct); };
  const map = p => p.evaluate(() => settings.units.map(u => u.name + ':' + u.shelves.map(s => s.boxes).join('/')).join(' '));
  const ca = await b.newContext({ viewport: { width: 412, height: 900 } }), cb = await b.newContext({ viewport: { width: 412, height: 900 } });
  const a = await open(ca, 'admin'); await signIn(a, 'o1', 'owner@test.com');
  await a.click('#navBtn'); await a.evaluate(() => go('admin')); await a.waitForSelector('input[aria-label="New company name"]');
  await a.fill('input[aria-label="New company name"]', 'S & O'); await a.click('button:has-text("Add company")'); await a.waitForSelector('input[aria-label="Email to add"]');
  await a.fill('input[aria-label="Email to add"]', 'w@test.com'); await a.click('button:text-is("Add")'); await a.waitForTimeout(700);
  // the admin's store: 3 aisles
  await a.evaluate(() => { settings.units = [makeAisle({ letter: 'A', shelves: 3, per: '8' }), makeAisle({ letter: 'B', shelves: 2, per: '6' }), makeAisle({ letter: 'C', shelves: 4, per: '5' })]; settings.walk = settings.units.map(u => u.id).reverse(); saveSettings(); go('map'); });
  await a.waitForTimeout(800);
  ok('Map shows the company box with Save for company', /S & O's store setup.*Not saved for the company yet.*Save for company/s.test(await a.$eval('#settingsView', x => x.innerText)));
  await a.click('button:has-text("Save for company")'); await a.click('button:has-text("Tap again")'); await a.waitForTimeout(1500);
  ok('saved: everyone uses this setup', /Everyone in S & O uses this setup/.test(await a.$eval('#settingsView', x => x.innerText)));
  const want = await map(a);
  // a worker signs in on a new device (with its own default map)
  const w = await open(cb, 'worker'); const before = await map(w); await signIn(w, 'w1', 'w@test.com'); await w.waitForTimeout(3000);
  ok('new device signs in: gets the company\'s store setup', await map(w) === want && before !== want, await map(w));
  ok('…with its walking order', JSON.stringify(await w.evaluate(() => settings.walk.map(id => settings.units.find(u => u.id === id).name))) === JSON.stringify(['Aisle C', 'Aisle B', 'Aisle A']));
  // the worker has a list with ticks; the admin changes the store (adds aisle D) and saves
  await w.click('#exampleBtn'); await w.evaluate(() => { plan.picks.slice(0, 2).forEach(p => pickedDone.add(p.step)); saveList(); });
  await a.evaluate(() => { settings.units.push(makeAisle({ letter: 'D', shelves: 2, per: '4' })); settings.walk.push(settings.units[3].id); saveSettings(); renderSettings(); });
  await a.waitForTimeout(500);
  ok('admin changed the map: asked to save it for the company', /You've changed the map on this device/.test(await a.$eval('#settingsView', x => x.innerText)));
  await a.click('button:has-text("Save for company")'); await a.click('button:has-text("Tap again")'); await a.waitForTimeout(2500);
  ok('the worker gets the change by itself', /Aisle D/.test(await map(w)));
  ok('…and keeps the 2 ticks on the list', await w.evaluate(() => pickedDone.size) === 2);
  // a worker can't save for the company
  const denied = await w.evaluate(async () => { try { await storeDoc().set({ data: '{}', at: 1 }); return 'SAVED (bad)'; } catch (e) { return e.code; } });
  ok('a worker can\'t save the store setup for everyone', denied === 'permission-denied');
  // reopening keeps it
  await w.reload(); await w.waitForTimeout(4000);
  ok('after reopening: still the company\'s setup', /Aisle D/.test(await map(w)));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? bad + ' FAILED' : 'all ok'); await b.close(); process.exit(bad ? 1 : 0); })();

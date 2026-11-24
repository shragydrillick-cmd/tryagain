// Devices and print stations (needs the Firebase emulator, see README): devices are named; a computer is made a print
// station on itself; holding the green circle lists every device, online first, and the picker taps "Print here" to
// send their labels to that station; a phone packing a local order sends its label there and goes back to the list; a UPS order opens there for Shopify; with the station offline the phone
// prints its own label and the UPS order waits, then reaches the station when it's back.
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/index.html', EMU = 'http://127.0.0.1:9099', P = 'pick-and-sort';
let bad = 0; const ok = (l, c, x = '') => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}${x ? '  (' + x + ')' : ''}`); };
(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${P}/accounts`, { method: 'DELETE' }); await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch(); const errs = [];
  const open = async (c, n, extra) => { const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ': ' + e.message));
    await p.addInitScript(x => { try { if (!sessionStorage.getItem('x')) { if (!localStorage.getItem('keep')) localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('keep', '1');
      localStorage.setItem('pick-and-sort-emulator', '1'); localStorage.setItem('pick-and-sort-accounts-on', '1'); localStorage.setItem('pick-and-sort-test-features', '1'); if (x) Object.entries(x).forEach(([k, v]) => localStorage.setItem(k, v)); } catch (e) {} }, extra || null);
    await p.goto(BASE); return p; };
  const google = (p, sub, email) => p.evaluate(([sub, email]) => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }))), [sub, email]);
  const signIn = async (p, sub, email) => { await p.waitForFunction(() => document.getElementById('gate') && /Sign in/.test(document.getElementById('gate').innerText)); await google(p, sub, email); await p.waitForFunction(() => !document.getElementById('gate') && acct); };
  const home = async p => { for (let k = 0; k < 6 && await p.evaluate(() => view === 'settings'); k++) await p.click('#navBtn'); };
  const ca = await b.newContext({ viewport: { width: 1200, height: 800 } }), cb = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  // the computer: owner, company with live sharing, a worker added; named "Packing desk"; made the print station
  let a = await open(ca, 'desk'); await signIn(a, 'o1', 'owner@test.com');
  await a.click('#navBtn'); await a.evaluate(() => go('admin')); await a.waitForSelector('input[aria-label="New company name"]');
  await a.fill('input[aria-label="New company name"]', 'S & O'); await a.click('button:has-text("Add company")'); await a.waitForSelector('input[aria-label="Email to add"]');
  await a.click('button:has-text("Turn on")'); await a.waitForTimeout(500);
  await a.fill('input[aria-label="Email to add"]', 'w@test.com'); await a.click('button:text-is("Add")'); await a.waitForTimeout(600);
  await a.evaluate(() => go('more')); await a.fill('input[aria-label="This device\'s name"]', 'Packing desk'); await a.press('input[aria-label="This device\'s name"]', 'Tab');
  await a.click('label:has-text("Use this computer as a print station") input'); await a.waitForTimeout(1200);
  ok('the computer is the print station', await a.evaluate(() => amStation()) && !!(await a.$('#stationBar')), await a.$eval('#stationBar', x => x.innerText.replace(/\n+/g, ' | ')).catch(() => ''));
  await a.evaluate(() => { window.__labels = []; window.__stationPrint = o => { window.__labels.push(o.number); }; });
  await home(a);
  // the phone: worker, named
  let ph = await open(cb, 'phone'); await signIn(ph, 'w1', 'w@test.com');
  await ph.click('#navBtn'); await ph.evaluate(() => go('more')); await ph.fill('input[aria-label="This device\'s name"]', 'Packer phone'); await ph.press('input[aria-label="This device\'s name"]', 'Tab'); await ph.waitForTimeout(800);
  await home(ph);
  // hold the green circle
  const box = await ph.$('#syncDot'); const bb = await box.boundingBox();
  await ph.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await ph.mouse.down(); await ph.waitForTimeout(900); await ph.mouse.up();
  await ph.waitForTimeout(800);
  const list = await ph.$$eval('#devicesPanel .devrow', r => r.map(x => x.innerText.replace(/\n+/g, ' | ')));
  ok('holding the green circle: every device, online first, green', list.length === 2 && list.every(x => /online/.test(x)) && list.some(x => /Packing desk.*Print station/.test(x)) && list.some(x => /Packer phone.*This device/.test(x)), list.join(' // '));
  await ph.click('#devicesPanel .devrow:has-text("Packing desk") button:has-text("Print here")'); await ph.waitForTimeout(1200);
  ok('the picker chose Packing desk: "Your labels print here"', /Packing desk.*Your labels print here/.test(await ph.$eval('#devicesPanel', x => x.innerText.replace(/\n+/g, ' '))));
  await ph.click('#devicesPanel button:has-text("Back")');
  await ph.click('#navBtn'); await ph.evaluate(() => go('more')); await ph.waitForTimeout(800);
  ok('This device: "My labels print on: Packing desk (online)"', await ph.$eval('select[aria-label="Labels print on"]', x => x.options[x.selectedIndex].text) === 'Packing desk (online)');
  await home(ph);
  // pack a local order: the label prints on the desk, the phone goes back to the list
  const pack = async (pageP, number, what) => pageP.evaluate(async ([n, w]) => { startPack(findPackOrder(n), true); pk.o.items.forEach((it, i) => pk.got.set(i, it.qty)); drawPack(); await packAction(w); }, [number, what]);
  const local = await ph.evaluate(() => practiceStore().orders.find(o => o.delivery.type === 'local').number);
  await pack(ph, local, 'both');
  await a.waitForFunction(n => window.__labels.includes(n), local, { timeout: 10000 }).catch(() => {});
  ok('local order: the label printed on the print station', await a.evaluate(n => window.__labels.includes(n), local));
  await ph.waitForTimeout(2000);
  ok('…and the phone went back to the list', !(await ph.$('#packScreen')));
  // a UPS order: it opens on the desk for Shopify
  const ups = await ph.evaluate(() => practiceStore().orders.find(o => o.delivery.type === 'shipping').number);
  await pack(ph, ups, 'pack'); await a.waitForTimeout(2500);
  ok('UPS order: on the print station, to buy its label in Shopify', new RegExp(`#${ups}.*buy its label in Shopify.*Open in Shopify`).test(await a.$eval('#stationBar', x => x.innerText.replace(/\n+/g, ' '))));
  // the desk goes offline (closed); the phone prints its own label, and the UPS order waits
  await ph.evaluate(() => localStorage.setItem('pick-and-sort-online-window', '4000')); await ph.reload(); await ph.waitForFunction(() => acct && station.id, null, { timeout: 10000 });
  await a.close(); await ph.waitForTimeout(5000);
  await ph.evaluate(() => { window.__opened = 0; window.open = () => { window.__opened++; return { closed: false, close() {}, document: { body: {}, title: '' }, location: {} }; }; });
  const local2 = await ph.evaluate(() => practiceStore().orders.filter(o => o.delivery.type === 'local')[1].number);
  await pack(ph, local2, 'both');
  ok('desk offline: the phone prints the label itself, and says so', await ph.evaluate(() => window.__opened) === 1 && /offline: printing here/.test(await ph.$eval('#packScreen .packmsg', x => x.innerText)),
    await ph.evaluate(() => window.__opened) + ' / ' + await ph.$eval('#packScreen .packmsg', x => x.innerText).catch(e => 'no msg: ' + document.title));
  await ph.click('#packScreen button:text-is("Back")').catch(() => {});
  const ups2 = await ph.evaluate(() => practiceStore().orders.filter(o => o.delivery.type === 'shipping')[1].number);
  await pack(ph, ups2, 'pack');
  // the desk comes back: the waiting UPS order reaches it
  a = await open(ca, 'desk again'); await a.waitForFunction(() => acct && amStation() && station.unsubJobs, null, { timeout: 15000 }).catch(() => {});
  await a.waitForTimeout(3000);
  ok('desk back: the UPS order that waited is there', new RegExp(`#${ups2}.*buy its label in Shopify`).test(await a.$eval('#stationBar', x => x.innerText.replace(/\n+/g, ' ')).catch(() => '')));
  // order sheets (Add orders → your list → Just print) from the phone: they print on the desk, in one go
  await a.evaluate(() => { window.__sheetsPrinted = []; window.__stationPrint = (o, blob) => { window.__sheetsPrinted.push(blob ? blob.size : 0); }; });
  await a.evaluate(() => heartbeat()); await ph.waitForFunction(() => stationOnline(), null, { timeout: 8000 }).catch(() => {}); // the desk checks in (this test counts 4 s as online)
  await ph.evaluate(() => { stage.clear(); practiceStore().orders.slice(0, 3).forEach(o => stage.set(o.number, { ...o, units: o.items.reduce((s, x) => s + x.qty, 0) })); runStage('print'); });
  await a.waitForFunction(() => window.__sheetsPrinted.length, null, { timeout: 15000 }).catch(() => {}); await a.waitForTimeout(800);
  ok('order sheets from the phone print on the print station', await a.evaluate(() => window.__sheetsPrinted.length === 1 && window.__sheetsPrinted[0] > 1000) && /3 order sheets printed/.test(await a.$eval('#stationBar', x => x.innerText).catch(() => '')));
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();


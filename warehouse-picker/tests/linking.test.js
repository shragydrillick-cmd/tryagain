// "Send to phone" (QR link and file) and linked devices, with a pretend Firestore database answering the same calls. Run: node tests/linking.test.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const db = {}; // the pretend database
  const fake = async route => {
    const req = route.request(), url = new URL(req.url()), id = url.pathname.split('/').pop();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,PATCH', 'access-control-allow-headers': 'content-type' } });
    if (url.searchParams.get('key') !== 'AIzaTEST') return route.fulfill({ status: 403, headers: { 'access-control-allow-origin': '*' }, body: '{"error":{"message":"denied"}}' });
    if (req.method() === 'PATCH') { db[id] = JSON.parse(req.postData()); return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(db[id]) }); }
    if (!db[id]) return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(db[id]) });
  };
  const dev = async (name, w) => { const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.route(/firestore\.googleapis\.com/, fake); const p = await c.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); await p.goto('http://localhost:8765/index.html'); return p; };
  const computer = await dev('computer', 1000), phone = await dev('phone', 400), phone2 = await dev('phone2', 400);

  // --- send to phone (no database) ---
  await computer.click('#exampleBtn'); await computer.click('#sendBtn'); await computer.waitForSelector('#sendBox img.qr, #sendBox h3');
  const send = await computer.evaluate(() => ({ qr: !!document.querySelector('#sendBox img.qr'), text: $('sendBox').innerText.replace(/\n+/g, ' | ').slice(0, 160) }));
  console.log('send box:', JSON.stringify(send));
  const link = await computer.evaluate(async () => siteUrl() + '#list=' + await packText(JSON.stringify(listToSend())));
  console.log('link length:', link.length);
  await phone2.goto(link.replace(/^https?:\/\/[^#]+/, 'http://localhost:8765/index.html'));
  await phone2.waitForTimeout(500);
  console.log('phone2 opened the link: orders', await phone2.evaluate(() => plan && plan.orders.length), '| hash cleared:', await phone2.evaluate(() => location.hash === ''));
  // a list file
  const file = await computer.evaluate(() => JSON.stringify(listToSend()));
  await phone2.setInputFiles('#fileInput', { name: 'pick-list.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  console.log('phone2 got a file while it had a list:', (await phone2.innerText('#loadMsg')).replace(/\n+/g, ' | '));
  await phone2.click('#loadMsg button:has-text("Open the new list")');
  console.log('  -> orders', await phone2.evaluate(() => plan.orders.length));

  // --- linking ---
  await computer.click('#navBtn'); await computer.evaluate(() => go('more'));
  await computer.fill('input[aria-label="Firebase project ID"]', 'demo-proj'); await computer.fill('input[aria-label="Firebase web API key"]', 'WRONG');
  await computer.click('button:has-text("Start linking")'); await computer.waitForTimeout(300);
  console.log('wrong key ->', await computer.evaluate(() => [...document.querySelectorAll('#settingsView p.small')].map(p => p.textContent).filter(t => /reach/.test(t)).join('')));
  await computer.fill('input[aria-label="Firebase web API key"]', 'AIzaTEST'); await computer.click('button:has-text("Start linking")'); await computer.waitForTimeout(1500);
  console.log('computer linked:', await computer.evaluate(() => syncOn()), '| qr shown:', await computer.evaluate(() => !!document.querySelector('#settingsView img.qr')), '| db docs:', Object.keys(db).length);
  const joinLinkText = await computer.evaluate(() => linkText());
  await computer.click('#navBtn');
  // phone joins by pasting the link text in More
  await phone.click('#navBtn'); await phone.evaluate(() => go('more'));
  await phone.fill('input[aria-label="Link from the other device"]', joinLinkText); await phone.click('button:has-text("Join")');
  await phone.waitForTimeout(1500); await phone.click('#navBtn');
  console.log('phone joined; has the computer\'s list:', await phone.evaluate(() => plan ? plan.orders.length + ' orders' : 'no list'), '|', await phone.innerText('#syncLine'));
  // tick on the phone -> shows on the computer
  const pb = await phone.$$('#tab-pick input[type=checkbox]'); await pb[0].check(); await pb[2].check();
  await phone.waitForTimeout(1200); await computer.evaluate(() => syncPull()); await computer.waitForTimeout(800);
  console.log('ticks on the computer after ticking on the phone:', await computer.evaluate(() => [...pickedDone].sort()), await computer.$$eval('#tab-pick input:checked', x => x.length));
  // new orders on the computer -> phone
  await computer.evaluate(() => { useRows(parseDelimited('Order,Box,Item,Qty\n900,A3,Mug,2\n901,A7,Pen,1\n901,B3,Bib,1'), 'new orders.csv'); });
  await computer.waitForTimeout(1200); await phone.evaluate(() => syncPull()); await phone.waitForTimeout(800);
  console.log('phone after computer loaded new orders:', await phone.evaluate(() => current.name + ', ' + plan.orders.length + ' orders, ticks ' + pickedDone.size));
  // clear on the phone -> computer
  await phone.click('#clearBtn'); await phone.click('#clearBtn'); await phone.waitForTimeout(1200);
  await computer.evaluate(() => syncPull()); await computer.waitForTimeout(800);
  console.log('computer after clear on phone: list', await computer.evaluate(() => current ? 'still there' : 'cleared'), '| results hidden', await computer.evaluate(() => $('results').classList.contains('hidden')));
  // offline: change while database unreachable, then back
  await computer.evaluate(() => useRows(parseDelimited('Order,Box,Item,Qty\n77,A3,Mug,1'), 'offline.csv'));
  await computer.context().unroute(/firestore\.googleapis\.com/); await computer.context().route(/firestore\.googleapis\.com/, r => r.abort());
  await computer.waitForTimeout(1200); console.log('offline line:', await computer.innerText('#syncLine'));
  await computer.context().unroute(/firestore\.googleapis\.com/); await computer.context().route(/firestore\.googleapis\.com/, fake);
  await computer.evaluate(() => syncPull()); await computer.waitForTimeout(1200); await phone.evaluate(() => syncPull()); await phone.waitForTimeout(800);
  console.log('back online, phone has:', await phone.evaluate(() => current ? current.name : 'nothing'), '|', await computer.innerText('#syncLine'));
  if (process.argv[2]) await computer.screenshot({ path: process.argv[2] });
  console.log('errors', errs); await b.close();
})();

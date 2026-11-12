// "Send to phone" with a big list: 80 orders become several QR codes that change by themselves; they're filmed into a video (needs ffmpeg) that a second browser uses as its camera, and "Scan from computer" must rebuild the exact same list.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const SP = require('os').tmpdir() + '/pick-and-sort-qr';
(async () => {
  fs.mkdirSync(SP, { recursive: true });
  const b = await chromium.launch(); const errs = [];
  const pc = await (await b.newContext({ viewport: { width: 1200, height: 1000 } })).newPage(); pc.on('pageerror', e => errs.push('pc: ' + e.message));
  await pc.goto('http://localhost:8765/index.html');
  // a big day: 80 orders, about 300 lines, long names with colours and sizes
  const csv = await pc.evaluate(() => {
    const prods = ['Lil Legs Limited Capsule Toddler Sweatshirt Set', 'Bebe Organic Cuddle Horse Blanket', 'Wooden Teether Ring', 'Muslin Swaddle Wrap Large', 'Knitted Baby Booties', 'Silicone Bib With Pocket'];
    const cols = ['Deep Red', 'Faded Blue', 'Natural', 'Sage Green', 'Oat', 'Charcoal'], sizes = ['0-3M', '3-6M', '6-12M', '2T', '3T', '4T'];
    let s = 'Order,Box,Item,Details,Qty\n', seed = 5; const r = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
    for (let o = 0; o < 80; o++) { const k = 1 + r(6); for (let i = 0; i < k; i++) s += `${53700 + o},${'ABC'[r(3)]}${1 + r(96)},${prods[r(6)]},${cols[r(6)]} - ${sizes[r(6)]},${1 + r(3)}\n`; }
    return s;
  });
  await pc.evaluate(c => useRows(parseDelimited(c), 'big day.csv'), csv);
  const want = await pc.evaluate(() => ({ orders: plan.orders.length, lines: current.lines.length, units: plan.totalUnits, first: plan.picks[0].name + ' / ' + plan.picks[0].details }));
  await pc.click('#sendBtn'); await pc.waitForSelector('#sendBox img.qr');
  const info = await pc.evaluate(() => ({ text: $('sendBox').innerText.replace(/\n+/g, ' | ').slice(0, 200), label: [...$('sendBox').querySelectorAll('p')].map(p => p.textContent)[0] }));
  console.log('computer list:', JSON.stringify(want)); console.log('send box:', info.text);
  // record the codes as they change: screenshot the QR every 350 ms for one full round
  const n = +((info.text.match(/of (\d+)/) || [0, 1])[1]);
  const seen = new Map(); let shot = 0;
  for (let t = 0; t < n * 3 && seen.size < n; t++) {
    const lbl = await pc.$eval('#sendBox p.muted', p => p.textContent).catch(() => 'Code 1 of 1');
    const i = +lbl.match(/Code (\d+)/)[1];
    if (!seen.has(i)) { const f = path.join(SP, `f${String(shot++).padStart(3, '0')}.png`); await (await pc.$('#sendBox img.qr')).screenshot({ path: f }); seen.set(i, f); }
    await pc.waitForTimeout(350);
  }
  console.log('codes captured off the screen:', seen.size, 'of', n);
  // a video like a phone camera sees it: each code for 0.7 s, smaller in a grey frame, slightly blurred
  execSync(`ffmpeg -y -loglevel error -framerate 1/0.7 -pattern_type glob -i '${SP}/f*.png' -vf "scale=480:-1,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=gray,gblur=sigma=0.6,fps=15,format=yuv420p" ${SP}/cam.y4m`);
  await b.close();
  // the phone, with that video as its camera
  const b2 = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${SP}/cam.y4m`] });
  const phone = await (await b2.newContext({ viewport: { width: 400, height: 800 }, permissions: ['camera'] })).newPage(); phone.on('pageerror', e => errs.push('phone: ' + e.message));
  await phone.goto('http://localhost:8765/index.html'); await phone.evaluate(() => localStorage.clear());
  await phone.click('#scanBtn');
  const t0 = Date.now(); let last = '';
  for (let k = 0; k < 120; k++) {
    const st = await phone.evaluate(() => ({ open: !!document.querySelector('.scanner'), msg: (document.querySelector('.scanmsg') || {}).textContent || '', got: plan ? plan.orders.length : 0 }));
    if (st.msg !== last) { console.log(`  phone ${((Date.now() - t0) / 1000).toFixed(1)}s: ${st.msg}`); last = st.msg; }
    if (!st.open) break;
    await phone.waitForTimeout(500);
  }
  await phone.screenshot({ path: SP + '/phone-after.png' });
  const got = await phone.evaluate(() => plan ? { orders: plan.orders.length, lines: current.lines.length, units: plan.totalUnits, first: plan.picks[0].name + ' / ' + plan.picks[0].details } : null);
  console.log('phone list:', JSON.stringify(got), '| same as computer:', JSON.stringify(got) === JSON.stringify(want), '| took', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log('errors', errs); await b2.close();
})();

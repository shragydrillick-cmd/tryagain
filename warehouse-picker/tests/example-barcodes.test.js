// The "try it" path: web/barcodes.html (the example items' barcodes, plus one that isn't on any slip) is filmed
// into a video (needs ffmpeg) that a second browser uses as its camera, with "Try an example" + "Scan to unpack".
// Every known barcode must go to the right order; the unknown one asks "which item is it?", and once taught,
// that barcode is remembered.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const SP = require('os').tmpdir() + '/pick-and-sort-example-barcodes';
const BASE = process.argv[2] || 'http://localhost:8765';
(async () => {
  fs.rmSync(SP, { recursive: true, force: true }); fs.mkdirSync(SP, { recursive: true });
  const b = await chromium.launch(); const errs = [];
  const pc = await (await b.newContext({ viewport: { width: 1000, height: 900 } })).newPage(); pc.on('pageerror', e => errs.push('page: ' + e.message));
  await pc.goto(BASE + '/web/barcodes.html');
  // each barcode from the page, copied onto one fixed-size stage (ffmpeg drops frames when the size changes)
  const svgs = await pc.$$eval('.card svg', list => list.map(x => x.outerHTML));
  await pc.evaluate(() => { const st = document.createElement('div'); st.id = 'stage';
    st.style.cssText = 'position:fixed;left:0;top:0;width:700px;height:260px;background:#d8d4c8;display:flex;align-items:center;justify-content:center;z-index:9';
    document.body.append(st); });
  const order = [0, 2, 2, 9, 4, 4, 4, 1]; // fleece blue, notebook ×2, the unknown one, phone stand ×3, fleece gray
  let f = 0;
  for (const i of order) for (const show of [true, false]) {
    await pc.evaluate(([html, show]) => { document.getElementById('stage').innerHTML = show ? html.replace('<svg ', '<svg style="width:520px;height:auto" ') : ''; }, [svgs[i], show]);
    await (await pc.$('#stage')).screenshot({ path: path.join(SP, `f${String(f++).padStart(3, '0')}.png`) });
  }
  execSync(`ffmpeg -y -loglevel error -framerate 1 -pattern_type glob -i '${SP}/f*.png' -vf "scale=1000:-2,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xd8d4c8,gblur=sigma=0.6,fps=15,format=yuv420p" ${SP}/cam.y4m`);
  await b.close();
  const b2 = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${SP}/cam.y4m`] });
  const ph = await (await b2.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] })).newPage(); ph.on('pageerror', e => errs.push('phone: ' + e.message));
  await ph.goto(BASE + '/index.html'); await ph.evaluate(() => localStorage.clear()); await ph.reload();
  await ph.click('#exampleBtn');
  console.log('example list item:', await ph.$eval('#tab-unpack .icode', x => x.textContent));
  await ph.click('#scanUnpackBtn');
  const t0 = Date.now(); let last = '', taught = false, shot = false;
  while (Date.now() - t0 < 19000) {
    const r = await ph.evaluate(() => ({ res: (document.querySelector('.scanresult') || {}).innerText || '', prog: (document.querySelector('.scanprog') || {}).textContent }));
    const line = r.res.replace(/\n+/g, ' | ').slice(0, 170) + '  [' + r.prog + ']';
    if (line !== last) { console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s: ${line}`); last = line; }
    if (!taught && /isn't on the slips/.test(r.res)) {
      if (!shot && process.argv[3]) { await ph.screenshot({ path: process.argv[3] }); shot = true; }
      await ph.waitForTimeout(1500); // the camera is held while choosing
      await ph.click('.pickitems button:has-text("Water bottle")'); taught = true;
    }
    await ph.waitForTimeout(150);
  }
  const res = await ph.evaluate(() => ({ remembered: settings.barcodes, again: (() => { const u = matchLines('5012345000107'); return u.map(x => itemName(x) + ' → order ' + x.label).join(', '); })() }));
  console.log('remembered:', JSON.stringify(res.remembered), '| that barcode now means:', res.again);
  console.log('errors', errs); await b2.close();
})();

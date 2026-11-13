// "Scan to unpack": the barcode and SKU under each item, which order each scan goes to (an item in two orders, 2 of one, Undo,
// unknown codes, already placed), then real barcodes drawn into a video (needs ffmpeg) used as a second browser's camera.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const SP = require('os').tmpdir() + '/pick-and-sort-barcodes';
const CSV = `Order,Box,Item,Details,Barcode,SKU,Qty
53796,C87,Lil Legs Capsule Sweatshirt Set,Deep Red - 2T,735380754426,LL2207-2T,1
53797,C87,Lil Legs Capsule Sweatshirt Set,Deep Red - 2T,735380754426,LL2207-2T,2
53797,A52,Bebe Organic Cuddle Horse Blanket,Faded Blue,4741631147998,BO9019,1
53798,B3,Bib,,4741631100103,BB100,1`;
(async () => {
  fs.rmSync(SP, { recursive: true, force: true }); fs.mkdirSync(SP, { recursive: true }); // frames from an earlier run would mix in
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  // logic
  await p.evaluate(c => useRows(parseDelimited(c), 'test.csv'), CSV);
  console.log('pick list item:', (await p.$eval('#tab-pick td .icode', x => x.textContent)));
  const seq = await p.evaluate(() => {
    const say = r => r.kind === 'ok' ? `order ${r.u.label}${r.orderLeft ? ` (${r.orderLeft} to come)` : ' COMPLETE'}` : r.kind;
    const out = [];
    for (const c of ['735380754426', '0735380754426', '4741631147998', '735380754426', '735380754426', '999', 'bb100', '4741631100103']) out.push(c + ' -> ' + say(placeItem(c)));
    const u = undoPlace(); out.push('undo -> ' + itemName(u) + ' back off order ' + u.label);
    out.push('again 4741631100103 -> ' + say(placeItem('4741631100103')));
    out.push('progress ' + JSON.stringify(unpackProgress()));
    return out;
  });
  console.log(seq.join('\n'));
  // video of barcodes as a phone would film them, then scan with the fake camera
  await p.evaluate(() => { localStorage.clear(); });
  const page2 = await (await b.newContext()).newPage();
  await page2.setContent('<body style="margin:0"><div id="box" style="width:640px;height:260px;background:#d8d4c8;display:flex;align-items:center;justify-content:center"><svg id="bc" style="background:#fff"></svg></div></body>');
  await page2.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js' });
  const codes = ['735380754426', null, '735380754426', null, '4741631147998', null, '735380754426', null, '4741631100103', null, '1234567890128'];
  let f = 0;
  for (const c of codes) {
    for (let k = 0; k < 1; k++) { // each picture held a second
      const file = path.join(SP, `f${String(f++).padStart(3, '0')}.png`);
      // every picture the same size (ffmpeg drops a frame when the size changes); a gap = no barcode in view
      await page2.evaluate(c => { const bc = document.getElementById('bc'); bc.style.visibility = c ? 'visible' : 'hidden';
        if (c) { try { JsBarcode('#bc', c, { format: c.length === 12 ? 'UPC' : 'EAN13', width: 3, height: 120 }); } catch (e) { JsBarcode('#bc', c, { format: 'CODE128', width: 2, height: 120 }); } } }, c);
      await (await page2.$('#box')).screenshot({ path: file });
    }
  }
  execSync(`ffmpeg -y -loglevel error -framerate 1 -pattern_type glob -i '${SP}/f*.png' -vf "scale=640:-2,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xd8d4c8,rotate=0.03:c=0xd8d4c8,gblur=sigma=0.7,fps=15,format=yuv420p" ${SP}/cam.y4m`);
  await b.close();
  const b2 = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${SP}/cam.y4m`] });
  const ph = await (await b2.newContext({ viewport: { width: 390, height: 800 }, permissions: ['camera'] })).newPage(); ph.on('pageerror', e => errs.push('phone: ' + e.message));
  await ph.goto('http://localhost:8765/index.html'); await ph.evaluate(() => localStorage.clear()); await ph.reload();
  await ph.evaluate(c => useRows(parseDelimited(c), 'test.csv'), CSV);
  await ph.click('#scanUnpackBtn');
  const t0 = Date.now(); let last = ''; let shot = false;
  while (Date.now() - t0 < 24000) {
    const r = await ph.evaluate(() => ({ res: (document.querySelector('.scanresult') || {}).innerText || '', prog: (document.querySelector('.scanprog') || {}).textContent }));
    const line = r.res.replace(/\n+/g, ' | ') + '  [' + r.prog + ']';
    if (line !== last) { console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s: ${line}`); last = line; }
    await ph.waitForTimeout(150);
  }
  await ph.click('.scanhead button');
  console.log('unpack list ticks after closing:', await ph.$$eval('#tab-unpack input:checked', x => x.length), 'of', await ph.$$eval('#tab-unpack input[type=checkbox]', x => x.length));
  console.log('errors', errs); await b2.close();
})();

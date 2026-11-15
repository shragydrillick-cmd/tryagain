// The Packing screen: orders come up green when every item is on its pile (here or on a linked device),
// Packed moves them to the bottom (grey) and is shared with the linked devices. Uses a pretend Firestore.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const db = {};
  const fake = async route => {
    const req = route.request(), id = new URL(req.url()).pathname.split('/').pop(), H = { 'access-control-allow-origin': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...H, 'access-control-allow-methods': 'GET,PATCH', 'access-control-allow-headers': 'content-type' } });
    if (req.method() === 'PATCH') { db[id] = JSON.parse(req.postData()); return route.fulfill({ status: 200, headers: H, body: JSON.stringify(db[id]) }); }
    if (!db[id]) return route.fulfill({ status: 404, headers: H, body: '{}' });
    return route.fulfill({ status: 200, headers: H, body: JSON.stringify(db[id]) });
  };
  const dev = async (name, w) => { const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.route(/firestore\.googleapis\.com/, fake); const p = await c.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); await p.goto(process.argv[2] || 'http://localhost:8765/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); return p; };
  const sorter = await dev('sorter', 390), packer = await dev('packer', 390);
  // link both
  await sorter.evaluate(() => { settings.sync = { projectId: 'demo', apiKey: 'AIzaTEST', code: newLinkCode() }; saveSettings(); });
  const link = await sorter.evaluate(() => linkText());
  await packer.evaluate(l => joinLink(l), link);
  await sorter.click('#exampleBtn'); await sorter.waitForTimeout(1200);
  await packer.evaluate(() => syncPull()); await packer.waitForTimeout(800);
  await packer.click('#packBtn');
  const show = async () => (await packer.$$eval('#packPanel .drow', r => r.map(x => x.className.replace('drow static ', '').split(' ')[0] + ': ' + x.innerText.replace(/\n+/g, ' ').slice(0, 70)))).join('\n   ');
  console.log('packer, nothing sorted yet:', await packer.$eval('#packPanel .packsum', x => x.textContent));
  // the sorter scans everything for order 2 (cable ties + fleece blue) and part of order 4
  await sorter.evaluate(() => { ['5012345000077', '5012345000015', '5012345000091'].forEach(c => placeItem(c)); renderUnpack(); saveList(); });
  await sorter.waitForTimeout(1200); await packer.evaluate(() => syncPull()); await packer.waitForTimeout(800);
  console.log('packer after sorting:', await packer.$eval('#packPanel .packsum', x => x.textContent), '\n   ' + await show());
  await packer.click('#packPanel .packbtn >> nth=0'); await packer.waitForTimeout(1200);
  console.log('packer after Packed:', await packer.$eval('#packPanel .packsum', x => x.textContent), '\n   ' + await show());
  await sorter.evaluate(() => syncPull()); await sorter.waitForTimeout(800);
  await sorter.click('.stat:has-text("orders")');
  console.log('sorter sees in Orders:', (await sorter.$$eval('#detailPanel .drow', r => r.map(x => x.innerText.replace(/\n+/g, ' ').slice(0, 45)))).join(' | '));
  await sorter.click('#detailPanel button:has-text("Close")');
  // closing and reopening keeps Packed
  await packer.reload(); await packer.click('#packBtn');
  console.log('after reopening the packer:', await packer.$eval('#packPanel .packsum', x => x.textContent));
  await packer.click('#packPanel button:has-text("Undo")'); console.log('after Undo:', await packer.$eval('#packPanel .packsum', x => x.textContent));
  if (process.argv[3]) await packer.screenshot({ path: process.argv[3] });
  console.log('errors', errs); await b.close();
})();

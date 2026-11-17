// Bins (practice): load the practice items, the List (sort, filter, empty bins, items not in a bin), an item's
// sizes and details, a bin's Edit page (move, add a second bin, remove, Edit all), Add / Edit (search, choose sizes,
// put in a bin, the "bin taken" warning with See details, See empty bins), Undo, History, and that nothing else
// in the app changes. Screenshots go to the folder given as the second argument (optional).
const { chromium } = require('playwright'); require('./noauth')(chromium);
const BASE = process.argv[2] || 'http://localhost:8765/index.html', SHOTS = process.argv[3];
let bad = 0; const ok = (label, cond, extra = '') => { if (!cond) bad++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? '  (' + extra + ')' : ''}`); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload();
  const shot = async n => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/bins-${n}.png`, fullPage: false }); };
  const txt = sel => p.$eval(sel, x => x.innerText.replace(/\n+/g, ' | '));
  // a shelf map, so there are real bins (and empty ones)
  await p.evaluate(() => { settings = fixSettings({ ...settings, units: ['A', 'B', 'C', 'D'].map((l, i) => ({ id: i + 1, name: 'Aisle ' + l, shelves: [0, 1, 2, 3].map(s => ({ boxes: `${l}${s * 10 + 1}-${l}${s * 10 + 10}` })) })), walk: [1, 2, 3, 4] }); saveSettings(); });
  const before = await p.evaluate(() => JSON.stringify({ s: localStorage.getItem('pick-and-sort-settings-v2') }));
  await p.click('#navBtn'); await p.click('.tile:has(b:text-is("Bins"))');
  ok('Bins page: practice notice and buttons', /Practice only[\s\S]*Practice: load example items[\s\S]*List[\s\S]*Add \/ Edit/.test(await p.$eval('#settingsView', x => x.innerText)));
  await p.click('button:has-text("Practice: load example items")');
  ok('practice loaded, partly placed', /12 items.*bins in use.*not in a bin yet/.test(await txt('#settingsView')), (await txt('#settingsView')).slice(0, 200));
  await shot('1-home');

  await p.click('.binbig button:has-text("List")');
  const rows = await p.$$eval('.binrow', r => r.map(x => x.innerText.replace(/\n+/g, ' | ')));
  ok('List: every bin in order, items by general name, empty ones too', /^A\d/.test(rows[0]) && rows.some(r => /Empty/.test(r)) && rows.some(r => /Velour Crest Lounge Set/.test(r)) && !rows.some(r => /7Y/.test(r)), rows.slice(0, 3).join(' // '));
  ok('List: a bin with two different items shows both', rows.some(r => /Cuddle Horse Blanket/.test(r) && /Muslin Swaddle/.test(r)));
  await shot('2-list');
  await p.selectOption('select[aria-label="Show"]', 'full');
  const full = await p.$$eval('.binrow', r => r.length);
  await p.selectOption('select[aria-label="Show"]', 'empty');
  const empty = await p.$$eval('.binrow', r => r.every(x => /Empty/.test(x.innerText)));
  ok('filter: full bins / empty bins', full > 5 && empty, `${full} full`);
  await p.selectOption('select[aria-label="Show"]', 'nobin');
  ok('filter: items not in a bin', /Ribbed Knit Joggers[\s\S]*Pleated Skirt/.test(await txt('#settingsView')));
  await p.selectOption('select[aria-label="Show"]', 'full');
  await p.selectOption('select[aria-label="Company"]', 'Little Parni');
  const lp = await p.$$eval('.binrow', r => r.map(x => x.innerText));
  ok('filter: by company', lp.length && lp.every(x => /Little Parni/.test(x) && !/Lil Legs/.test(x)));
  await p.selectOption('select[aria-label="Company"]', '');
  await p.selectOption('select[aria-label="Sort"]', 'az');
  const az = await p.$$eval('.binrow', r => r.map(x => x.querySelector('.linkrow b')).filter(Boolean).map(x => x.textContent));
  ok('sort: A–Z', az.join() === [...az].sort().join(), az.slice(0, 3).join(' / '));
  await p.selectOption('select[aria-label="Sort"]', 'bin');
  await p.fill('input[aria-label="Search"]', 'pleated'); await p.waitForTimeout(500);
  ok('search', (await p.$$eval('.binrow', r => r.length)) === 1);
  await p.fill('input[aria-label="Search"]', ''); await p.waitForTimeout(500);

  // an item: its colours with their sizes, then one size's details
  await p.click('.linkrow:has-text("Velour Crest Lounge Set")');
  const sheetText = await txt('#binSheet');
  ok('item box: name, company, variant count, colours with sizes', /Velour Crest Lounge Set.*Lil Legs · 14 variants.*Black.*7 sizes.*Navy/.test(sheetText), sheetText.slice(0, 160));
  await shot('3-item');
  await p.click('#binSheet .chip:has-text("7Y")');
  const vt = await txt('#binSheet');
  ok('a size: barcode, SKU, both bins', /Barcode.*7353.*SKU.*LL2232-BLA-7Y.*\/.*either one/.test(vt), vt.slice(0, 220));
  await shot('4-variant');
  await p.click('#binSheet .detailhead button:has-text("Back")');
  ok('Back from a size goes back to its item', /14 variants/.test(await txt('#binSheet')));
  await p.click('#binSheet .detailhead button:has-text("Back")');
  ok('Back from the item goes back to the list', !(await p.$('#binSheet')) && /List/.test(await txt('#settingsView')));

  // a bin's Edit page
  const firstBin = await p.$eval('.binrow:has-text("Velour") .binno', x => x.textContent);
  await p.click(`.binrow:has-text("Velour") button:has-text("Edit")`);
  ok('bin page: grouped by item, each size with Edit, Edit all', /Bin .*Edit all.*Velour Crest Lounge Set.*14 variants in this bin.*Black \/ 2T.*Edit/.test(await txt('#settingsView')));
  await shot('5-bin');
  // move one size to another bin, typed, which is taken -> warning, See details, OK anyway
  await p.click('.drow:has-text("Black / 8Y") button:has-text("Edit")');
  await p.click('#binSheet button:has-text("Move to another bin")');
  const taken = await p.evaluate(() => [...binContents().keys()].find(b => !/Velour/.test(JSON.stringify(binContents().get(b).map(x => x.p.title)))));
  await p.fill('input[aria-label="Bin number"]', taken); await p.waitForTimeout(500);
  ok('typed a taken bin: warning with See details', /already taken.*See details/.test(await txt('#binChooser')));
  await shot('6-taken');
  await p.click('#binChooser button:has-text("See details")');
  ok('See details: its items with tick boxes and Check all', (await p.$$eval('#binChooser .checkrow', r => r.length)) >= 2);
  await p.click('#binChooser button:has-text("Back")');
  await p.click('#binChooser button:has-text("anyway")');
  ok('moved out of this bin into the new one, with Undo', await p.evaluate(([t, fb]) => { const v = bins.products[0].variants.find(x => x.size === '8Y' && x.colour === 'Black'); return v.bins.some(b => b.bin === t) && !v.bins.some(b => b.bin === fb); }, [taken, firstBin]) && !!(await p.$('#binsUndo')));
  await p.click('#binsUndo button:has-text("Undo")');
  ok('Undo puts it back', await p.evaluate(fb => bins.products[0].variants.find(x => x.size === '8Y' && x.colour === 'Black').bins.some(b => b.bin === fb), firstBin));
  await p.click('#binSheet .detailhead button:has-text("Back")').catch(() => {});
  // Edit selected: tick two sizes, then the choices (move / also another bin / remove)
  await p.click('#settingsView .drow:has-text("Black / 2T") input[type=checkbox]');
  await p.click('#settingsView .drow:has-text("Black / 3T") input[type=checkbox]');
  ok('ticked two: Edit selected (2)', /2 selected.*Edit selected \(2\)/.test(await txt('#settingsView')));
  await p.click('button:has-text("Edit selected (2)")');
  const ch = await txt('#binSheet');
  ok('the choices: move, also another bin, remove', /Move to another bin.*Also put in another bin.*Remove from/.test(ch), ch.slice(0, 200));
  await p.click('#binSheet button:has-text("Remove from")'); await p.click('#binSheet button:has-text("Tap again")');
  ok('removed just those two', await p.evaluate(fb => { const vs = bins.products[0].variants; return !vs[0].bins.some(b => b.bin === fb) && !vs[1].bins.some(b => b.bin === fb) && vs[2].bins.some(b => b.bin === fb); }, firstBin));
  await p.click('#binsUndo button:has-text("Undo")');
  ok('no separate Remove buttons on the bin page', !/Remove all from this bin|Remove from/.test(await txt('#settingsView')));
  // Edit all: move everything to an empty bin picked from See empty bins
  await p.click('button:has-text("Edit all")');
  await p.click('#binSheet button:has-text("Move to another bin")');
  await p.click('#binChooser button:has-text("See empty bins")');
  ok('See empty bins: a list of empty bins', (await p.$$eval('#binChooser .emptygrid .chip', r => r.length)) > 20);
  await shot('7-empty');
  const pickE = await p.$eval('#binChooser .emptygrid .chip', x => x.textContent);
  await p.click('#binChooser .emptygrid .chip');
  ok('picked bin goes back into the box', await p.$eval('input[aria-label="Bin number"]', x => x.value) === pickE);
  await p.click(`#binChooser button:has-text("Confirm: bin ${pickE}")`);
  ok('Edit all: everything moved', await p.evaluate(([fb, e]) => bins.products[0].variants.every(v => !v.bins.some(b => b.bin === fb) && v.bins.some(b => b.bin === e)), [firstBin, pickE]));

  // Add / Edit: find by search, choose sizes, add to a bin
  await p.evaluate(() => go('binsAdd'));
  ok('Add / Edit: Scan and Manual', /Scan.*Manual/.test(await txt('#settingsView')));
  await p.click('button:text-is("Manual")');
  await p.fill('input[aria-label="Find an item"]', 'joggers'); await p.waitForTimeout(500);
  await p.click('#settingsView .drow:has-text("Oatmeal / 2T")');
  ok('item shown with its details and the other sizes', /Ribbed Knit Joggers.*Barcode.*SKU.*Not in a bin.*15 in all.*Only this one.*Choose which.*All 15/.test(await txt('#settingsView')));
  await p.click('label:has-text("Choose which") input');
  await p.click('.chooselist label:has-text("Oatmeal / 3T") input');
  await p.click('.chooselist label:has-text("Sage / 2T") input');
  await shot('8-add');
  await p.click('button:has-text("+ Add to bin (3)")');
  await p.fill('input[aria-label="Bin number"]', 'd40'); await p.waitForTimeout(500);
  await p.click('#binChooser button:has-text("bin D40")');
  ok('3 sizes put in D40', await p.evaluate(() => bins.products[3].variants.filter(v => v.bins.some(b => b.bin === 'D40')).length === 3));

  // placing by scanning: nothing is placed until it's confirmed; warnings when it's in another bin or the bin has other things
  const type = async c => { await p.fill('.scanner input[aria-label="Barcode or SKU"]', c); await p.click('.scanner button:text-is("OK")'); };
  await p.evaluate(() => { B.bin = 'D41'; go('binsBin'); });
  await p.click('button:has-text("Scan items into D41")');
  const code = await p.evaluate(() => bins.products[3].variants[3].barcode);
  await type(code);
  ok('scan an item into a bin: asks first', /D41.*Add to D41\?.*Add to D41.*Cancel/.test(await txt('.scanner .scanresult')) && await p.evaluate(() => !bins.products[3].variants[3].bins.some(b => b.bin === 'D41')));
  await p.click('.scanner .scanresult button:has-text("Add to D41")');
  ok('confirmed: added', /Added/.test(await txt('.scanner .scanresult')) && await p.evaluate(() => bins.products[3].variants[3].bins.some(b => b.bin === 'D41')));
  const placed = await p.evaluate(() => { const v = bins.products[1].variants[0]; return { code: v.barcode, bin: v.bins[0].bin }; });
  await type(placed.code);
  const w1 = await txt('.scanner .scanresult');
  ok('already in another bin and the bin has something else: both warnings', new RegExp(`in ${placed.bin} now.*D41 already has.*Move to D41 anyway.*Keep in both.*Cancel`).test(w1), w1.slice(0, 200));
  await p.click('.scanner .scanresult button:has-text("Keep in both")');
  ok('Keep in both: in both bins', await p.evaluate(b => { const v = bins.products[1].variants[0]; return v.bins.some(x => x.bin === b) && v.bins.some(x => x.bin === 'D41'); }, placed.bin));
  await type('C12');
  ok('another bin\'s sticker switches bins', /Bin C12/.test(await txt('.scanner .scanresult')));
  await type('NOPE123X');
  ok('an unknown code says so', /Not in the inventory/.test(await txt('.scanner .scanresult')));
  await p.click('.scanner button:has-text("Done")');
  ok('Done: back on the last bin\'s page', /Bin C12/.test(await txt('#settingsView')));
  // the other way round: the item first, then the bin
  await p.evaluate(() => { B.pick = null; go('binsAdd'); });
  await p.click('button:has-text("Place by scanning")');
  const code2 = await p.evaluate(() => bins.products[3].variants[4].barcode);
  await type(code2);
  ok('item first: asks for the bin', /now scan the bin/.test(await txt('.scanner .scanresult')));
  await type('C13');
  ok('then the bin: asks to confirm', /Add to C13\?/.test(await txt('.scanner .scanresult')));
  await p.click('.scanner .scanresult button:has-text("Add to C13")');
  ok('confirmed: in C13', await p.evaluate(() => bins.products[3].variants[4].bins.some(b => b.bin === 'C13')));
  await p.click('.scanner button:has-text("Done")');

  // inventory changes: off = read only; on = editable
  await p.evaluate(() => { openProduct('p4', 'D40', 'p4v1'); });
  ok('inventory changes off: details can\'t be edited', !(await p.$('#binSheet input[aria-label="Barcode"]')));
  await p.click('#binSheet .detailhead button:has-text("Back")');
  await p.evaluate(() => go('more'));
  await p.click('button:has-text("Turn on") >> nth=-1');
  await p.evaluate(() => { openProduct('p4', 'D40', 'p4v1'); });
  ok('inventory changes on: details can be edited', !!(await p.$('#binSheet input[aria-label="Barcode"]')));
  await p.click('#binSheet .detailhead button:has-text("Back")');

  // History, and nothing else in the app touched
  await p.evaluate(() => go('binsHistory'));
  ok('History lists the changes', (await p.$$eval('#settingsView .drow', r => r.length)) >= 4);
  await p.click('#navBtn');
  await p.click('#exampleBtn');
  const after = await p.evaluate(() => JSON.stringify({ s: localStorage.getItem('pick-and-sort-settings-v2') }));
  ok('picking is unchanged: the example orders use their own bins', await p.evaluate(() => plan.picks[0].box === plan.picks[0].box && !plan.picks.some(x => x.box === 'D40')));
  ok('settings untouched by Bins (kept separately)', before === after);
  ok('no page errors', !errs.length, errs.join(' / '));
  console.log(bad ? `${bad} FAILED` : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();

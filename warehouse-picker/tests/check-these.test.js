const { chromium, devices } = require('playwright');
const fs = require('fs');
(async () => {
  const S = require('os').tmpdir(); const url = process.argv[2] || 'http://localhost:8765/index.html';
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url);
  await p.addScriptTag({ path: __dirname + '/slipgen.js' });
  await p.evaluate(() => { settings.units = [makeAisle({ letter: 'A', shelves: 6, per: '10' }), makeAisle({ letter: 'B', shelves: 4, per: '10' })]; settings.walk = settings.units.map(u => u.id); saveSettings(); });
  const blank = (t, v, bin, qty, sku = 'BO9019') => ({ title: t, variant: v, sku, barcode: '4741631147998', bin, qty });
  const b64 = await p.evaluate(blank => {
    const B = (t, v, bin, qty, sku = 'BO9019') => ({ title: t, variant: v, sku, barcode: '4741631147998', bin, qty });
    const buf = makeSlips([
      { number: '80001', items: [B('Bebe Organic Cuddle Horse Blanket', 'Faded Blue', 'A52', 1), B('Bib', null, 'B3', 1, 'BB100')] },              // fine
      { number: '80002', items: [B('Ribbed Onesie', 'Oatmeal / 3-6M', 'A14', 1, 'RO3601'), B('Bib', null, 'B3', 1, 'BB100')], total: 3 },        // total says 3
      { number: '80003', items: [B('Ribbed Onesie', 'Navy / 0-3M', '', 1, 'RO0301')] },                                                        // no bin
      { number: '80004', items: [B('Bebe Organic Cuddle Horse Blanket', 'Faded Rose', 'A52', null, 'BO9020')], noTotal: true },                // no quantity, no total
      { number: '80001', items: [B('Bebe Organic Cuddle Horse Blanket', 'Faded Blue', 'A52', 1), B('Bib', null, 'B3', 1, 'BB100')] },              // printed twice
      { number: 'x', noNumber: true, items: [B('Wooden Teether Ring', 'Natural', 'B26', 2, 'WT200')] },                                          // no order number
    ]);
    let s = ''; new Uint8Array(buf).forEach(c => s += String.fromCharCode(c)); return btoa(s);
  });
  fs.writeFileSync(S + '/problems.pdf', Buffer.from(b64, 'base64'));
  await p.setInputFiles('#fileInput', S + '/problems.pdf');
  await p.waitForFunction(() => document.getElementById('fileName').textContent === 'problems.pdf', null, { timeout: 30000 });
  const state = async label => console.log(`--- ${label}\n` + (await p.$eval('#warnings', e => e.innerText)) + '\n' + (await p.$eval('#review', e => e.innerText)).replace(/\n+/g, '\n'));
  await state('after reading');
  const card = n => p.locator('.reviewcard').filter({ hasText: n });
  // 80002: the missing item is a Bib in B3... the slip says 3, so add the missing item
  await card('#80002').locator('text=+ Add a missing item').click();
  const last = card('#80002').locator('.fixrow').last();
  await last.locator('.fixname').fill('Knit Pom Pom Hat'); await last.locator('.fixname').dispatchEvent('change');
  await last.locator('.fixbin').fill('a-7'); await last.locator('.fixbin').dispatchEvent('change');
  console.log('80002 count now:', await card('#80002').locator('text=/Items now/').innerText());
  await card('#80002').locator('text=Confirmed ✓').click();
  // 80003: type the bin
  await card('#80003').locator('.fixbin').fill('A15'); await card('#80003').locator('.fixbin').dispatchEvent('change');
  await card('#80003').locator('text=Confirmed ✓').click();
  // 80004: quantity is really 2
  await card('#80004').locator('.fixqty').fill('2'); await card('#80004').locator('.fixqty').dispatchEvent('change');
  await card('#80004').locator('text=Confirmed ✓').click();
  // duplicate 80001: leave it used once
  await card('#80001').locator('text=Confirmed ✓').click();
  // no order number: type it
  const nn = p.locator('.reviewcard').filter({ hasText: 'page 6' });
  await nn.locator('input[placeholder="type it"]').fill('80005'); await nn.locator('input[placeholder="type it"]').dispatchEvent('change');
  await nn.locator('text=Confirmed ✓').click();
  await state('after checking');
  console.log('ORDERS:', await p.$$eval('#tab-key .key > div', ds => ds.map(d => d.innerText.replace(/\s+/g, ' '))));
  console.log('PICK:\n  ' + (await p.$$eval('#tab-pick tbody tr', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ').trim()))).join('\n  '));
  console.log('errors', errs); await b.close();
})();

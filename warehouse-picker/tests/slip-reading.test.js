const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/index.html';
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url);
  await p.addScriptTag({ path: __dirname + '/slipgen.js' });
  const runs = [{ a4: true, sameLineHeader: true, lh: 15, binDy: 1.55, qtyDy: 1.55, nameW: 228, itemGap: 0, label: 'HARD: no space between items' }, { a4: true, sameLineHeader: true, lh: 15, binDy: 1.55, qtyDy: 1.55, nameW: 228 }, { a4: true, sameLineHeader: true, lh: 15, binDy: 1.55, qtyDy: 1.55, nameW: 150 }, {}, { lh: 12, fs: 9, binDy: 0, qtyDy: 0 }, { lh: 16, fs: 12, binDy: 1, qtyDy: 0.8, qtyWord: 'Qty' }, { lh: 13, binDy: -0.3, qtyDy: 0.6, nameW: 200 }, { lh: 15, binDy: 1.4, qtyDy: 1.2, nameW: 150 }];
  for (const opt of runs) {
  const result = await p.evaluate(async (opt) => {
    // ---- the truth: 60 orders built from varied products ----
    let seed = 7; const rnd = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
    const products = [
      ['Bebe Organic Cuddle Horse Blanket', ['Faded Blue', 'Faded Rose', 'Faded Sage']],
      ['Ribbed Onesie', ['Oatmeal - 3-6M', 'Oatmeal - 6-12M', 'Navy - 0-3M', 'Navy / 12-18M']],
      ['Knit Pom Pom Hat', ['Cream / NB', 'Cream / 0-6M', 'Blush / 6-12M']],
      ['Bib', [null]],
      ['Hat', ['XL']],
      ['Mother-Daughter Matching Dress Set with Ruffle Sleeves and Embroidered Collar Limited Edition', ['Pink - 2T', 'Pink - 3T', 'Ivory - 4T']],
      ['Muslin Swaddle Set of 3', ['Sage Leaves', 'Blue Stars']],
      ['Cotton Socks 6 Pack', ['White - 0-6M', 'White - 6-12M', 'Grey - 2XL']],
      ['Sleep Sack 1.0 TOG', ['Grey - S', 'Grey - M', 'Grey - L']],
      ['Lil Legs Limited Capsule Toddler Sweatshirt Set', ['Deep Red - 2T', 'Deep Red - 3T', 'Heather Grey - 4T', 'Navy - 18-24M']],
      ['Wooden Teether Ring', ['Natural']],
      ['Organic Cotton Hooded Towel and Washcloth Gift Set for Newborns', ['Dusty Rose / One Size', 'Dusty Blue / One Size']],
    ];
    const bins = ['A52', 'A7', 'A14', 'B3', 'B26', 'C104', 'AA12', 'D9', 'E45', 'B40'];
    const orders = [];
    for (let k = 0; k < 60; k++) {
      const n = k === 0 ? 2 : k % 9 === 0 ? 14 + rnd(10) : 1 + rnd(6); // some long orders that run over pages
      const items = [];
      for (let i = 0; i < n; i++) {
        const [title, vars] = products[rnd(products.length)];
        const variant = vars[rnd(vars.length)];
        const sku = rnd(7) === 0 ? '' : 'BO' + (9000 + rnd(900));
        const barcode = rnd(9) === 0 ? '' : '47416311' + String(10000 + rnd(89999));
        items.push({ title, variant, sku, barcode, bin: bins[rnd(bins.length)], qty: rnd(5) === 0 ? 2 + rnd(11) : 1 });
      }
      if (k === 0) { // exactly the photo
        items.splice(0, 2,
          { title: 'Bebe Organic Cuddle Horse Blanket', variant: 'Faded Blue', sku: 'BO9019', barcode: '4741631147998', bin: 'A52', qty: 1 },
          { title: 'Bebe Organic Cuddle Horse Blanket', variant: 'Faded Rose', sku: 'BO9020', barcode: '4741631147981', bin: 'A52', qty: 1 });
      }
      orders.push({ number: k === 0 ? '53625' : k === 5 ? 'MO53630' : String(53625 + k), items, repeatHeader: k % 2 === 0, repeatTable: k % 3 === 0 });
    }
    const buf = makeSlips(orders, opt);
    const parsed = parseSlips(await pdfWords(buf));
    // ---- compare every item ----
    const problems = [], unflagged = [], flaggedClean = [];
    let itemsChecked = 0, pages = (await window.pdfjsLib.getDocument({ data: makeSlips(orders, opt) }).promise).numPages;
    if (parsed.orders.length !== orders.length) problems.push(`orders: expected ${orders.length}, read ${parsed.orders.length}`);
    orders.forEach((o, oi) => {
      const got = parsed.orders[oi];
      if (!got) return;
      if (got.order !== o.number) problems.push(`order ${o.number}: read number "${got.order}"`);
      const before = problems.length;
      if (got.items.length !== o.items.length) problems.push(`order ${o.number}: expected ${o.items.length} items, read ${got.items.length}`);
      o.items.forEach((it, ii) => {
        const g = got.items[ii]; itemsChecked++;
        if (!g) return;
        const want = { name: it.title, details: it.variant || '', sku: it.sku, barcode: it.barcode, bin: normBox(it.bin), qty: it.qty };
        for (const k of Object.keys(want)) if (String(g[k]) !== String(want[k])) problems.push(`order ${o.number} item ${ii + 1} ${k}: expected "${want[k]}", read "${g[k]}"`);
      });
      const flagged = slipProblems(got, got.items.map(it => ({ name: it.name, code: it.sku, box: it.bin || '?', qty: it.qty, qtyMissing: it.qtyMissing }))).length > 0;
      if (problems.length > before && !flagged) unflagged.push(o.number);
      if (problems.length === before && flagged) flaggedClean.push(o.number);
    });
    return { problems, unflagged, flaggedClean, itemsChecked, pages, warnings: parsed.warnings, checked: parsed.checked, all: parsed.all, longest: Math.max(...orders.map(o => o.items.length)) };
  }, opt);
  console.log('layout', JSON.stringify(opt));
  console.log(`pages: ${result.pages}, slips: ${result.all}, slips adding up to "Total items": ${result.checked}, items compared: ${result.itemsChecked}, biggest order: ${result.longest} items`);
  console.log(`mistakes: ${result.problems.length}, of which NOT flagged for checking: ${result.unflagged.length}${result.unflagged.length ? ' ' + result.unflagged.join(',') : ''}; clean slips flagged anyway: ${result.flaggedClean.length}`);
  if (result.unflagged.length) result.problems.slice(0, 10).forEach(x => console.log('  ' + x));
  console.log('warnings:', result.warnings.slice(0, 5));
  }
  console.log('errors', errs); await b.close();
})();

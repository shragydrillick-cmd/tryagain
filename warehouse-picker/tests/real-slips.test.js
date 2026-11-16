// The real slips sent in so far (only their item tables, from fixtures/real-slips.json: no names or addresses),
// read one at a time and all together. Every field must be exactly right, and scanning each barcode must
// find its item.
const { chromium } = require('playwright'); require('./noauth')(chromium);
const slips = require('./fixtures/real-slips.json');
const want = [
  [{ name: 'Lil Legs Limited Capsule Toddler Sweatshirt Set', details: 'Deep Red - 2T', sku: 'LL2207-2T', barcode: '735380754426', bin: 'C87', also: '', qty: 1 }],
  [{ name: 'Lil Legs Fan Club Big Logo Boys Sweatshirt- (NO WORDS)', details: 'Navy - 7Y', sku: 'LL2094-7Y', barcode: '735380950477', bin: 'C106', also: '', qty: 1 },
   { name: 'Lil Legs Velour Crest Lounge Set', details: 'Black - 7Y', sku: 'LL2232-7Y', barcode: '735380912611', bin: 'D91', also: 'D97', qty: 1 }], // kept in two boxes
  [{ name: 'Little Parni V-Neck Footie And Hat (PJ131)', details: 'Pink - 6M', sku: 'LP2076-6M', barcode: 'PJ131PNK 6M', bin: 'B88', also: '', qty: 1 }], // barcode in letters
  [{ name: 'Little Parni Pleated Skirt (K683)', details: 'Black - 8Y', sku: 'LP2015-8Y', barcode: 'K683BLK8Y', bin: 'B107', also: '', qty: 1 }],
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.argv[2] || 'http://localhost:8765/index.html');
  const res = await p.evaluate(({ slips, want }) => {
    const problems = [];
    const check = (parsed, wants, label) => {
      if (parsed.orders.length !== wants.length) problems.push(`${label}: ${parsed.orders.length} slips read, expected ${wants.length}`);
      wants.forEach((items, si) => {
        const o = parsed.orders[si]; if (!o) return;
        if (o.unsure) problems.push(`${label} slip ${si + 1}: marked "check this"`);
        if (o.items.length !== items.length) problems.push(`${label} slip ${si + 1}: ${o.items.length} items read, expected ${items.length}`);
        if (o.total !== items.reduce((a, x) => a + x.qty, 0)) problems.push(`${label} slip ${si + 1}: total ${o.total}`);
        items.forEach((w, ii) => { const g = o.items[ii]; if (!g) return;
          for (const k in w) { const v = Array.isArray(g[k]) ? g[k].join(', ') : String(g[k] ?? ''); if (v !== String(w[k])) problems.push(`${label} slip ${si + 1} item ${ii + 1} ${k}: read "${v}", expected "${w[k]}"`); } });
      });
      return parsed;
    };
    slips.forEach((pages, i) => check(parseSlips(pages), [want[i]], `slip ${i + 1} alone`));
    const all = check(parseSlips(slips.flat()), want, 'all together');
    // the whole way through: list, plan, and scanning each barcode
    const lines = slipsToLines(all); plan = makePlan(lines, settings);
    want.flat().forEach(w => { const hit = matchLines(w.barcode); if (hit.length !== 1 || hit[0].sku !== w.sku) problems.push(`scanning ${w.barcode}: found ${hit.length}`); });
    return { problems, items: want.flat().length };
  }, { slips, want });
  console.log(`real slips: ${slips.length}, items: ${res.items}, mistakes: ${res.problems.length}`);
  res.problems.forEach(x => console.log('  ' + x));
  console.log('errors', errs); await b.close();
  process.exit(res.problems.length || errs.length ? 1 : 0);
})();

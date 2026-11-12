// many random aisles: does the map built from just the two ends always match the real layout exactly?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto(process.argv[2] || 'http://localhost:8765/index.html');
  const r = await p.evaluate(() => {
    let seed = 11; const rnd = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
    let ok = 0, asked = 0, wrong = 0, cases = 0;
    for (let t = 0; t < 400; t++) {
      const S = 2 + rnd(7), W = 5 + rnd(40), counts = Array(S).fill(W);
      const shortOnes = rnd(3); for (let k = 0; k < shortOnes; k++) counts[rnd(S)] -= 1 + rnd(2);
      if (counts.some(c => c < 1)) continue;
      const fromBottom = rnd(2) === 1, startRight = rnd(2) === 1;
      const sim = simulateColumns(counts, 1, fromBottom);
      const d = { letter: 'C', shelves: S, left: (startRight ? sim.end : sim.start).map(x => 'C' + x), right: (startRight ? sim.start : sim.end).map(x => 'C' + x), dirForced: null };
      cases++;
      if (checkDraft(d)) { asked++; continue; }
      // compare every box: real layout vs. the map made from the ends
      const truth = counts.map(() => []); let n = 1; const order = [...Array(S).keys()]; if (fromBottom) order.reverse();
      for (let c = 0; c < Math.max(...counts); c++) for (const s of order) if (c < counts[s]) truth[s].push('C' + n++);
      const made = aisleShelves(draftToSpec(d)).map(sh => shelfBoxes(sh).boxes);
      const same = truth.every((row, s) => { const phys = startRight ? row.slice().reverse() : row; return phys.join() === made[s].join(); });
      same ? ok++ : wrong++;
    }
    return { cases, ok, asked, wrong };
  });
  console.log(`random aisles: ${r.cases} | mapped exactly right: ${r.ok} | asked a question instead: ${r.asked} | WRONG map: ${r.wrong}`);
  await b.close();
})();

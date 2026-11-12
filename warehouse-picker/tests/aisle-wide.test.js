// random aisles, some with one wide box (two spaces); a "person" answers every question truthfully. Run: node aisle-wide.test.js [plain] [url]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto(process.argv[3] || 'http://localhost:8765/index.html');
  const r = await p.evaluate((WIDE) => {
    let seed = 11; const rnd = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
    const st = { cases: 0, ok: 0, wideNotSeen: 0, wrong: 0, stuck: 0, questions: 0, kinds: {}, samples: [] };
    for (let t = 0; t < 600; t++) {
      const S = 2 + rnd(7), W = 5 + rnd(40), counts = Array(S).fill(W);
      const shortOnes = rnd(3); for (let k = 0; k < shortOnes; k++) counts[rnd(S)] -= 1 + rnd(2);
      if (counts.some(c => c < 3)) continue;
      const fromBottom = rnd(2) === 1, startRight = rnd(2) === 1;
      // maybe one wide box: shelf ws, at column wc (0 .. its last space - 1)
      const wide = Array(S).fill(null);
      let ws = -1;
      if (WIDE && rnd(2)) { ws = rnd(S); const wc = rnd(counts[ws] - 1); wide[ws] = { col: wc }; }
      // truth: number the spaces
      const order = [...Array(S).keys()]; if (fromBottom) order.reverse();
      const truth = counts.map(() => []); let n = 1; const skip = Array(S).fill(-1), wideNum = Array(S).fill(null);
      for (let c = 0; c < Math.max(...counts); c++) for (const s of order) {
        if (c >= counts[s]) continue;
        if (skip[s] === c) { truth[s].push(null); continue; }
        if (wide[s] && wide[s].col === c) { skip[s] = c + 1; wideNum[s] = n; }
        truth[s].push(n++);
      }
      const first = truth.map(r => r[0]), last = truth.map(r => r.filter(x => x != null).pop());
      const d = { letter: 'C', shelves: S, left: (startRight ? last : first).map(x => 'C' + x), right: (startRight ? first : last).map(x => 'C' + x), dirForced: null };
      st.cases++;
      let q, guard = 0, stuck = false;
      while ((q = checkDraft(d)) && guard++ < 6) {
        st.questions++;
        const kind = q.input ? 'which wide box' : q.options && q.options[0] && q.options[0].label === "Yes, that's right" ? 'confirm' : /could be more than one/.test(q.text) ? 'choose' : 'other';
        st.kinds[kind] = (st.kinds[kind] || 0) + 1;
        if (kind === 'which wide box') { const wn = wideNum.find(x => x != null);
          if (wn == null) { const o = (q.options || []).find(o => /No box/.test(o.label)); if (o) { o.apply(); continue; } }
          const err = wn != null ? q.input.apply('C' + wn) : 'no truth'; if (err) { stuck = true; if (st.samples.length < 8) st.samples.push(q.text + ' => ' + err + ' counts ' + counts + ' wide ' + wideNum); break; } }
        else if (kind === 'confirm') {
          const wideOpt = q.options.find(o => /wide/.test(o.label));
          const sh = [...Array(S).keys()].find(i => q.text.includes(theShelf(i, S)));
          if (wideOpt && wideNum[sh] != null) { wideOpt.apply(); if (d.wideAsk && Object.keys(d.wideAsk).length) { const e = checkDraft(d).input.apply('C' + wideNum[sh]); if (e) { stuck = true; break; } } }
          else q.options[0].apply();
        } else if (kind === 'choose') {
          // pick the choice matching the truth
          const o = q.options.find(o => { o.apply(); const sol = solveColumns(d); d.chosen = null; return sol && sol.counts.every((c, i) => c === counts[i]) && sol.wide.some(w => w != null) === wideNum.some(w => w != null); });
          if (!o) { stuck = true; if (st.samples.length < 8) st.samples.push('no matching choice: ' + q.text + ' ' + q.options.map(o => o.label).join(' / ') + ' truth ' + counts + ' wide ' + wideNum); break; }
          o.apply();
        } else { stuck = true; if (st.samples.length < 8) st.samples.push('OTHER: ' + q.text + ' | counts ' + counts + ' wide ' + JSON.stringify(wide) + ' fb ' + fromBottom); break; }
      }
      if (stuck || q) { st.stuck++; continue; }
      const made = aisleShelves(draftToSpec(d)).map(sh => shelfBoxes(sh).cells.map(c => c.code + (c.span > 1 ? '+' : '')));
      const same = truth.every((row, s) => {
        const cells = []; row.forEach(x => { if (x == null) cells[cells.length - 1] += '+'; else cells.push('C' + x); });
        // a wide LAST box can't be told from a shorter shelf by the numbers: only the empty end space differs
        if (cells.length && cells[cells.length - 1].endsWith('+')) { cells[cells.length - 1] = cells[cells.length - 1].slice(0, -1); const m = made[s]; const i = startRight ? 0 : m.length - 1; m[i] = m[i].replace('+', ''); }
        const phys = startRight ? cells.reverse() : cells; return phys.join() === made[s].join(); });
      const sameBoxes = truth.every((row, s) => { const r = row.filter(x => x != null).map(x => 'C' + x); return (startRight ? r.reverse() : r).join() === made[s].map(c => c.replace('+', '')).join(); });
      if (same) st.ok++; else if (sameBoxes) { st.wideNotSeen = (st.wideNotSeen || 0) + 1; } else { st.wrong++; st.samples.unshift('WRONG counts ' + counts + ' wide ' + JSON.stringify(wide) + ' fb ' + fromBottom + ' sr ' + startRight + ' ends ' + d.left + ' / ' + d.right + ' wb ' + d.wideBox + ' made ' + JSON.stringify(made)); }
    }
    return st;
  }, process.argv[2] !== 'plain');
  console.log(`random aisles: ${r.cases} | mapped exactly right: ${r.ok} | every box right but a wide box the numbers can't show: ${r.wideNotSeen} | stuck on a question: ${r.stuck} | WRONG map: ${r.wrong}`);
  console.log('questions asked:', JSON.stringify(r.kinds)); if (r.wrong) console.log(r.samples.filter(x => /^WRONG/.test(x)).join('\n'));
  await b.close();
})();

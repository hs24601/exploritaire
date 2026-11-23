// Daylight balance pass for village.html surfaces.
// Run: npx vite-node tools/village-daylight-sim.ts [runs]
import { rng } from '../src/village/rules/golf';
import { casual, planner, playOut, type RunStats } from '../src/village/rules/players';
import { SURFACE_ORDER, SURFACES } from '../src/village/rules/surfaces';
import { DAYLIGHT } from '../src/village/rules/daylight';

const N = Number(process.argv[2] ?? 400);
const pct = (xs: number[], p: number) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

for (const wrap of [true, false]) {
  console.log(`\n=== wrap ${wrap ? 'on' : 'off'} ===`);
  for (const id of SURFACE_ORDER) {
    for (const [label, mk] of [['casual', (s: number) => casual(rng(s * 7 + 1))], ['planner', () => planner(6)]] as const) {
      const stats: RunStats[] = [];
      for (let s = 1; s <= N; s++) {
        const run = SURFACES[id].deal(s);
        run.wrap = wrap;
        stats.push(playOut(run, mk(s)));
      }
      const minutes = stats.map(st => DAYLIGHT.startMinutes + st.plays * DAYLIGHT.playMinutes + st.draws * DAYLIGHT.drawMinutes);
      const perUnit = stats.map((st, i) => minutes[i] / Math.max(1, st.earned));
      console.log(`${id.padEnd(8)} ${label.padEnd(8)} plays ${mean(stats.map(s => s.plays)).toFixed(1).padStart(5)}  draws ${mean(stats.map(s => s.draws)).toFixed(1).padStart(5)}  earned ${mean(stats.map(s => s.earned)).toFixed(1).padStart(5)}  cleared ${(100 * mean(stats.map(s => +s.cleared))).toFixed(0).padStart(3)}%  chain med ${pct(stats.map(s => s.bestChain), 0.5)}  full-run min ${mean(minutes).toFixed(0)}  min/unit ${mean(perUnit).toFixed(1)}`);
    }
  }
}

// A whole day on one surface: keep starting runs until dusk. "Stayer" turns the
// whole stock every run; "leaver" walks off once three draws in a row paid < 2 units each.
import { draw, play, runEnd } from '../src/village/rules/golf';
console.log('\n=== one day (14h) on one surface, planner play ===');
for (const id of SURFACE_ORDER) {
  for (const leaver of [false, true]) {
    const totals: number[] = [];
    const runsPerDay: number[] = [];
    for (let d = 1; d <= 100; d++) {
      let minutes = 0, units = 0, runs = 0, seed = d * 1000;
      const p = planner(5);
      while (DAYLIGHT.dayMinutes - minutes > DAYLIGHT.startMinutes) {
        let r = SURFACES[id].deal(seed++); minutes += DAYLIGHT.startMinutes; runs++;
        const sinceDraw: number[] = []; let mark = 0;
        while (!runEnd(r) && minutes < DAYLIGHT.dayMinutes) {
          const m = p(r);
          if (m === 'draw') {
            sinceDraw.push(r.earned - mark); mark = r.earned;
            if (leaver && sinceDraw.length >= 4 && sinceDraw.slice(-3).every(x => x < 2)) break;
            if (DAYLIGHT.dayMinutes - minutes < DAYLIGHT.drawMinutes) break;
            r = draw(r); minutes += DAYLIGHT.drawMinutes;
          } else { r = play(r, m); minutes += DAYLIGHT.playMinutes; }
        }
        units += r.earned;
      }
      totals.push(units); runsPerDay.push(runs);
    }
    console.log(`${id.padEnd(8)} ${leaver ? 'leaver' : 'stayer'}  units/day ${mean(totals).toFixed(0).padStart(4)}  runs/day ${mean(runsPerDay).toFixed(1)}`);
  }
}

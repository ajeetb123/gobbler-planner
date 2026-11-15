// Run: npm run backtest
// Tunes on validation terms (Fall 2021, Spring 2022), reports on held-out test terms (Fall 2022 to Spring 2024).
import { loadUdc } from '../src/grades/udc.ts';
import { BASELINE_PARAMS, type EstimatorParams } from '../src/grades/estimate.ts';
import { backtest, metrics, type Metrics, type Scored } from '../src/grades/backtest.ts';
import { calibrate, range } from '../src/grades/intervals.ts';
import { defaultGrid, tune } from '../src/grades/tune.ts';
import { ambiguousKeys } from '../src/identity/ambiguity.ts';

const rows = loadUdc(['data/udc_2019_2022.csv', 'data/udc_2022_2024.csv']);
const VALID = [4043, 4044];
const TEST = [4045, 4046, 4047, 4048];

const fmt = (m: Metrics) =>
  `MAE ${m.mae.toFixed(4)}  RMSE ${m.rmse.toFixed(4)}  pairs ${(m.pairAccuracy * 100).toFixed(1)}% of ${m.pairs}  ` +
  Object.entries(m.maeByBasis).map(([k, v]) => `${k}:${v.mae.toFixed(3)}`).join(' ');

const courseOnly: EstimatorParams = { ...BASELINE_PARAMS, kIC: 1e12 }; // ignores the instructor
const raw: EstimatorParams = BASELINE_PARAMS; // what most grade sites show: the raw instructor-course mean
const lastOnly: EstimatorParams = { ...BASELINE_PARAMS, decay: 1e-6 }; // only the most recent term the pair was taught

console.log('Baselines on TEST');
console.log('  course mean only     ', fmt(backtest(rows, TEST, courseOnly).m));
console.log('  raw instructor mean  ', fmt(backtest(rows, TEST, raw).m));
console.log('  most recent term only', fmt(backtest(rows, TEST, lastOnly).m));

// Iteration 2 showed that tuning once on Fall 2021/Spring 2022 overfits the post-COVID regime.
// Walk-forward: before each test term t, pick params by MAE on terms t-2 and t-1 (each predicted
// from its own past), then predict t. This mirrors how the live site would retune every term.
const grid = defaultGrid();

const label = (p: EstimatorParams) =>
  `kIC=${p.kIC} decay=${p.decay} exclCovid=${p.excludeTerms.size > 0} instrEff=${p.useInstructorEffect} kInstr=${p.kInstr} newPairs=${p.effectForNewPairs}`;

// Iteration 6: skip cross-course pooling for instructor keys that may merge several people.
// Flags are computed from training terms only, so the test term never leaks into them.
const USE_AMBIGUITY = process.env.NO_AMBIGUITY !== '1';
const scored: Scored[] = [];
const cover = new Map<string, { n: number; hit: number; width: number }>();
for (const t of TEST) {
  const amb = USE_AMBIGUITY ? ambiguousKeys(rows.filter((r) => r.term < t)) : undefined;
  const best = tune(rows, t, grid, amb);
  console.log(`term ${t}: chose ${label(best)}${amb ? ` (ambiguous keys skipped: ${amb.size})` : ''}`);
  const cal = calibrate(backtest(rows, [t - 2, t - 1], best).scored, 0.8);
  const termScored = backtest(rows, [t], best).scored;
  scored.push(...termScored);
  for (const s of termScored) {
    const [lo, hi] = range(cal, s.pred.gpa, s.pred.students, s.row.graded);
    const k = s.pred.students === 0 ? 'no history' : s.pred.students < 50 ? '<50 students' : s.pred.students < 200 ? '50-199' : '200+';
    for (const key of ['ALL', k]) {
      const e = cover.get(key) ?? { n: 0, hit: 0, width: 0 };
      e.n++; e.hit += s.row.gpa >= lo && s.row.gpa <= hi ? 1 : 0; e.width += hi - lo;
      cover.set(key, e);
    }
  }
}
const tuned = metrics(scored);
console.log('\nWalk-forward tuned on TEST');
console.log('  tuned estimator      ', fmt(tuned));
const share = Object.entries(tuned.maeByBasis).map(([k, v]) => `${k} ${((v.students / tuned.students) * 100).toFixed(1)}%`);
console.log('  share of test students by basis:', share.join(', '));

console.log('\n80% ranges on TEST (target coverage 80%)');
for (const [k, e] of [...cover].sort()) console.log(`  ${k.padEnd(14)} sections ${String(e.n).padStart(5)}  coverage ${(e.hit / e.n * 100).toFixed(1)}%  mean width ${(e.width / e.n).toFixed(2)} GPA`);

// Where does the gain come from, and is it real? Paired comparison against the raw mean,
// split by history size, plus a bootstrap over courses (sections of one course are correlated).
const rawScored = backtest(rows, TEST, raw).scored;
const rawByKey = new Map(rawScored.map((s) => [`${s.row.term}|${s.row.crn}`, s]));
const buckets = new Map<string, { w: number; raw: number; tuned: number }>();
const perCourse = new Map<string, { raw: number; tuned: number }>();
for (const s of scored) {
  const r = rawByKey.get(`${s.row.term}|${s.row.crn}`)!;
  const n = s.row.graded;
  const k = s.pred.students === 0 ? 'no history' : s.pred.students < 50 ? '<50 students' : s.pred.students < 200 ? '50-199' : '200+';
  for (const key of ['ALL', k]) {
    const b = buckets.get(key) ?? { w: 0, raw: 0, tuned: 0 };
    b.w += n; b.raw += Math.abs(r.err) * n; b.tuned += Math.abs(s.err) * n;
    buckets.set(key, b);
  }
  const c = perCourse.get(s.row.course) ?? { raw: 0, tuned: 0 };
  c.raw += Math.abs(r.err) * n; c.tuned += Math.abs(s.err) * n;
  perCourse.set(s.row.course, c);
}
console.log('\nMAE, raw instructor mean vs tuned, by history behind the estimate');
for (const [k, b] of [...buckets].sort())
  console.log(`  ${k.padEnd(14)} students ${String(b.w).padStart(7)}  raw ${(b.raw / b.w).toFixed(3)}  tuned ${(b.tuned / b.w).toFixed(3)}  change ${(((b.tuned - b.raw) / b.raw) * 100).toFixed(1)}%`);

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const courses = [...perCourse.values()];
const diffs: number[] = [];
for (let i = 0; i < 2000; i++) {
  let raw = 0, tuned = 0;
  for (let j = 0; j < courses.length; j++) {
    const c = courses[Math.floor(rand() * courses.length)]!;
    raw += c.raw; tuned += c.tuned;
  }
  diffs.push((tuned - raw) / raw);
}
diffs.sort((a, b) => a - b);
console.log(`\nBootstrap over ${courses.length} courses: MAE change ${(diffs[1000]! * 100).toFixed(1)}%, 95% CI [${(diffs[50]! * 100).toFixed(1)}%, ${(diffs[1950]! * 100).toFixed(1)}%]`);

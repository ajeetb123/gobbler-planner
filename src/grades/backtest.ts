// Rolling-origin backtest: for each test term, fit on earlier terms only, predict every section.
import { History, type EstimatorParams, type Prediction } from './estimate.ts';
import { dedupeSections, type UdcRow } from './udc.ts';

export interface Scored {
  row: UdcRow;
  pred: Prediction;
  err: number; // predicted - actual
}

export interface Metrics {
  sections: number;
  students: number;
  /** Student-weighted mean absolute error of section GPA. */
  mae: number;
  rmse: number;
  /** Same MAE, split by what the estimate was based on. */
  maeByBasis: Record<string, { mae: number; students: number }>;
  /** For two instructors of one course in one term whose real GPAs differ by >= minGap: share ordered correctly. */
  pairAccuracy: number;
  pairs: number;
}

export const isUndergrad = (r: UdcRow) => Number(r.courseNo) < 5000;

export function predictTerm(rows: UdcRow[], term: number, p: EstimatorParams): Scored[] {
  const h = new History(rows, term, p);
  return dedupeSections(rows.filter((r) => r.term === term && isUndergrad(r))).map((row) => {
    const pred = h.predict(row);
    return { row, pred, err: pred.gpa - row.gpa };
  });
}

export function metrics(scored: Scored[], minGap = 0.15): Metrics {
  let w = 0, ae = 0, se = 0;
  const byBasis: Record<string, { ae: number; w: number }> = {};
  for (const s of scored) {
    const n = s.row.graded;
    w += n;
    ae += Math.abs(s.err) * n;
    se += s.err * s.err * n;
    const b = (byBasis[s.pred.basis] ??= { ae: 0, w: 0 });
    b.ae += Math.abs(s.err) * n;
    b.w += n;
  }
  // Pairwise ordering among instructors of the same course and term, both with history.
  const groups = new Map<string, Map<string, { act: number; pred: number; n: number }>>();
  for (const s of scored) {
    if (s.pred.basis !== 'instructor-course') continue;
    const g = groups.get(`${s.row.term}|${s.row.course}`) ?? new Map();
    groups.set(`${s.row.term}|${s.row.course}`, g);
    const k = s.row.instructor;
    const cur = g.get(k) ?? { act: 0, pred: s.pred.gpa, n: 0 };
    cur.act += s.row.gpa * s.row.graded;
    cur.n += s.row.graded;
    g.set(k, cur);
  }
  let pairs = 0, right = 0;
  for (const g of groups.values()) {
    const v = [...g.values()].map((x) => ({ act: x.act / x.n, pred: x.pred }));
    for (let i = 0; i < v.length; i++)
      for (let j = i + 1; j < v.length; j++) {
        const a = v[i]!, b = v[j]!;
        if (Math.abs(a.act - b.act) < minGap) continue;
        pairs++;
        const dp = a.pred - b.pred;
        if (dp === 0) right += 0.5;
        else if (Math.sign(dp) === Math.sign(a.act - b.act)) right += 1;
      }
  }
  const maeByBasis: Metrics['maeByBasis'] = {};
  for (const [k, b] of Object.entries(byBasis)) maeByBasis[k] = { mae: b.ae / b.w, students: b.w };
  return {
    sections: scored.length, students: w, mae: ae / w, rmse: Math.sqrt(se / w),
    maeByBasis, pairAccuracy: pairs ? right / pairs : NaN, pairs,
  };
}

export function backtest(rows: UdcRow[], terms: number[], p: EstimatorParams): { scored: Scored[]; m: Metrics } {
  const scored = terms.flatMap((t) => predictTerm(rows, t, p));
  return { scored, m: metrics(scored) };
}

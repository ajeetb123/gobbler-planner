// Split-conformal style prediction ranges: residual quantiles from recent past terms,
// bucketed by how much history backs the estimate and how large the section is.
import type { Scored } from './backtest.ts';

export type Bucket = string;

/** History buckets (students behind the instructor-course estimate) x section-size buckets. */
export function bucketOf(historyStudents: number, sectionSize: number): Bucket {
  const h = historyStudents === 0 ? 'h0' : historyStudents < 50 ? 'h<50' : historyStudents < 200 ? 'h<200' : 'h200+';
  const s = sectionSize < 20 ? 's<20' : sectionSize < 60 ? 's<60' : 's60+';
  return `${h}|${s}`;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export interface Calibration {
  coverage: number;
  /** Residual (actual - predicted) quantiles per bucket. */
  bands: Map<Bucket, { lo: number; hi: number; n: number }>;
  fallback: { lo: number; hi: number };
}

/** Buckets with fewer calibration sections than this use the pooled band. */
export const MIN_BUCKET = 40;

export function calibrate(calib: Scored[], coverage = 0.8): Calibration {
  const a = (1 - coverage) / 2;
  const by = new Map<Bucket, number[]>();
  const all: number[] = [];
  for (const s of calib) {
    const r = s.row.gpa - s.pred.gpa;
    all.push(r);
    const b = bucketOf(s.pred.students, s.row.graded);
    (by.get(b) ?? by.set(b, []).get(b)!).push(r);
  }
  all.sort((x, y) => x - y);
  const fallback = { lo: quantile(all, a), hi: quantile(all, 1 - a) };
  const bands = new Map<Bucket, { lo: number; hi: number; n: number }>();
  for (const [b, rs] of by) {
    if (rs.length < MIN_BUCKET) continue;
    rs.sort((x, y) => x - y);
    bands.set(b, { lo: quantile(rs, a), hi: quantile(rs, 1 - a), n: rs.length });
  }
  return { coverage, bands, fallback };
}

export function range(c: Calibration, pred: number, historyStudents: number, sectionSize: number): [number, number] {
  const band = c.bands.get(bucketOf(historyStudents, sectionSize)) ?? c.fallback;
  return [Math.max(0, pred + band.lo), Math.min(4, pred + band.hi)];
}

export interface CoverageReport {
  coverage: number;
  meanWidth: number;
  byBucket: Array<{ bucket: Bucket; n: number; coverage: number; width: number }>;
}

export function evaluateCoverage(c: Calibration, test: Scored[]): CoverageReport {
  let hit = 0, width = 0;
  const by = new Map<Bucket, { n: number; hit: number; width: number }>();
  for (const s of test) {
    const [lo, hi] = range(c, s.pred.gpa, s.pred.students, s.row.graded);
    const ok = s.row.gpa >= lo && s.row.gpa <= hi;
    hit += ok ? 1 : 0;
    width += hi - lo;
    const b = bucketOf(s.pred.students, s.row.graded);
    const e = by.get(b) ?? { n: 0, hit: 0, width: 0 };
    e.n++;
    e.hit += ok ? 1 : 0;
    e.width += hi - lo;
    by.set(b, e);
  }
  return {
    coverage: hit / test.length,
    meanWidth: width / test.length,
    byBucket: [...by].map(([bucket, e]) => ({ bucket, n: e.n, coverage: e.hit / e.n, width: e.width / e.n }))
      .sort((x, y) => x.bucket.localeCompare(y.bucket)),
  };
}

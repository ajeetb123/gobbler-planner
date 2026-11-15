// "Does the instructor matter for grades in this course?" (report finding 3).
// Compares the gap between instructors' estimates with gaps a student could actually notice.

export type Verdict = 'barely' | 'some' | 'matters' | 'unknown';

export interface Spread {
  verdict: Verdict;
  /** Highest minus lowest estimate among instructors with enough history. */
  spread: number;
  /** Instructors with enough history to compare. */
  n: number;
  lo: number;
  hi: number;
}

/** An instructor needs this many past students in the course to count in the comparison. */
export const MIN_COMPARE_STUDENTS = 30;
/** Below this gap the verdict is 'barely'; at or above MATTERS_GAP it is 'matters'. Checked by bench/matters.backtest.ts. */
export const BARELY_GAP = 0.2;
export const MATTERS_GAP = 0.4;

export function spreadOf(preds: Array<{ gpa: number; students: number }>): Spread {
  const g = preds.filter((p) => p.students >= MIN_COMPARE_STUDENTS).map((p) => p.gpa);
  if (g.length < 2) return { verdict: 'unknown', spread: 0, n: g.length, lo: g[0] ?? NaN, hi: g[0] ?? NaN };
  const lo = Math.min(...g);
  const hi = Math.max(...g);
  const spread = hi - lo;
  const verdict: Verdict = spread < BARELY_GAP ? 'barely' : spread >= MATTERS_GAP ? 'matters' : 'some';
  return { verdict, spread, n: g.length, lo, hi };
}

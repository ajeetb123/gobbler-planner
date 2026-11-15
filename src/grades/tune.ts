// Walk-forward parameter choice shared by the backtest and the site build:
// before predicting term T, pick the grid point with the lowest MAE on T-2 and T-1.
import { History, type EstimatorParams } from './estimate.ts';
import { backtest } from './backtest.ts';
import { calibrate, type Calibration } from './intervals.ts';
import { ambiguity, type AmbiguityInfo } from '../identity/ambiguity.ts';
import type { UdcRow } from './udc.ts';

/** Spring 2020 to Spring 2021 (pandemic grading). The grid may drop them from training. */
export const COVID_TERMS = new Set([4040, 4041, 4042]);

export function defaultGrid(): EstimatorParams[] {
  const grid: EstimatorParams[] = [];
  for (const kIC of [25, 50, 100, 200, 400])
    for (const decay of [1, 0.85, 0.7, 0.55, 0.4])
      for (const excl of [false, true])
        for (const useInstructorEffect of [false, true])
          for (const kInstr of useInstructorEffect ? [12.5, 25, 50, 100] : [0])
            for (const effectForNewPairs of useInstructorEffect ? [true, false] : [false])
              grid.push({ kIC, decay, excludeTerms: excl ? COVID_TERMS : new Set(), useInstructorEffect, kInstr, weightMode: 'students', effectForNewPairs });
  return grid;
}

/** Best grid point for predicting `target`, judged only on the two terms before it. */
export function tune(rows: UdcRow[], target: number, grid: EstimatorParams[], ambiguous?: Set<string>): EstimatorParams {
  let best: EstimatorParams | undefined;
  let bestMae = Infinity;
  for (const g of grid) {
    const p = { ...g, ambiguous };
    const mae = backtest(rows, [target - 2, target - 1], p).m.mae;
    if (mae < bestMae) { bestMae = mae; best = p; }
  }
  if (!best) throw new Error('empty parameter grid');
  return best;
}

export interface Fit {
  target: number;
  params: EstimatorParams;
  cal: Calibration;
  history: History;
  ambiguity: Map<string, AmbiguityInfo>;
}

/** Everything a page needs to predict `target`: tuned params, calibrated ranges, training aggregates. */
export function fit(rows: UdcRow[], target: number, grid = defaultGrid(), useAmbiguity = true): Fit {
  const amb = ambiguity(rows.filter((r) => r.term < target));
  const flagged = useAmbiguity ? new Set([...amb.values()].filter((a) => a.ambiguous).map((a) => a.key)) : undefined;
  const params = tune(rows, target, grid, flagged);
  const cal = calibrate(backtest(rows, [target - 2, target - 1], params).scored, 0.8);
  return { target, params, cal, history: new History(rows, target, params), ambiguity: amb };
}

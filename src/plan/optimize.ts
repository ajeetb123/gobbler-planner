// Branch-and-bound scheduler. Takes a finished layout (from the greedy packer) and searches for a better one:
// fewer prerequisite conflicts first, then more even term loads, then as little movement as possible.
//
// Why not just try everything: 40 courses over 8 terms is 8^40 layouts. Branch and bound makes that tractable:
//   - branch: place one course at a time, trying terms nearest to where it already sits;
//   - bound:  for a half-built layout, compute the best score any completion could reach. If that is no better
//             than the best full layout found so far, the whole branch is skipped;
//   - windows: a course with two prerequisite levels above it cannot be in term 0, and one with three levels of
//             courses below it cannot be in the last three terms. Each course only tries the terms in its window.
// The search is "anytime": it starts from the greedy answer, so stopping early (node limit) still returns
// something at least as good, and `proven` says whether the search finished.
import { credits, type PlanItem, type Term } from './roadmap.ts';
import { planIssues, type CheckItem } from './prereq.ts';

/** Score weights. One conflict outweighs any imbalance; imbalance outweighs moving courses around. */
export const W_CONFLICT = 1000, W_BALANCE = 4, W_MOVE = 0.25;

export interface OptimizeResult {
  terms: Term[];
  /** True when the search ran to completion: no layout scores better under this model. */
  proven: boolean;
  nodes: number;
  /** Score of the layout that came in and the one that went out (lower is better). */
  before: number;
  after: number;
}

/**
 * Lowest possible imbalance once `rest` more credits are added to `loads`, if credits could be split freely
 * ("water-filling": pour into the emptiest terms until they level out). Real courses come in chunks, so the
 * true value is never lower: that makes it a valid bound.
 */
export function balanceBound(loads: number[], weights: number[], rest: number, mean: number): number {
  const order = loads.map((_, k) => k).sort((a, b) => loads[a]! / weights[a]! - loads[b]! / weights[b]!);
  // Raise the lowest terms to a common level until the remaining credits run out.
  let level = 0, w = 0, used = 0;
  for (let i = 0; i < order.length; i++) {
    const k = order[i]!;
    w += weights[k]!; used += loads[k]!;
    level = (used + rest) / w;
    const next = order[i + 1];
    if (next === undefined || level <= loads[next]! / weights[next]!) break;
  }
  return loads.reduce((sum, load, k) => sum + weights[k]! * (Math.max(load / weights[k]!, level) - mean) ** 2, 0);
}

/** Search budget per layout. Measured Nov 21, 2026 over 852 layouts: 5,000 nodes takes conflicts 52 -> 30 in about 10 s; 100,000 nodes reaches 29 in 164 s. */
export const NODE_LIMIT = 5000;

/** `floor` (optional) gives the earliest term an item may be moved to, by item id: drafts use it to keep upper-level courses out of the first years. */
export function optimize(start: Term[], weights: number[], check: Record<string, CheckItem>, nodeLimit = NODE_LIMIT, floor: Record<string, number> = {}): OptimizeResult {
  const n = start.length;
  const items: PlanItem[] = start.flatMap((t) => t.items);
  const home: Record<string, number> = {};
  start.forEach((t, k) => t.items.forEach((i) => { home[i.id] = k; }));
  const cr: Record<string, number> = Object.fromEntries(items.map((i) => [i.id, i.credits]));
  const total = credits(items), mean = total / weights.reduce((a, b) => a + b, 0);

  // Who must come before whom. Position-independent, so one call with everything in a single term is enough.
  const needs = planIssues(check, [items.map((i) => i.id)], []);
  const before: Record<string, Array<[string, number]>> = {}, after: Record<string, Array<[string, number]>> = {};
  for (const i of items) for (const [j, gap] of needs[i.id]!.needs) {
    (before[i.id] ??= []).push([j, gap]);
    (after[j] ??= []).push([i.id, gap]);
  }
  const tied = items.filter((i) => before[i.id] || after[i.id]);
  const free = items.filter((i) => !before[i.id] && !after[i.id]).sort((a, b) => b.credits - a.credits);

  // Windows: longest chain above (earliest term) and below (latest term). Corequisite pairs point at each other, hence the guard.
  const chain = (id: string, dir: Record<string, Array<[string, number]>>, memo: Record<string, number>, busy: Record<string, boolean>): number => {
    if (memo[id] !== undefined) return memo[id];
    if (busy[id]) return 0;
    busy[id] = true;
    let d = 0;
    for (const [j, gap] of dir[id] ?? []) d = Math.max(d, chain(j, dir, memo, busy) + gap);
    busy[id] = false;
    return (memo[id] = d);
  };
  const up: Record<string, number> = {}, down: Record<string, number> = {};
  const windowOf = (id: string): [number, number] => {
    const lo = Math.max(chain(id, before, up, {}), Math.min(floor[id] ?? 0, home[id]!)), hi = n - 1 - chain(id, after, down, {});
    return lo <= hi ? [lo, hi] : [Math.min(floor[id] ?? 0, home[id]!), n - 1]; // the chain does not fit this many terms: try everything, conflicts will be counted
  };
  const order = [...tied].sort((a, b) => windowOf(a.id)[0] - windowOf(b.id)[0] || windowOf(a.id)[1] - windowOf(b.id)[1] || home[a.id]! - home[b.id]!);

  const violated = (at: Record<string, number>, id: string, t: number): number => {
    let v = 0;
    for (const [j, gap] of before[id] ?? []) if (at[j] !== undefined && at[j] > t - gap) v++;
    for (const [j, gap] of after[id] ?? []) if (at[j] !== undefined && t > at[j] - gap) v++;
    return v;
  };
  const balance = (loads: number[]) => loads.reduce((sum, load, k) => sum + weights[k]! * (load / weights[k]! - mean) ** 2, 0);
  /** Place the unconstrained items one by one where they cost least. Returns the full score and their terms. */
  const finish = (loads: number[]): { cost: number; at: Record<string, number> } => {
    const l = [...loads], at: Record<string, number> = {};
    let move = 0;
    for (const i of free) {
      let best = 0, bestCost = Infinity;
      for (let k = Math.min(floor[i.id] ?? 0, home[i.id]!); k < n; k++) {
        const c = W_BALANCE * weights[k]! * (((l[k]! + i.credits) / weights[k]! - mean) ** 2 - (l[k]! / weights[k]! - mean) ** 2) + W_MOVE * Math.abs(k - home[i.id]!);
        if (c < bestCost) { bestCost = c; best = k; }
      }
      l[best]! += i.credits; at[i.id] = best; move += Math.abs(best - home[i.id]!);
    }
    return { cost: W_BALANCE * balance(l) + W_MOVE * move, at };
  };

  // Score the incoming layout with the same yardstick: it is the first "best so far".
  const startAt: Record<string, number> = { ...home };
  let startConflicts = 0;
  for (const i of tied) for (const [j, gap] of before[i.id] ?? []) if (startAt[j]! > startAt[i.id]! - gap) startConflicts++;
  const beforeCost = W_CONFLICT * startConflicts + W_BALANCE * balance(start.map((t) => credits(t.items)));
  let best = beforeCost, bestAt: Record<string, number> = startAt;

  const freeCredits = credits(free);
  let nodes = 0, proven = true;
  const at: Record<string, number> = {};
  const loads = new Array<number>(n).fill(0);
  const search = (depth: number, cost: number, restTied: number): void => {
    if (nodes >= nodeLimit) { proven = false; return; }
    nodes++;
    if (depth === order.length) {
      const f = finish(loads);
      if (cost + f.cost < best - 1e-9) { best = cost + f.cost; bestAt = { ...at, ...f.at }; }
      return;
    }
    const item = order[depth]!, [lo, hi] = windowOf(item.id);
    const tries = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).sort((a, b) => Math.abs(a - home[item.id]!) - Math.abs(b - home[item.id]!));
    for (const t of tries) {
      const step = W_CONFLICT * violated(at, item.id, t) + W_MOVE * Math.abs(t - home[item.id]!);
      loads[t]! += item.credits;
      // Best case from here: no more conflicts, no more movement, credits spread perfectly.
      if (cost + step + W_BALANCE * balanceBound(loads, weights, restTied - item.credits + freeCredits, mean) < best - 1e-9) {
        at[item.id] = t;
        search(depth + 1, cost + step, restTied - item.credits);
        delete at[item.id];
      }
      loads[t]! -= item.credits;
      if (!proven) return;
    }
  };
  search(0, 0, credits(tied));

  const out: Term[] = start.map((t) => ({ label: t.label, items: [] }));
  for (const i of items) out[bestAt[i.id]!]!.items.push(i);
  // The model only knows "needed" links. Check the real thing before accepting: never return more conflicts than came in.
  const real = (ts: Term[]) => Object.values(planIssues(check, ts.map((t) => t.items.map((i) => i.id)), [])).reduce((a, v) => a + v.late.length + v.coLate.length, 0);
  const keep = best < beforeCost - 1e-9 && real(out) <= real(start);
  return { terms: keep ? out : start, proven, nodes, before: beforeCost, after: keep ? best : beforeCost };
}

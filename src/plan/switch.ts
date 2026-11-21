// Major-switch comparison: which finished courses count toward another major's roadmap.

export interface SwitchItem {
  id: string;
  /** Course codes this slot can stand for. Empty for an elective slot. */
  cs: string[];
  label: string;
  cr: number;
}

export interface SwitchResult {
  /** Finished course -> the slot it fills in the new major (ids). */
  carried: Array<[string, string]>;
  /** Finished elective slot -> an elective slot with the same name in the new major. */
  likely: Array<[string, string]>;
  /** Leftover finished items that fit the new major's free electives, and their credits. */
  free: string[];
  freeUsed: number;
  /** Finished items that match nothing, beyond what the free electives absorb. */
  unmatched: string[];
  /** Credits carried: named + same-name electives + free electives. */
  counted: number;
  doneCredits: number;
  /** Credits still to take in the new major. */
  remaining: number;
}

/**
 * Match finished items from one roadmap against another, each target slot used once:
 * 1) a named course fills a slot that lists the same course (alternatives and choice lists count);
 * 2) a finished elective slot fills an elective slot with the same name;
 * 3) whatever is left fills "Free Elective" credits, up to how many the target has.
 * An estimate from the two roadmaps only. Departments decide what really transfers.
 * Self-contained on purpose: compare-page.ts ships this function's source to the browser. Do not use imports in it.
 */
export function switchCost(from: SwitchItem[], to: SwitchItem[], done: string[]): SwitchResult {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const used: Record<string, boolean> = {};
  const res: SwitchResult = { carried: [], likely: [], free: [], freeUsed: 0, unmatched: [], counted: 0, doneCredits: 0, remaining: 0 };
  const mine = from.filter((i) => done.includes(i.id));
  const left: SwitchItem[] = [];
  for (const i of mine) {
    res.doneCredits += i.cr;
    const named = i.cs.length > 0;
    const hit = to.find((t) => !used[t.id] && (named ? t.cs.some((c) => i.cs.includes(c)) : t.cs.length === 0 && norm(t.label) === norm(i.label)));
    if (!hit) { left.push(i); continue; }
    used[hit.id] = true;
    (named ? res.carried : res.likely).push([i.id, hit.id]);
    res.counted += hit.cr;
  }
  let free = 0;
  for (const t of to) if (!used[t.id] && /free elective/i.test(t.label)) free += t.cr;
  for (const i of left) {
    if (i.cr > 0 && res.freeUsed + i.cr <= free) { res.freeUsed += i.cr; res.free.push(i.id); } else res.unmatched.push(i.id);
  }
  res.counted += res.freeUsed;
  res.remaining = to.reduce((a, t) => a + t.cr, 0) - res.counted;
  return res;
}

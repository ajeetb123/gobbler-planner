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
  /** Of the student's own finished credits, how many found a place. Never more than doneCredits; this is the number to show. `counted` is in the new major's credits (a 3-credit course can fill a 4-credit slot) and is what `remaining` is worked out from. */
  kept: number;
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
  // General-education slots are worded differently on every roadmap ("Pathway 2", "Pathways 2, 3, 6a, or 7",
  // "Critical Thinking in the Humanities (Pathways Concept 2)", "Natural Science Elective"). Two such slots match
  // when they share a Pathways concept: general education is one university-wide requirement, met once.
  const concepts = (label: string): string[] => {
    const l = label.toLowerCase();
    const m = /pathways?\s*(?:concepts?\s*)?(\d[a-z]?(?:\s*(?:,|or|and|\/)\s*(?:or\s*)?\d[a-z]?)*)/.exec(l);
    return m ? m[1]!.match(/\d[a-z]?/g) ?? [] : /natural science/.test(l) ? ['4'] : [];
  };
  const sameConcept = (a: string, b: string) => a === b || (a[0] === b[0] && (a.length === 1 || b.length === 1));
  const genEd = (a: SwitchItem, b: SwitchItem) => concepts(a.label).some((x) => concepts(b.label).some((y) => sameConcept(x, y)));
  const used: Record<string, boolean> = {};
  const res: SwitchResult = { carried: [], likely: [], free: [], freeUsed: 0, unmatched: [], counted: 0, kept: 0, doneCredits: 0, remaining: 0 };
  const mine = from.filter((i) => done.includes(i.id));
  const left: SwitchItem[] = [];
  for (const i of mine) {
    res.doneCredits += i.cr;
    const named = i.cs.length > 0;
    const hit = to.find((t) => !used[t.id] && (named ? t.cs.some((c) => i.cs.includes(c)) : t.cs.length === 0 && norm(t.label) === norm(i.label)))
      ?? (named ? undefined : to.find((t) => !used[t.id] && t.cs.length === 0 && genEd(i, t)));
    if (!hit) { left.push(i); continue; }
    used[hit.id] = true;
    (named ? res.carried : res.likely).push([i.id, hit.id]);
    res.counted += hit.cr;
    res.kept += i.cr;
  }
  let free = 0;
  for (const t of to) if (!used[t.id] && /free elective/i.test(t.label)) free += t.cr;
  for (const i of left) {
    if (i.cr > 0 && res.freeUsed + i.cr <= free) { res.freeUsed += i.cr; res.free.push(i.id); } else res.unmatched.push(i.id);
  }
  res.counted += res.freeUsed;
  res.kept += res.freeUsed;
  res.remaining = to.reduce((a, t) => a + t.cr, 0) - res.counted;
  return res;
}

export interface DoubleResult {
  /** Courses that count for both majors: [first-major item, second-major item]. */
  shared: Array<[string, string]>;
  /** Second-major items the first major does not cover: these are the added work. */
  extraItems: string[];
  /** Credits in the first major's free electives, which the second major's courses can fill. */
  freeRoom: number;
  /** Credits beyond the first major's total. */
  extra: number;
  /** Credits for both majors together. */
  total: number;
}

/**
 * Cost of adding a second major. Each course is counted once:
 * 1) a first-major course fills a second-major slot that lists it (named course, elective slot with the same
 *    name, or a general-education slot for the same Pathways concept). Free-elective slots are left out of this
 *    step on both sides;
 * 2) what the second major still needs is "extra work";
 * 3) the first major's free electives are room to put that extra work in at no added credits, and the second
 *    major's own free electives are already met by the first major's other courses.
 * Total = first major + whatever extra work does not fit in its free electives.
 * An estimate from two roadmaps. Departments limit double counting in ways this cannot see.
 * Self-contained on purpose: compare-page.ts ships this function's source to the browser. Do not use imports in it.
 */
export function doubleMajor(first: SwitchItem[], second: SwitchItem[]): DoubleResult {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isFree = (i: SwitchItem) => i.cs.length === 0 && /free elective/i.test(i.label);
  // General-education slots are worded differently on every roadmap ("Pathway 2", "Pathways 2, 3, 6a, or 7",
  // "Critical Thinking in the Humanities (Pathways Concept 2)", "Natural Science Elective"). Two such slots match
  // when they share a Pathways concept: general education is one university-wide requirement, met once.
  const concepts = (label: string): string[] => {
    const l = label.toLowerCase();
    const m = /pathways?\s*(?:concepts?\s*)?(\d[a-z]?(?:\s*(?:,|or|and|\/)\s*(?:or\s*)?\d[a-z]?)*)/.exec(l);
    return m ? m[1]!.match(/\d[a-z]?/g) ?? [] : /natural science/.test(l) ? ['4'] : [];
  };
  const sameConcept = (a: string, b: string) => a === b || (a[0] === b[0] && (a.length === 1 || b.length === 1));
  const genEd = (a: SwitchItem, b: SwitchItem) => concepts(a.label).some((x) => concepts(b.label).some((y) => sameConcept(x, y)));
  const used: Record<string, boolean> = {};
  const shared: Array<[string, string]> = [];
  for (const a of first) {
    if (isFree(a)) continue;
    const named = a.cs.length > 0;
    const hit = second.find((b) => !used[b.id] && !isFree(b) && (named ? b.cs.some((c) => a.cs.includes(c)) : b.cs.length === 0 && norm(b.label) === norm(a.label)))
      ?? (named ? undefined : second.find((b) => !used[b.id] && !isFree(b) && b.cs.length === 0 && genEd(a, b)));
    if (hit) { used[hit.id] = true; shared.push([a.id, hit.id]); }
  }
  const sum = (xs: SwitchItem[]) => xs.reduce((t, i) => t + i.cr, 0);
  const extraItems = second.filter((b) => !used[b.id] && !isFree(b));
  const freeRoom = sum(first.filter(isFree));
  const extra = Math.max(0, sum(extraItems) - freeRoom);
  return { shared, extraItems: extraItems.map((b) => b.id), freeRoom, extra, total: sum(first) + extra };
}

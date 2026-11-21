// Degree roadmaps: parse the text saved from the VT catalog (data/roadmaps/*.txt) and
// repack a 4-year roadmap into a different number of semesters.

export interface PlanItem {
  /** Stable within a roadmap: "t2-3" = official term 2, item 3. */
  id: string;
  /** "CS 2114" when the slot is one specific course. Undefined for elective slots. */
  code?: string;
  /** Other courses that fill the same slot ("MATH 2534 or MATH 3034"). */
  alt: string[];
  /** Text as the catalog prints it. */
  label: string;
  credits: number;
  /** Listed options for a "Select one of the following" slot. */
  choices: string[];
  /** Index of the official term this item comes from. */
  src: number;
}

export interface Term { label: string; items: PlanItem[] }

export interface Roadmap {
  slug: string;
  name: string;
  /** Path under catalog.vt.edu/undergraduate/. */
  catalogPath: string;
  total: number;
  /** The official plan exactly as the catalog lays it out (may include a Summer term). */
  terms: Term[];
  /** Per-term credit sums as printed in the catalog, for checking the transcription. */
  printedSums: number[];
  /** True when the catalog has no roadmap and the term order is ours (see draft.ts). */
  draft?: boolean;
}

const CODE = /^([A-Z]{2,4}) (\d{4})\b/;

export function parseItems(text: string, src: number): PlanItem[] {
  const items: PlanItem[] = [];
  // Names contain commas and brackets ("Elective (Pathways Concept 2, 3, or 7) (3)"), so an item
  // ends only at "(credits), ". Empty credits "()" mark a choice for the slot before it.
  for (const m of text.matchAll(/(.+?) \((\d*)\), /g)) {
    const label = m[1]!.trim();
    if (m[2] === '') {
      items[items.length - 1]?.choices.push(label);
      continue;
    }
    const [first, ...rest] = label.split(/or (?=[A-Z]{2,4} \d{4})/).map((s) => s.trim());
    const code = CODE.exec(first!);
    items.push({
      id: `t${src}-${items.length}`, code: code ? `${code[1]} ${code[2]}` : undefined,
      alt: code ? rest.map((r) => CODE.exec(r)).filter((r) => r !== null).map((r) => `${r[1]} ${r[2]}`) : [],
      label, credits: Number(m[2]), choices: [], src,
    });
  }
  return items;
}

export function parseRoadmaps(text: string): Roadmap[] {
  const out: Roadmap[] = [];
  let cur: Roadmap | undefined;
  let year = '';
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('## ')) {
      const [slug, name, catalogPath] = line.slice(3).split('|').map((s) => s.trim());
      if (!slug || !name || !catalogPath) throw new Error(`Bad roadmap header: ${line}`);
      out.push((cur = { slug, name, catalogPath, total: 0, terms: [], printedSums: [] }));
    } else if (!cur || line === '' || line.startsWith('#')) continue;
    else if (line.startsWith('TOTAL ')) cur.total = Number(line.slice(6));
    else if (/^\S.* Year$/.test(line)) year = line.replace(' Year', '');
    else {
      const m = /^ (Fall|Spring|Summer): (.*)sum (\d+)$/.exec(line);
      if (!m) throw new Error(`Unreadable roadmap line in ${cur.slug}: ${line}`);
      cur.terms.push({ label: `${year} year, ${m[1]}`, items: parseItems(m[2]!, cur.terms.length) });
      cur.printedSums.push(Number(m[3]));
    }
  }
  return out;
}

import { planIssues, type CheckItem } from './prereq.ts';
import { optimize } from './optimize.ts';

/** First segment of a catalog path -> college name as shown on the site. */
export const COLLEGES: Record<string, string> = {
  'agriculture-life-sciences': 'Agriculture and Life Sciences',
  'architecture-arts-design': 'Architecture, Arts, and Design',
  'college-engineering': 'Engineering',
  'college-science': 'Science',
  'liberal-arts-human-sciences': 'Liberal Arts and Human Sciences',
  'natural-resources-environment': 'Natural Resources and Environment',
  'pamplin-college-business': 'Pamplin College of Business',
  'veterinary-medicine': 'Veterinary Medicine',
};
export const collegeOf = (catalogPath: string) => COLLEGES[catalogPath.split('/')[0]!] ?? 'Other';

/** Group things that carry a catalog path by college, colleges and members in alphabetical order. */
export function byCollege<T extends { name: string; catalogPath: string }>(xs: T[]): Array<[string, T[]]> {
  const m = new Map<string, T[]>();
  for (const x of [...xs].sort((a, b) => a.name.localeCompare(b.name))) m.set(collegeOf(x.catalogPath), [...(m.get(collegeOf(x.catalogPath)) ?? []), x]);
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
}

/** data/no-roadmap.txt: programs the catalog gives no term-by-term roadmap for. */
export function parseNoRoadmap(text: string): Array<{ name: string; catalogPath: string }> {
  return text.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const [name, catalogPath] = l.split('|').map((s) => s.trim());
    if (!name || !catalogPath) throw new Error(`Bad no-roadmap line: ${l}`);
    return { name, catalogPath };
  });
}

export const credits = (items: PlanItem[]) => items.reduce((a, i) => a + i.credits, 0);
const subject = (i: PlanItem) => i.code?.split(' ')[0];

export const YEAR_OPTIONS = [3, 3.5, 4, 4.5, 5] as const;
const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'];

/** A summer term is planned at half the credits of a Fall or Spring term. */
export const SUMMER_WEIGHT = 0.5;

/** Term slots for a plan length. Under 4 years, every summer between terms is used: that is what makes it possible. */
export function slots(years: number): Array<{ label: string; weight: number }> {
  const out: Array<{ label: string; weight: number }> = [];
  const n = Math.round(years * 2);
  for (let k = 0; k < n; k++) {
    const y = ORDINAL[Math.floor(k / 2)];
    out.push({ label: `${y} year, ${k % 2 === 0 ? 'Fall' : 'Spring'}`, weight: 1 });
    if (years < 4 && k % 2 === 1 && k < n - 1) out.push({ label: `${y} year, Summer`, weight: SUMMER_WEIGHT });
  }
  return out;
}

/**
 * Lay the roadmap out over `years`. 4 years returns the official plan.
 * Otherwise courses are spread by credits (summers get half a share), following the catalog's order;
 * elective slots may move earlier to fill a light term. One guard stands in for prerequisites we do not have: a course never shares a term with a
 * same-subject course from an earlier official term (MATH 1225 and MATH 1226 stay apart).
 * With `check` (from checkItems in prereq.ts) a course is also held back until its prerequisites sit in an earlier term.
 * Which term a course is offered in is NOT handled. The last term takes whatever is left, so a tight plan can
 * still end with conflicts: the planner page flags those.
 */
export function repack(r: Roadmap, years: number, check?: Record<string, CheckItem>): Term[] {
  if (years === baseYears(r)) return r.terms;
  return pack(r, slots(years), check);
}

/** Years the roadmap's own layout takes: 4 for every official roadmap, 5 for the 160-credit architecture draft. */
export const baseYears = (r: Roadmap) => r.terms.filter((t) => !t.label.includes('Summer')).length / 2;

/** Fall and Spring slots only, for laying out a draft. */
export const plainSlots = (n: number) => Array.from({ length: n }, (_, k) => ({ label: `${ORDINAL[Math.floor(k / 2)]} year, ${k % 2 === 0 ? 'Fall' : 'Spring'}`, weight: 1 }));

/** The packing behind repack: spread r's courses over the given slots, in r's order. */
export function pack(r: Roadmap, sl: Array<{ label: string; weight: number }>, check?: Record<string, CheckItem>): Term[] {
  const queue = r.terms.flatMap((t) => t.items);
  const terms: Term[] = [];
  // depth = how many later terms the courses that chain off this one still need (from the official layout).
  const depth: Record<string, number> = {};
  if (check)
    for (const [id, v] of Object.entries(planIssues(check, r.terms.map((t) => t.items.map((i) => i.id)), [])))
      if (v.slack !== undefined) depth[id] = r.terms.length - 1 - v.slack - queue.find((q) => q.id === id)!.src;
  let left = credits(queue);
  let weightLeft = sl.reduce((a, x) => a + x.weight, 0);
  sl.forEach((slot, k) => {
    const items: PlanItem[] = [];
    const target = (left * slot.weight) / weightLeft;
    // Issues for `x` if it joined this term: terms so far, this term with x, everything else after.
    const ids = (xs: PlanItem[]) => xs.map((x) => x.id);
    const trialIssues = (x: PlanItem) =>
      planIssues(check!, [...terms.map((t) => ids(t.items)), [...ids(items.filter((i) => i !== x)), x.id], ids(queue.filter((q) => q !== x))], [])[x.id]!;
    for (;;) {
      const have = credits(items);
      // Take the first queued course that fits. A course may jump the queue (an elective filling a gap),
      // but never past an earlier course of its own subject, and never next to one from an earlier term.
      const pick = queue.findIndex((next, i) => {
        if (k === sl.length - 1) return true; // last term takes everything left
        const sub = subject(next);
        if (sub !== undefined && queue.slice(0, i).some((q) => subject(q) === sub)) return false;
        if (items.some((it) => subject(it) !== undefined && subject(it) === sub && it.src < next.src)) return false;
        if (check?.[next.id]?.pre) {
          // Trial layout: terms so far, this term with the candidate, everything else after.
          if (trialIssues(next).late.length) return false;
        }
        // No room to wait: the chain behind this course needs every term that is left.
        if ((depth[next.id] ?? 0) >= sl.length - 1 - k) return true;
        return items.length === 0 || have + next.credits / 2 <= target;
      });
      if (pick < 0) break;
      const [picked] = queue.splice(pick, 1);
      items.push(picked!);
      // Corequisites travel together: pull a waiting corequisite into this term when its own prerequisites allow.
      if (check?.[picked!.id]?.co && k < sl.length - 1)
        for (const j of trialIssues(picked!).coLate) {
          const q = queue.findIndex((x) => x.id === j);
          if (q >= 0 && !trialIssues(queue[q]!).late.length) items.push(...queue.splice(q, 1));
        }
    }
    left -= credits(items);
    weightLeft -= slot.weight;
    terms.push({ label: slot.label, items });
  });
  // Greedy fill, then local repair and balancing, then a bounded exact search starting from that answer (optimize.ts).
  const weights = sl.map((x) => x.weight);
  return check ? optimize(smooth(terms, weights, check), weights, check).terms : terms;
}

/** Terms may differ by this many credits (per unit of slot weight) before smooth() stops moving courses. */
export const SMOOTH_GAP = 3;

/**
 * Even out a packed plan: the last term takes whatever is left, so it can end up far heavier than the rest
 * (or a middle term empty). Move one course at a time from the heaviest term to the lightest, placeholders
 * first, and only when the move adds no prerequisite conflict anywhere in the plan.
 */
export function smooth(terms: Term[], weights: number[], check: Record<string, CheckItem>): Term[] {
  const out = terms.map((t) => ({ label: t.label, items: [...t.items] }));
  const conflicts = () => Object.values(planIssues(check, out.map((t) => t.items.map((i) => i.id)), [])).reduce((a, v) => a + v.late.length + v.coLate.length, 0);
  const load = (k: number) => credits(out[k]!.items) / weights[k]!;
  let now = conflicts();
  // Repair first: a course in conflict (or the course it is waiting on) may fit in another term. Take any single
  // move that lowers the number of conflicts without pushing a term past the plan's current heaviest load.
  for (let pass = 0; pass < 6 && now > 0; pass++) {
    const issues = planIssues(check, out.map((t) => t.items.map((i) => i.id)), []);
    const stuck = new Set(Object.entries(issues).flatMap(([id, v]) => (v.late.length || v.coLate.length ? [id, ...v.late, ...v.coLate] : [])));
    const cap = Math.max(...out.map((_, k) => load(k)));
    let improved = false;
    for (const id of stuck) {
      const from = out.findIndex((t) => t.items.some((i) => i.id === id));
      const item = out[from]!.items.find((i) => i.id === id)!;
      let best = -1, bestCount = now;
      for (let to = 0; to < out.length; to++) {
        if (to === from || load(to) + item.credits / weights[to]! > cap) continue;
        out[from]!.items.splice(out[from]!.items.indexOf(item), 1);
        out[to]!.items.push(item);
        const c = conflicts();
        if (c < bestCount) { bestCount = c; best = to; }
        out[to]!.items.pop();
        out[from]!.items.push(item);
      }
      if (best >= 0) {
        out[from]!.items.splice(out[from]!.items.indexOf(item), 1);
        out[best]!.items.push(item);
        now = bestCount;
        improved = true;
      }
    }
    if (!improved) break;
  }
  for (let step = 0; step < 80; step++) {
    const order = out.map((_, k) => k).sort((a, b) => load(b) - load(a));
    const hi = order[0]!, lows = order.slice(1).reverse();
    let moved = false;
    for (const lo of lows) {
      if (load(hi) - load(lo) <= SMOOTH_GAP) break;
      const candidates = [...out[hi]!.items].filter((i) => i.credits > 0).sort((a, b) => Number(a.code !== undefined) - Number(b.code !== undefined));
      for (const item of candidates) {
        // The move must narrow the gap, not just swap which term is heavy.
        if (load(lo) + item.credits / weights[lo]! >= load(hi)) continue;
        out[hi]!.items.splice(out[hi]!.items.indexOf(item), 1);
        out[lo]!.items.push(item);
        const after = conflicts();
        if (after <= now) { now = after; moved = true; break; }
        out[lo]!.items.pop();
        out[hi]!.items.push(item);
      }
      if (moved) break;
    }
    if (!moved) break;
  }
  return out;
}

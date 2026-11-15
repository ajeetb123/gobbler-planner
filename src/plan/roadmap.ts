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
}

const CODE = /^([A-Z]{2,4}) (\d{4})\b/;

function parseItems(text: string, src: number): PlanItem[] {
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

export const credits = (items: PlanItem[]) => items.reduce((a, i) => a + i.credits, 0);
const subject = (i: PlanItem) => i.code?.split(' ')[0];

export const YEAR_OPTIONS = [3, 3.5, 4, 4.5, 5] as const;
const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

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
 * Real prerequisites and which term a course is offered in are NOT checked.
 */
export function repack(r: Roadmap, years: number): Term[] {
  if (years === 4) return r.terms;
  const sl = slots(years);
  const queue = r.terms.flatMap((t) => t.items);
  const terms: Term[] = [];
  let left = credits(queue);
  let weightLeft = sl.reduce((a, x) => a + x.weight, 0);
  sl.forEach((slot, k) => {
    const items: PlanItem[] = [];
    const target = (left * slot.weight) / weightLeft;
    for (;;) {
      const have = credits(items);
      // Take the first queued course that fits. A course may jump the queue (an elective filling a gap),
      // but never past an earlier course of its own subject, and never next to one from an earlier term.
      const pick = queue.findIndex((next, i) => {
        if (k === sl.length - 1) return true; // last term takes everything left
        const sub = subject(next);
        if (sub !== undefined && queue.slice(0, i).some((q) => subject(q) === sub)) return false;
        if (items.some((it) => subject(it) !== undefined && subject(it) === sub && it.src < next.src)) return false;
        return items.length === 0 || have + next.credits / 2 <= target;
      });
      if (pick < 0) break;
      items.push(...queue.splice(pick, 1));
    }
    left -= credits(items);
    weightLeft -= slot.weight;
    terms.push({ label: slot.label, items });
  });
  return terms;
}

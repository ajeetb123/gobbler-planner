// Draft plans for majors whose catalog page lists requirements but no term-by-term roadmap.
// The requirement list is official; the order is ours: by course level, then moved so prerequisites come first.
import { parseItems, plainSlots, credits, smooth, type PlanItem, type Roadmap, type Term } from './roadmap.ts';
import { checkItems, planIssues, type CourseInfo } from './prereq.ts';
import { optimize } from './optimize.ts';

export interface Requirements {
  slug: string;
  name: string;
  catalogPath: string;
  total: number;
  items: PlanItem[];
}

/** data/requirements/*.txt: "## slug | name | path", one or more "REQ: item (cr), ..." lines, "TOTAL n". */
export function parseRequirements(text: string): Requirements[] {
  const out: Requirements[] = [];
  let cur: Requirements | undefined;
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      const [slug, name, catalogPath] = line.slice(3).split('|').map((s) => s.trim());
      if (!slug || !name || !catalogPath) throw new Error(`Bad requirements header: ${line}`);
      out.push((cur = { slug, name, catalogPath, total: 0, items: [] }));
    } else if (!cur || line === '' || line.startsWith('#')) continue;
    else if (line.startsWith('TOTAL ')) cur.total = Number(line.slice(6));
    else if (line.startsWith('REQ: ')) cur.items.push(...parseItems(line.slice(5), 0));
    else throw new Error(`Unreadable requirements line in ${cur.slug}: ${line.slice(0, 80)}`);
  }
  return out;
}

/** Terms are sized near this many credits: 120 credits gives 8 terms, 160 gives 10. */
export const DRAFT_TERM_CREDITS = 17;

/**
 * Lay a requirement list out term by term. For each term in turn:
 * - a course is "ready" when its prerequisites (those this plan can meet at all) sit in an earlier term;
 * - ready named courses are taken by due term (set by course level, pulled earlier when a chain of later
 *   courses hangs off them), up to the term's share of named-course credits;
 * - placeholder slots (Pathways, electives, "choose from list") fill the rest, so they spread evenly;
 * - a course whose chain needs every remaining term is taken even if the term runs heavy;
 * - a corequisite that is ready joins its partner.
 * The result is marked draft: the planner says it is not an official roadmap.
 */
export function draftRoadmap(req: Requirements, courses: Map<string, CourseInfo>): Roadmap {
  const n = Math.max(2, Math.ceil(req.total / DRAFT_TERM_CREDITS));
  const all = req.items.map((i, k) => ({ ...i, id: `q${k}` }));
  const check = checkItems([{ items: all }], courses, true);
  const ids = (xs: PlanItem[]) => xs.map((x) => x.id);
  // Chain length behind each course: everything in term 0 of n, so slack = (n - 1) - depth.
  const flat = planIssues(check, [ids(all), ...Array.from({ length: n - 1 }, () => [])], []);
  const depth = (i: PlanItem) => (flat[i.id]!.slack === undefined ? 0 : n - 1 - flat[i.id]!.slack!);
  const level = (i: PlanItem) => Math.min(4, Math.max(1, Number(i.code!.split(' ')[1]![0])));
  // A course's level sets the window it belongs in: 1000-level in year one ... 4000-level in the last year;
  // 3000- and 4000-level courses are not offered a term more than a year ahead of that window.
  const due = (i: PlanItem) => Math.min(n - 1 - depth(i), Math.ceil((level(i) * n) / 4) - 1);
  const earliest = (i: PlanItem) => Math.max(0, Math.floor(((level(i) - 1) * n) / 4) - 2);
  const queueAll = all.filter((i) => i.code);
  const queue = [...queueAll].sort((a, b) => due(a) - due(b) || level(a) - level(b) || a.code!.localeCompare(b.code!));
  // Placeholders keep the catalog's order, except ones that are clearly upper-level ("4000-Level ...", or a
  // choice list of 3000/4000-level courses): those go to the back so they land in the later years.
  const upper = (i: PlanItem) => {
    const levels = [...i.choices.join(' ').matchAll(/[A-Z]{2,4} (\d)\d{3}/g)].map((m) => Number(m[1]));
    const named = /\b([34])000/.exec(i.label);
    const L = named ? Number(named[1]) : levels.length ? Math.min(...levels) : 0;
    return L >= 3 ? L : 0;
  };
  const open = all.filter((i) => !i.code).map((i, k) => ({ i, k })).sort((a, b) => upper(a.i) - upper(b.i) || a.k - b.k).map((x) => x.i);
  const placed: PlanItem[][] = [];
  for (let k = 0; k < n; k++) {
    const left = n - k;
    const items: PlanItem[] = [];
    if (left === 1) items.push(...queue.splice(0), ...open.splice(0));
    const namedShare = credits(queue) / left, target = (credits(queue) + credits(open)) / left;
    const issues = (x: PlanItem) => planIssues(check, [...placed.map(ids), [...ids(items.filter((i) => i !== x)), x.id], ids([...queue, ...open].filter((q) => q !== x))], [])[x.id]!;
    const take = (x: PlanItem) => {
      items.push(...queue.splice(queue.indexOf(x), 1));
      for (const j of issues(x).coLate) {
        const partner = queue.find((q) => q.id === j);
        if (partner && !issues(partner).late.length) items.push(...queue.splice(queue.indexOf(partner), 1));
      }
    };
    for (;;) {
      const named = credits(items.filter((i) => i.code));
      const pick = queue.find((x) => !issues(x).late.length && ((depth(x) >= left - 1 && depth(x) > 0) || (k >= earliest(x) && named + x.credits / 2 <= namedShare)));
      if (!pick) break;
      take(pick);
    }
    while (open.length && credits(items) + open[0]!.credits / 2 <= target) items.push(open.shift()!);
    // Short on placeholders: top up with any ready course.
    for (;;) {
      const pick = queue.find((x) => !issues(x).late.length && k >= earliest(x) && credits(items) + x.credits / 2 <= target);
      if (!pick) break;
      take(pick);
    }
    placed.push(items);
  }
  // An elective in the major's own field ("Electives within Psychology") should not come before the first course of
  // that field. Swap any such slot with a general placeholder of the same credits from that term or later; named
  // courses stay where they are. The field is the subject code most of the major's named courses use.
  const subjects: Record<string, number> = {};
  for (const i of queueAll) subjects[i.code!.split(' ')[0]!] = (subjects[i.code!.split(' ')[0]!] ?? 0) + 1;
  const mainSubject = Object.entries(subjects).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const field = req.name.split(/\s/)[0]!.toLowerCase();
  const inField = (i: PlanItem) => !i.code && /\b(elective|within)\b/i.test(i.label) && (i.label.toLowerCase().includes(field) || (mainSubject !== '' && i.label.includes(mainSubject)));
  const firstMain = placed.findIndex((items) => items.some((i) => i.code?.startsWith(mainSubject + ' ')));
  for (let k = 0; k < firstMain; k++)
    for (const slot of placed[k]!.filter(inField)) {
      let swapped = false;
      for (let j = firstMain; j < placed.length && !swapped; j++) {
        const other = placed[j]!.find((i) => !i.code && !inField(i) && upper(i) === 0 && i.credits === slot.credits);
        if (!other) continue;
        placed[k]!.splice(placed[k]!.indexOf(slot), 1, other);
        placed[j]!.splice(placed[j]!.indexOf(other), 1, slot);
        swapped = true;
      }
    }
  // Same repair and balancing pass the rearranged layouts get, then final ids by term.
  const ones = placed.map(() => 1);
  // The search may rebalance, but a named course keeps its level floor (no 4000-level course in year one).
  // Major electives keep the floor set above, so balancing does not move them back in front.
  const floor = Object.fromEntries([...queueAll.map((i) => [i.id, earliest(i)]), ...all.filter(inField).map((i) => [i.id, Math.max(0, firstMain)])]);
  const fixed = optimize(smooth(placed.map((items, t) => ({ label: plainSlots(n)[t]!.label, items })), ones, check, floor), ones, check, undefined, floor).terms;
  const terms: Term[] = fixed.map((t, ti) => ({ label: t.label, items: t.items.map((i, k) => ({ ...i, id: `t${ti}-${k}`, src: ti })) }));
  return { slug: req.slug, name: req.name, catalogPath: req.catalogPath, total: req.total, terms, printedSums: terms.map((t) => credits(t.items)), draft: true };
}

// The knowledge base for "Ask": one document per course and one per degree plan, built from data the site
// already has (data/prereqs.txt and the roadmaps). Nothing new is read from the catalog here.
import { collegeOf, type Roadmap } from '../plan/roadmap.ts';
import type { CourseInfo } from '../plan/prereq.ts';
import type { AskDoc } from './engine.ts';

/** A course document lists at most this many plans by name; `n` still carries the full count. */
export const MAX_PLANS_LISTED = 12;

const CODES = /[A-Z]{2,4} \d{4}H?/g;

export function buildDocs(roadmaps: Roadmap[], courses: Map<string, CourseInfo>): AskDoc[] {
  // Reverse the prerequisite lists: for each course, which courses name it.
  const unlocks = new Map<string, Set<string>>();
  for (const c of courses.values())
    for (const code of new Set(`${c.preText} ${c.coText}`.match(CODES) ?? []))
      if (code !== c.code) unlocks.set(code, (unlocks.get(code) ?? new Set()).add(c.code));
  // Which plans name each course (as the course itself or as its "or" alternative).
  const plans = new Map<string, Array<[string, string]>>();
  for (const r of roadmaps)
    for (const code of new Set(r.terms.flatMap((t) => t.items).flatMap((i) => (i.code ? [i.code, ...i.alt] : []))))
      plans.set(code, [...(plans.get(code) ?? []), [r.slug, r.name]]);

  const courseDocs: AskDoc[] = [...courses.values()].map((c) => {
    const mj = (plans.get(c.code) ?? []).sort((a, b) => a[1].localeCompare(b[1]));
    return {
      k: 'c', id: c.code, title: c.title, text: c.code.split(' ')[0]!,
      ...(c.preText ? { pre: c.preText } : {}), ...(c.coText ? { co: c.coText } : {}), ...(c.pre ? { pe: c.pre } : {}),
      un: [...(unlocks.get(c.code) ?? [])].sort(), mj: mj.slice(0, MAX_PLANS_LISTED), n: mj.length,
    };
  });
  const planDocs: AskDoc[] = roadmaps.map((r) => ({
    k: 'p', id: r.slug, title: r.name, text: collegeOf(r.catalogPath),
    college: collegeOf(r.catalogPath), total: r.total, draft: r.draft === true,
    terms: r.terms.map((t) => [t.label, t.items.map((i) => (i.code ? [i.code, ...i.alt].join(' or ') : i.label))] as [string, string[]]),
  }));
  return [...courseDocs, ...planDocs];
}

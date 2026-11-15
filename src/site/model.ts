// Turns UDC rows into the data behind every page. No HTML here (see render.ts).
import { GRADE_COLS, dedupeSections, type UdcRow } from '../grades/udc.ts';
import { isUndergrad } from '../grades/backtest.ts';
import { range } from '../grades/intervals.ts';
import { spreadOf, type Spread } from '../grades/matters.ts';
import { fit, type Fit } from '../grades/tune.ts';
import type { EstimatorParams } from '../grades/estimate.ts';

/** "Recent" on a page means the last 4 Fall/Spring terms (2 years). */
export const RECENT_TERMS = 4;

/** Inverse of termIndex: 4047 -> "Fall 2023", 4048 -> "Spring 2024". */
export const termLabel = (t: number) => (t % 2 === 0 ? `Spring ${t / 2}` : `Fall ${(t - 1) / 2}`);

export interface Estimate { gpa: number; lo: number; hi: number }

export interface InstructorLine extends Estimate {
  name: string;
  key: string; // "CS|Chen"
  students: number;
  sections: number;
  lastTerm: number;
  ambiguous: boolean;
  reason: string;
}

export interface CoursePage {
  course: string;
  subject: string;
  title: string;
  mean: number;
  /** What to expect when the instructor is new to the course or not listed. */
  unknown: Estimate;
  typicalSize: number;
  students: number;
  sections: number;
  firstTerm: number;
  lastTerm: number;
  /** Share of grades by letter group over the course's last 4 offered terms, in percent. */
  dist: Array<{ label: string; pct: number }>;
  withdrawRate: number;
  trend: Array<{ term: number; gpa: number; students: number }>;
  instructors: InstructorLine[];
  earlier: Array<{ name: string; key: string; lastTerm: number }>;
  spread: Spread;
}

export interface ProfPanel extends Estimate {
  course: string;
  title: string;
  courseMean: number;
  students: number;
  sections: number;
  history: Array<{ term: number; gpa: number; students: number; sections: number }>;
}

export interface ProfPage {
  key: string;
  subject: string;
  name: string;
  ambiguous: boolean;
  reason: string;
  /** Shrunk average gap to course means across courses. Undefined for flagged names: never pooled. */
  effect: number | undefined;
  panels: ProfPanel[];
}

export interface Site {
  target: number;
  dataFirst: number;
  dataLast: number;
  params: EstimatorParams;
  courses: CoursePage[];
  profs: ProfPage[];
  /** Share of all undergrad enrollments covered by the built course pages (1 unless `top` is set). */
  enrollmentShare: number;
}

/** Drops exact repeats (same term, CRN, instructor) so overlapping exports can sit in data/ together. */
export function dedupeRows(rows: UdcRow[]): UdcRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.term}|${r.crn}|${r.instructor}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const LETTER_GROUPS = ['A', 'B', 'C', 'D', 'F'] as const;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

function group<T>(rows: T[], key: (r: T) => string | number): Map<string | number, T[]> {
  const m = new Map<string | number, T[]>();
  for (const r of rows) (m.get(key(r)) ?? m.set(key(r), []).get(key(r))!).push(r);
  return m;
}

function wmean(rows: UdcRow[]): number {
  let s = 0, w = 0;
  for (const r of rows) { s += r.gpa * r.graded; w += r.graded; }
  return w ? s / w : NaN;
}

export function coursePage(course: string, rs: UdcRow[], f: Fit): CoursePage {
  const h = f.history;
  const subject = rs[0]!.subject;
  const secs = dedupeSections(rs);
  const terms = [...new Set(secs.map((r) => r.term))].sort((a, b) => a - b);
  const lastOffered = new Set(terms.slice(-RECENT_TERMS));
  const recentSecs = secs.filter((r) => lastOffered.has(r.term));
  const typicalSize = median(recentSecs.map((r) => r.graded));
  const est = (gpa: number, hist: number): Estimate => {
    const [lo, hi] = range(f.cal, gpa, hist, typicalSize);
    return { gpa, lo, hi };
  };

  const graded = recentSecs.reduce((a, r) => a + r.graded, 0);
  const dist = LETTER_GROUPS.map((label) => ({
    label,
    pct: recentSecs.reduce((a, r) => a + GRADE_COLS.filter((g) => g[0] === label).reduce((b, g) => b + (r.pct[g] || 0), 0) * r.graded, 0) / graded,
  }));
  const withdraws = recentSecs.reduce((a, r) => a + r.withdraws, 0);

  const byInstr = group(rs, (r) => r.instructor);
  const instructors: InstructorLine[] = [];
  const earlier: CoursePage['earlier'] = [];
  for (const [name, mine] of byInstr as Map<string, UdcRow[]>) {
    const lastTerm = Math.max(...mine.map((r) => r.term));
    const key = `${subject}|${name}`;
    if (lastTerm < f.target - RECENT_TERMS) { earlier.push({ name, key, lastTerm }); continue; }
    const pred = h.predict({ course, subject, instructor: name });
    const a = f.ambiguity.get(key);
    instructors.push({ name, key, ...est(pred.gpa, pred.students), students: pred.students, sections: pred.sections, lastTerm, ambiguous: !!a?.ambiguous, reason: a?.reason ?? '' });
  }
  // Sorted by name, never by GPA (see skills.md editing rules).
  instructors.sort((a, b) => a.name.localeCompare(b.name));
  earlier.sort((a, b) => a.name.localeCompare(b.name));

  const mean = h.courseMean(course, subject);
  return {
    course, subject, title: secs[secs.length - 1]!.title, mean, unknown: est(mean, 0), typicalSize,
    students: secs.reduce((a, r) => a + r.graded, 0), sections: secs.length,
    firstTerm: terms[0]!, lastTerm: terms[terms.length - 1]!, dist,
    withdrawRate: graded + withdraws ? withdraws / (graded + withdraws) : 0,
    trend: terms.map((term) => {
      const t = secs.filter((r) => r.term === term);
      return { term, gpa: wmean(t), students: t.reduce((a, r) => a + r.graded, 0) };
    }),
    instructors, earlier, spread: spreadOf(instructors),
  };
}

export function profPage(key: string, rs: UdcRow[], f: Fit, courses: Map<string, CoursePage>): ProfPage {
  const [subject, name] = key.split('|') as [string, string];
  const a = f.ambiguity.get(key);
  const ambiguous = !!a?.ambiguous;
  const panels: ProfPanel[] = [];
  for (const [course, mine] of group(rs, (r) => r.course) as Map<string, UdcRow[]>) {
    const cp = courses.get(course);
    if (!cp) continue;
    const pred = f.history.predict({ course, subject, instructor: name });
    const [lo, hi] = range(f.cal, pred.gpa, pred.students, cp.typicalSize);
    const history = [...(group(mine, (r) => r.term) as Map<number, UdcRow[]>)]
      .map(([term, t]) => ({ term, gpa: wmean(t), students: t.reduce((x, r) => x + r.graded, 0), sections: t.length }))
      .sort((x, y) => y.term - x.term);
    panels.push({ course, title: cp.title, courseMean: cp.mean, gpa: pred.gpa, lo, hi, students: pred.students, sections: pred.sections, history });
  }
  panels.sort((x, y) => x.course.localeCompare(y.course));
  const e = f.history.instrEffect.get(key);
  const effect = !ambiguous && e && e.w > 0 && panels.length >= 2 ? e.sum / (e.w + f.params.kInstr) : undefined;
  return { key, subject, name, ambiguous, reason: a?.reason ?? '', effect, panels };
}

/** `top`: build only the N most-taken courses (the pilot in the report's validation plan). */
export function buildSite(allRows: UdcRow[], opts: { top?: number; fit?: Fit } = {}): Site {
  const rows = dedupeRows(allRows);
  const dataLast = Math.max(...rows.map((r) => r.term));
  const dataFirst = Math.min(...rows.map((r) => r.term));
  const target = dataLast + 1;
  const f = opts.fit ?? fit(rows, target);

  const ug = rows.filter(isUndergrad);
  let byCourse = [...(group(ug, (r) => r.course) as Map<string, UdcRow[]>)];
  const enrolled = (rs: UdcRow[]) => dedupeSections(rs).reduce((a, r) => a + r.graded, 0);
  const total = byCourse.reduce((a, [, rs]) => a + enrolled(rs), 0);
  if (opts.top) byCourse = byCourse.sort((a, b) => enrolled(b[1]) - enrolled(a[1])).slice(0, opts.top);
  const built = byCourse.reduce((a, [, rs]) => a + enrolled(rs), 0);

  const courses = new Map<string, CoursePage>();
  for (const [course, rs] of byCourse) courses.set(course, coursePage(course, rs, f));
  const inScope = ug.filter((r) => courses.has(r.course));
  const profs = [...(group(inScope, (r) => `${r.subject}|${r.instructor}`) as Map<string, UdcRow[]>)]
    .map(([key, rs]) => profPage(key, rs, f, courses));

  return {
    target, dataFirst, dataLast, params: f.params,
    courses: [...courses.values()].sort((a, b) => a.course.localeCompare(b.course, 'en', { numeric: true })),
    profs: profs.sort((a, b) => a.key.localeCompare(b.key)),
    enrollmentShare: built / total,
  };
}

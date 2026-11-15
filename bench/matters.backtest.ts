// Run: npm run backtest:matters
// Checks the "does the instructor matter" verdict: label each course from past terms only,
// then look at the real gap between instructors in the term that followed.
import { loadUdc, dedupeSections, type UdcRow } from '../src/grades/udc.ts';
import { History, BASELINE_PARAMS } from '../src/grades/estimate.ts';
import { isUndergrad } from '../src/grades/backtest.ts';
import { spreadOf, MIN_COMPARE_STUDENTS, type Verdict } from '../src/grades/matters.ts';
import { ambiguousKeys } from '../src/identity/ambiguity.ts';

const rows = loadUdc(['data/udc_2019_2022.csv', 'data/udc_2022_2024.csv']);
const TEST = [4045, 4046, 4047, 4048];
const NOTICEABLE = 0.3; // a real gap of 0.3 GPA is about a third of a letter grade
const acc = new Map<Verdict, { courses: number; gaps: number[] }>();
for (const t of TEST) {
  const p = { ...BASELINE_PARAMS, kIC: 50, decay: 0.7, useInstructorEffect: true, kInstr: 50, ambiguous: ambiguousKeys(rows.filter((r) => r.term < t)) };
  const h = new History(rows, t, p);
  const byCourse = new Map<string, UdcRow[]>();
  for (const r of rows) if (isUndergrad(r)) (byCourse.get(r.course) ?? byCourse.set(r.course, []).get(r.course)!).push(r);
  for (const [course, rs] of byCourse) {
    const subject = rs[0]!.subject;
    const recent = [...new Set(rs.filter((r) => r.term < t && r.term >= t - 4).map((r) => r.instructor))];
    const preds = recent.map((instructor) => ({ instructor, ...h.predict({ course, subject, instructor }) }));
    const s = spreadOf(preds);
    if (s.verdict === 'unknown') continue;
    // Real outcome: student-weighted GPA per compared instructor in term t.
    const compared = new Set(preds.filter((x) => x.students >= MIN_COMPARE_STUDENTS).map((x) => x.instructor));
    const act = new Map<string, { s: number; w: number }>();
    for (const r of dedupeSections(rs.filter((x) => x.term === t && compared.has(x.instructor)))) {
      const a = act.get(r.instructor) ?? { s: 0, w: 0 };
      a.s += r.gpa * r.graded; a.w += r.graded; act.set(r.instructor, a);
    }
    if (act.size < 2) continue;
    const g = [...act.values()].map((a) => a.s / a.w);
    const e = acc.get(s.verdict) ?? { courses: 0, gaps: [] };
    e.courses++; e.gaps.push(Math.max(...g) - Math.min(...g));
    acc.set(s.verdict, e);
  }
}
console.log(`Verdict from past terms vs the real gap between instructors next term (course-terms with 2+ compared instructors teaching)`);
for (const v of ['barely', 'some', 'matters'] as const) {
  const e = acc.get(v);
  if (!e) continue;
  const g = e.gaps.sort((a, b) => a - b);
  const share = g.filter((x) => x >= NOTICEABLE).length / g.length;
  console.log(`  ${v.padEnd(8)} course-terms ${String(g.length).padStart(4)}  median real gap ${g[Math.floor(g.length / 2)]!.toFixed(2)}  real gap >= ${NOTICEABLE}: ${(share * 100).toFixed(0)}%`);
}

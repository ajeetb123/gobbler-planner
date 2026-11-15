// Run: node bench/sample-page.ts "MATH 2114"
// Prints what a course page would show for the next term, using every term in the data.
import { loadUdc, dedupeSections } from '../src/grades/udc.ts';
import { History, BASELINE_PARAMS } from '../src/grades/estimate.ts';
import { backtest } from '../src/grades/backtest.ts';
import { calibrate, range } from '../src/grades/intervals.ts';
import { ambiguity } from '../src/identity/ambiguity.ts';

const course = process.argv[2] ?? 'MATH 2114';
const rows = loadUdc(['data/udc_2019_2022.csv', 'data/udc_2022_2024.csv']);
const NEXT = 4049; // Fall 2024, one term past the data
// Parameters the walk-forward tuning picked most often for recent terms.
const p = { ...BASELINE_PARAMS, kIC: 50, decay: 0.7, useInstructorEffect: true, kInstr: 50, effectForNewPairs: true, ambiguous: undefined as Set<string> | undefined };
const amb = ambiguity(rows);
p.ambiguous = new Set([...amb.values()].filter((a) => a.ambiguous).map((a) => a.key));
const cal = calibrate(backtest(rows, [NEXT - 2, NEXT - 1], p).scored, 0.8);
const h = new History(rows, NEXT, p);

const mine = dedupeSections(rows.filter((r) => r.course === course));
if (mine.length === 0) throw new Error(`No rows for ${course}`);
const instructors = [...new Set(rows.filter((r) => r.course === course && r.term >= NEXT - 4).map((r) => r.instructor))];
const cm = h.courseMean(course, mine[0]!.subject);
const typicalSize = Math.round(mine.reduce((a, r) => a + r.graded, 0) / mine.length);

console.log(`${course}: ${mine[0]!.title}`);
console.log(`Course average GPA (recent terms weighted more): ${cm.toFixed(2)}  ·  typical section ${typicalSize} students`);
console.log(`Instructors in the last 2 years, expected section GPA next term (80% range):\n`);
const lines = instructors.map((instr) => {
  const pred = h.predict({ course, subject: mine[0]!.subject, instructor: instr });
  const [lo, hi] = range(cal, pred.gpa, pred.students, typicalSize);
  const a = amb.get(`${mine[0]!.subject}|${instr}`);
  return { instr, pred, lo, hi, note: a?.ambiguous ? `  ⚠ may be more than one "${instr}" (${a.reason})` : '' };
});
// Sorted by name, not by GPA: the page shows data and lets the reader sort.
for (const l of lines.sort((a, b) => a.instr.localeCompare(b.instr)))
  console.log(`  ${l.instr.padEnd(16)} ${l.pred.gpa.toFixed(2)}  (${l.lo.toFixed(2)} to ${l.hi.toFixed(2)})  from ${l.pred.students} students in ${l.pred.sections} sections${l.note}`);
console.log(`\nSource: VT University DataCommons, Fall 2019 to Spring 2024. Last names only in the source.`);

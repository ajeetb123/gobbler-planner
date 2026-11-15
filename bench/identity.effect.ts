// Run: node bench/identity.effect.ts
// New instructor-course pairings: does borrowing the instructor's record from other courses help, by surname type?
import { loadUdc, dedupeSections } from '../src/grades/udc.ts';
import { History, BASELINE_PARAMS } from '../src/grades/estimate.ts';
const rows = loadUdc(['data/udc_2019_2022.csv', 'data/udc_2022_2024.csv']);
const common = new Set(['Smith','Johnson','Williams','Brown','Jones','Miller','Davis','Wilson','Lee','Wang','Zhang','Li','Liu','Chen','Kim','Taylor','Anderson','Thomas','Martin','Clark','Yang','Wu','Huang','Zhao','Park','Nguyen','Patel','Kumar','Singh','White','Moore','Jackson','Harris','Lewis','Walker','Hall','Young','King','Wright','Scott']);
const p = { ...BASELINE_PARAMS, kIC: 50, decay: 0.7, useInstructorEffect: true, kInstr: 50, effectForNewPairs: true };
const acc: Record<string, { w: number; withEff: number; courseOnly: number }> = {};
for (const t of [4045, 4046, 4047, 4048]) {
  const h = new History(rows, t, p);
  for (const r of dedupeSections(rows.filter(x => x.term === t && Number(x.courseNo) < 5000))) {
    if (h.ic.has(`${r.course}|${r.subject}|${r.instructor}`)) continue; // new pairings only
    if (!h.instrEffect.has(`${r.subject}|${r.instructor}`)) continue;   // instructor has other history
    const g = common.has(r.instructor) ? 'common surname' : 'other surname';
    const a = (acc[g] ??= { w: 0, withEff: 0, courseOnly: 0 });
    a.w += r.graded;
    a.withEff += Math.abs(h.prior(r.course, r.subject, r.instructor) - r.gpa) * r.graded;
    a.courseOnly += Math.abs(h.courseMean(r.course, r.subject) - r.gpa) * r.graded;
  }
}
for (const [g, a] of Object.entries(acc)) console.log(g.padEnd(15), 'students', a.w, ' MAE course mean', (a.courseOnly / a.w).toFixed(3), ' with instructor effect', (a.withEff / a.w).toFixed(3), ' change', ((a.withEff / a.courseOnly - 1) * 100).toFixed(1) + '%');

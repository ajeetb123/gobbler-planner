// GPA estimates for a (course, instructor) pair from past UDC terms.
// Every estimator only sees rows from terms strictly before the term it predicts.
import type { UdcRow } from './udc.ts';

export interface Agg {
  /** Weighted sum of section GPAs and the weight (students, possibly decayed by age). */
  sum: number;
  w: number;
  sections: number;
  students: number;
}

const emptyAgg = (): Agg => ({ sum: 0, w: 0, sections: 0, students: 0 });
const mean = (a: Agg | undefined) => (a && a.w > 0 ? a.sum / a.w : undefined);

export interface EstimatorParams {
  /** Prior strength, in students, when shrinking an instructor-course mean toward its prior. */
  kIC: number;
  /** Prior strength, in students, when shrinking an instructor's subject-wide effect toward 0. */
  kInstr: number;
  /** Per-term weight multiplier for older data (1 = no decay). */
  decay: number;
  /** Terms to drop from training (e.g. pandemic grading). */
  excludeTerms: Set<number>;
  /** Use the instructor's effect in other courses as the prior for a new pairing. */
  useInstructorEffect: boolean;
  /**
   * How much one past section counts. 'students': graded enrollment (a 300-seat lecture
   * counts 300x a 1-seat one). 'sqrt': its square root. 'sections': every section counts 1.
   * kIC and kInstr are in these same units.
   */
  weightMode: 'students' | 'sqrt' | 'sections';
  /** Apply the instructor effect when the instructor has never taught this course (iteration 5 says no). */
  effectForNewPairs: boolean;
  /**
   * Instructor keys that may merge several people (see src/identity/ambiguity.ts).
   * Their cross-course effect is not used: pooling different people adds noise.
   */
  ambiguous?: Set<string>;
}

export const BASELINE_PARAMS: EstimatorParams = {
  kIC: 0, kInstr: 0, decay: 1, excludeTerms: new Set(), useInstructorEffect: false, weightMode: 'students', effectForNewPairs: true,
};

/** Instructor identity inside UDC: last name alone is ambiguous across departments. */
export const instrKey = (r: Pick<UdcRow, 'subject' | 'instructor'>) => `${r.subject}|${r.instructor}`;
export const icKey = (r: Pick<UdcRow, 'course' | 'subject' | 'instructor'>) => `${r.course}|${instrKey(r)}`;

export function sectionWeight(graded: number, mode: EstimatorParams['weightMode']): number {
  if (mode === 'sqrt') return Math.sqrt(graded);
  if (mode === 'sections') return 1;
  return graded;
}

export class History {
  readonly course = new Map<string, Agg>();
  readonly subject = new Map<string, Agg>();
  readonly ic = new Map<string, Agg>();
  /** Instructor's student-weighted deviation from course means, across a subject. */
  readonly instrEffect = new Map<string, Agg>();
  global = emptyAgg();
  readonly p: EstimatorParams;

  constructor(rows: UdcRow[], beforeTerm: number, p: EstimatorParams) {
    this.p = p;
    const train = rows.filter((r) => r.term < beforeTerm && !p.excludeTerms.has(r.term));
    const add = (m: Map<string, Agg>, k: string, r: UdcRow, w: number, value = r.gpa) => {
      let a = m.get(k);
      if (!a) m.set(k, (a = emptyAgg()));
      a.sum += value * w;
      a.w += w;
      a.sections += 1;
      a.students += r.graded;
    };
    const seen = new Set<string>();
    for (const r of train) {
      const w = sectionWeight(r.graded, p.weightMode) * Math.pow(p.decay, beforeTerm - 1 - r.term);
      // Course, subject and global stats count a co-taught section once.
      const sec = `${r.term}|${r.crn}`;
      if (!seen.has(sec)) {
        seen.add(sec);
        add(this.course, r.course, r, w);
        add(this.subject, r.subject, r, w);
        this.global.sum += r.gpa * w;
        this.global.w += w;
      }
      add(this.ic, icKey(r), r, w);
    }
    if (p.useInstructorEffect) {
      for (const r of train) {
        const cm = mean(this.course.get(r.course))!;
        const w = sectionWeight(r.graded, p.weightMode) * Math.pow(p.decay, beforeTerm - 1 - r.term);
        add(this.instrEffect, instrKey(r), r, w, r.gpa - cm);
      }
    }
  }

  courseMean(course: string, subject: string): number {
    return mean(this.course.get(course)) ?? mean(this.subject.get(subject)) ?? mean(this.global) ?? 3;
  }

  /** Prior for a pairing: the course mean, nudged by the instructor's shrunk effect elsewhere. */
  prior(course: string, subject: string, instructor: string): number {
    const cm = this.courseMean(course, subject);
    if (!this.p.useInstructorEffect) return cm;
    if (this.p.ambiguous?.has(`${subject}|${instructor}`)) return cm;
    const e = this.instrEffect.get(`${subject}|${instructor}`);
    if (!e || e.w === 0) return cm;
    const effect = e.sum / (e.w + this.p.kInstr); // shrink toward 0
    return Math.min(4, Math.max(0, cm + effect));
  }

  predict(q: { course: string; subject: string; instructor: string }): Prediction {
    const a = this.ic.get(`${q.course}|${q.subject}|${q.instructor}`);
    const pr = !a && !this.p.effectForNewPairs
      ? this.courseMean(q.course, q.subject)
      : this.prior(q.course, q.subject, q.instructor);
    const students = a?.students ?? 0;
    const sections = a?.sections ?? 0;
    if (!a || a.w === 0) return { gpa: pr, students, sections, basis: this.course.has(q.course) ? 'course' : 'subject' };
    const gpa = (a.sum + this.p.kIC * pr) / (a.w + this.p.kIC);
    return { gpa, students, sections, basis: 'instructor-course' };
  }
}

export interface Prediction {
  gpa: number;
  /** Students and sections behind the instructor-course part of the estimate. */
  students: number;
  sections: number;
  basis: 'instructor-course' | 'course' | 'subject';
}

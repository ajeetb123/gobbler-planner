// UDC lists instructors by last name only, and (as of the Fall 2026 public timetable captures we
// found) the public timetable shows "N/A" for instructor. So a key like "CS|Chen" can merge several
// people. We cannot split them from public data; we can flag the risky keys and stop pooling them.
import type { UdcRow } from '../grades/udc.ts';
import { instrKey } from '../grades/estimate.ts';

/** Frequent US surnames plus frequent Chinese, Korean, Vietnamese and Indian surnames. */
export const COMMON_SURNAMES = new Set([
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson',
  'Thomas', 'Martin', 'Clark', 'White', 'Moore', 'Jackson', 'Harris', 'Lewis', 'Walker', 'Hall',
  'Young', 'King', 'Wright', 'Scott', 'Lee', 'Wang', 'Zhang', 'Li', 'Liu', 'Chen', 'Yang', 'Wu',
  'Huang', 'Zhao', 'Zhou', 'Xu', 'Sun', 'Ma', 'Kim', 'Park', 'Choi', 'Nguyen', 'Tran', 'Patel',
  'Kumar', 'Singh', 'Shah',
]);

export interface AmbiguityInfo {
  key: string;
  commonSurname: boolean;
  /** Most distinct courses taught under this key in a single term. */
  maxCoursesInTerm: number;
  /** Some term has both 1000/2000-level and 5000+ courses under this key with >= 5 courses. */
  spansLevels: boolean;
  ambiguous: boolean;
  reason: string;
}

export const MAX_PLAUSIBLE_COURSES = 5;

export function ambiguity(rows: UdcRow[]): Map<string, AmbiguityInfo> {
  const perTerm = new Map<string, Map<number, { courses: Set<string>; levels: Set<number> }>>();
  for (const r of rows) {
    const k = instrKey(r);
    const terms = perTerm.get(k) ?? perTerm.set(k, new Map()).get(k)!;
    const t = terms.get(r.term) ?? terms.set(r.term, { courses: new Set(), levels: new Set() }).get(r.term)!;
    t.courses.add(r.course);
    t.levels.add(Number(r.courseNo[0]));
  }
  const out = new Map<string, AmbiguityInfo>();
  for (const [key, terms] of perTerm) {
    const surname = key.split('|')[1]!;
    const commonSurname = COMMON_SURNAMES.has(surname);
    let maxCoursesInTerm = 0;
    let spansLevels = false;
    for (const t of terms.values()) {
      maxCoursesInTerm = Math.max(maxCoursesInTerm, t.courses.size);
      const lo = [...t.levels].some((l) => l <= 2);
      const hi = [...t.levels].some((l) => l >= 5);
      if (t.courses.size >= MAX_PLAUSIBLE_COURSES && lo && hi) spansLevels = true;
    }
    const reasons = [commonSurname && 'common surname', spansLevels && `${maxCoursesInTerm} courses in one term across levels`]
      .filter(Boolean) as string[];
    out.set(key, { key, commonSurname, maxCoursesInTerm, spansLevels, ambiguous: reasons.length > 0, reason: reasons.join('; ') });
  }
  return out;
}

export function ambiguousKeys(rows: UdcRow[]): Set<string> {
  return new Set([...ambiguity(rows).values()].filter((a) => a.ambiguous).map((a) => a.key));
}

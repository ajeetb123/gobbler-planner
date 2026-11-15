// Loads VT University DataCommons grade-distribution exports into typed rows.
import { readFileSync } from 'node:fs';

export const GRADE_COLS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'] as const;
export type Grade = (typeof GRADE_COLS)[number];
export const GRADE_POINTS: Record<Grade, number> = {
  A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0,
};

export interface UdcRow {
  /** Sortable term index: Spring Y = 2Y, Fall Y = 2Y + 1. */
  term: number;
  termLabel: string; // "Fall 2023"
  subject: string;
  courseNo: string;
  course: string; // "CS 2114"
  title: string;
  instructor: string; // last name only in UDC
  gpa: number;
  pct: Record<Grade, number>;
  withdraws: number;
  graded: number;
  crn: string;
  /** True when the same term+CRN appears under more than one instructor (co-taught). */
  coTaught: boolean;
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes). No dependency needed. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** "2023-24" + "Fall" -> Fall 2023; "2023-24" + "Spring" -> Spring 2024. */
export function termIndex(academicYear: string, term: string): { term: number; label: string } {
  const start = Number(academicYear.slice(0, 4));
  if (term === 'Fall') return { term: start * 2 + 1, label: `Fall ${start}` };
  if (term === 'Spring') return { term: (start + 1) * 2, label: `Spring ${start + 1}` };
  throw new Error(`Unsupported term "${term}" (only Fall/Spring are in the export)`);
}

export function parseUdc(text: string): UdcRow[] {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ''));
  if (!header) return [];
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`UDC export missing column "${name}"`);
    return i;
  };
  const c = {
    year: col('Academic Year'), term: col('Term'), subject: col('Subject'), no: col('Course No.'),
    title: col('Course Title'), instr: col('Instructor'), gpa: col('GPA'), w: col('Withdraws'),
    graded: col('Graded Enrollment'), crn: col('CRN'),
  };
  const gradeIdx = GRADE_COLS.map((g) => col(`${g} (%)`));
  // Current UDC exports also carry Winter, Summer I and Summer II. Estimates are Fall/Spring only.
  const rows: UdcRow[] = body.filter((r) => r[c.term] === 'Fall' || r[c.term] === 'Spring').map((r) => {
    const t = termIndex(r[c.year]!, r[c.term]!);
    const pct = {} as Record<Grade, number>;
    GRADE_COLS.forEach((g, i) => (pct[g] = Number(r[gradeIdx[i]!])));
    const subject = r[c.subject]!.trim();
    const courseNo = r[c.no]!.trim();
    return {
      term: t.term, termLabel: t.label, subject, courseNo, course: `${subject} ${courseNo}`,
      title: r[c.title]!.trim(), instructor: r[c.instr]!.trim(), gpa: Number(r[c.gpa]),
      pct, withdraws: Number(r[c.w]), graded: Number(r[c.graded]), crn: r[c.crn]!.trim(), coTaught: false,
    };
  });
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(`${r.term}|${r.crn}`, (seen.get(`${r.term}|${r.crn}`) ?? 0) + 1);
  for (const r of rows) r.coTaught = (seen.get(`${r.term}|${r.crn}`) ?? 0) > 1;
  return rows;
}

export function loadUdc(paths: string[]): UdcRow[] {
  return paths.flatMap((p) => parseUdc(readFileSync(p, 'utf8')));
}

/** One row per term+CRN (co-taught sections otherwise count twice in course-level stats). */
export function dedupeSections(rows: UdcRow[]): UdcRow[] {
  const out = new Map<string, UdcRow>();
  for (const r of rows) if (!out.has(`${r.term}|${r.crn}`)) out.set(`${r.term}|${r.crn}`, r);
  return [...out.values()];
}

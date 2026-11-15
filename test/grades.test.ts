import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseUdc, termIndex, dedupeSections, type UdcRow } from '../src/grades/udc.ts';
import { History, BASELINE_PARAMS, type EstimatorParams } from '../src/grades/estimate.ts';
import { calibrate, range, bucketOf } from '../src/grades/intervals.ts';
import { metrics, type Scored } from '../src/grades/backtest.ts';
import { ambiguity } from '../src/identity/ambiguity.ts';

const HEADER =
  '"Academic Year","Term","Subject","Course No.","Course Title","Instructor","GPA","A (%)","A- (%)","B+ (%)","B (%)","B- (%)","C+ (%)","C (%)","C- (%)","D+ (%)","D (%)","D- (%)","F (%)","Withdraws","Graded Enrollment","CRN","Credits"';

function row(p: Partial<UdcRow> & { term: number; gpa: number; graded: number; instructor: string; course?: string }): UdcRow {
  const course = p.course ?? 'CS 2114';
  const [subject, courseNo] = course.split(' ') as [string, string];
  return {
    termLabel: '', title: '', pct: {} as UdcRow['pct'], withdraws: 0, crn: String(Math.random()).slice(2, 7),
    coTaught: false, subject, courseNo, course, ...p,
  };
}

test('parseCsv handles quotes, escaped quotes and CRLF', () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""e"""\r\n1,2,3\n'), [['a', 'b,c', 'd "e"'], ['1', '2', '3']]);
});

test('termIndex orders Spring before Fall of the same calendar year', () => {
  assert.equal(termIndex('2023-24', 'Fall').label, 'Fall 2023');
  assert.equal(termIndex('2023-24', 'Spring').label, 'Spring 2024');
  assert.ok(termIndex('2022-23', 'Spring').term < termIndex('2023-24', 'Fall').term);
  assert.ok(termIndex('2023-24', 'Fall').term < termIndex('2023-24', 'Spring').term);
});

test('parseUdc reads a real-format row and marks co-taught CRNs', () => {
  const csv = `﻿${HEADER}
"2023-24","Fall","MSE","3064","Lab","McCord","3.94","100","0","0","0","0","0","0","0","0","0","0","0","0","5","88093","  1"
"2023-24","Fall","MSE","3064","Lab","Aidi","3.94","100","0","0","0","0","0","0","0","0","0","0","0","0","5","88093","  1"`;
  const rows = parseUdc(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.course, 'MSE 3064');
  assert.equal(rows[0]!.pct.A, 100);
  assert.ok(rows.every((r) => r.coTaught));
  assert.equal(dedupeSections(rows).length, 1);
});

const P: EstimatorParams = { ...BASELINE_PARAMS, kIC: 50, decay: 1 };

test('History never sees the term it predicts (no leakage)', () => {
  const rows = [row({ term: 10, gpa: 3.0, graded: 100, instructor: 'A' }), row({ term: 11, gpa: 1.0, graded: 100, instructor: 'A' })];
  const h = new History(rows, 11, P);
  assert.equal(h.predict({ course: 'CS 2114', subject: 'CS', instructor: 'A' }).gpa.toFixed(2), '3.00');
});

test('shrinkage pulls a tiny sample toward the course mean, not a large one', () => {
  const rows = [
    row({ term: 1, gpa: 3.0, graded: 1000, instructor: 'Big' }),
    row({ term: 1, gpa: 4.0, graded: 5, instructor: 'Tiny' }),
  ];
  const h = new History(rows, 2, P);
  const tiny = h.predict({ course: 'CS 2114', subject: 'CS', instructor: 'Tiny' }).gpa;
  const big = h.predict({ course: 'CS 2114', subject: 'CS', instructor: 'Big' }).gpa;
  assert.ok(tiny < 3.2, `tiny-sample estimate ${tiny} should sit near the course mean`);
  assert.ok(Math.abs(big - 3.0) < 0.01);
});

test('raw baseline (kIC = 0) reproduces the plain instructor mean', () => {
  const rows = [row({ term: 1, gpa: 4.0, graded: 5, instructor: 'Tiny' }), row({ term: 1, gpa: 3.0, graded: 500, instructor: 'X' })];
  const h = new History(rows, 2, BASELINE_PARAMS);
  assert.equal(h.predict({ course: 'CS 2114', subject: 'CS', instructor: 'Tiny' }).gpa, 4.0);
});

test('a pairing with no history falls back to the course mean and says so', () => {
  const rows = [row({ term: 1, gpa: 3.2, graded: 100, instructor: 'A' })];
  const pred = new History(rows, 2, P).predict({ course: 'CS 2114', subject: 'CS', instructor: 'New' });
  assert.equal(pred.basis, 'course');
  assert.equal(pred.students, 0);
  assert.ok(Math.abs(pred.gpa - 3.2) < 1e-9);
});

test('ambiguous keys do not borrow an instructor effect from other courses', () => {
  const rows = [
    row({ term: 1, gpa: 3.0, graded: 100, instructor: 'Other', course: 'CS 3114' }),
    row({ term: 1, gpa: 3.8, graded: 100, instructor: 'Chen', course: 'CS 2114' }),
    row({ term: 1, gpa: 3.0, graded: 100, instructor: 'Other', course: 'CS 2114' }),
  ];
  const base = { ...P, useInstructorEffect: true, kInstr: 0, effectForNewPairs: true };
  const q = { course: 'CS 3114', subject: 'CS', instructor: 'Chen' };
  assert.ok(new History(rows, 2, base).predict(q).gpa > 3.0);
  assert.equal(new History(rows, 2, { ...base, ambiguous: new Set(['CS|Chen']) }).predict(q).gpa, 3.0);
});

test('calibrated range covers about the requested share of residuals', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const mk = (n: number): Scored[] => Array.from({ length: n }, () => {
    const err = (rnd() - 0.5) * 0.8;
    const r = row({ term: 1, gpa: 3 + err, graded: 30, instructor: 'A' });
    return { row: r, pred: { gpa: 3, students: 100, sections: 2, basis: 'instructor-course' as const }, err: -err };
  });
  const cal = calibrate(mk(2000), 0.8);
  const test = mk(2000);
  const hit = test.filter((s) => {
    const [lo, hi] = range(cal, s.pred.gpa, s.pred.students, s.row.graded);
    return s.row.gpa >= lo && s.row.gpa <= hi;
  }).length / test.length;
  assert.ok(hit > 0.77 && hit < 0.83, `coverage ${hit}`);
  assert.equal(bucketOf(0, 10), 'h0|s<20');
});

test('pairwise accuracy counts only pairs that really differ', () => {
  const mk = (instr: string, act: number, pred: number): Scored => ({
    row: row({ term: 1, gpa: act, graded: 10, instructor: instr }),
    pred: { gpa: pred, students: 50, sections: 1, basis: 'instructor-course' }, err: pred - act,
  });
  const m = metrics([mk('A', 3.5, 3.4), mk('B', 3.0, 3.1), mk('C', 3.05, 3.6)], 0.15);
  // Pairs with |gap| >= 0.15: A-B (right), A-C (wrong). B-C differs by 0.05, skipped.
  assert.equal(m.pairs, 2);
  assert.equal(m.pairAccuracy, 0.5);
});

test('ambiguity flags common surnames and implausible teaching loads', () => {
  const rows = [
    row({ term: 1, gpa: 3, graded: 10, instructor: 'Chen', course: 'CS 1114' }),
    ...['CS 1114', 'CS 2114', 'CS 3114', 'CS 5114', 'CS 6114'].map((course) => row({ term: 1, gpa: 3, graded: 10, instructor: 'Zorn', course })),
    row({ term: 1, gpa: 3, graded: 10, instructor: 'Quill', course: 'CS 2114' }),
  ];
  const a = ambiguity(rows);
  assert.ok(a.get('CS|Chen')!.ambiguous);
  assert.ok(a.get('CS|Zorn')!.ambiguous);
  assert.equal(a.get('CS|Quill')!.ambiguous, false);
});

test('parseUdc skips Winter and Summer rows (current exports include them)', () => {
  const line = (term: string) => `"2025-26","${term}","CS","1114","Intro","Abbott","3.0","50","0","0","30","0","0","20","0","0","0","0","0","1","40","12345","3"`;
  const rows = parseUdc([HEADER, line('Fall'), line('Winter'), line('Summer I'), line('Summer II'), line('Spring')].join('\n'));
  assert.deepEqual(rows.map((r) => r.termLabel), ['Fall 2025', 'Spring 2026']);
});

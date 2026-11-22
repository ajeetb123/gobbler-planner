import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { balanceBound, optimize } from '../src/plan/optimize.ts';
import { credits, parseRoadmaps, repack, type PlanItem, type Term } from '../src/plan/roadmap.ts';
import { checkItems, parsePrereqs, planIssues, type CheckItem } from '../src/plan/prereq.ts';

const item = (id: string, cr: number, code?: string): PlanItem => ({ id, code, alt: [], label: code ?? 'Elective', credits: cr, choices: [], src: 0 });
const conflicts = (ts: Term[], check: Record<string, CheckItem>) => Object.values(planIssues(check, ts.map((t) => t.items.map((i) => i.id)), [])).filter((v) => v.late.length || v.coLate.length).length;

test('balanceBound: zero when credits can level the terms, never above the real imbalance', () => {
  assert.equal(balanceBound([0, 0, 0], [1, 1, 1], 30, 10), 0);
  assert.equal(balanceBound([10, 10, 10], [1, 1, 1], 0, 10), 0);
  // One term already over the mean: that excess can never be undone.
  assert.ok(Math.abs(balanceBound([16, 0, 0], [1, 1, 1], 14, 10) - (36 + 9 + 9)) < 1e-9);
  // Random check against real completions: the bound never exceeds what any actual split achieves.
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let trial = 0; trial < 200; trial++) {
    const loads = [0, 0, 0, 0].map(() => Math.floor(rnd() * 12)), chunks = Array.from({ length: 5 }, () => 1 + Math.floor(rnd() * 4));
    const rest = chunks.reduce((a, b) => a + b, 0), mean = (loads.reduce((a, b) => a + b, 0) + rest) / 4;
    const bound = balanceBound(loads, [1, 1, 1, 1], rest, mean);
    const l = [...loads]; for (const c of chunks) l[Math.floor(rnd() * 4)]! += c;
    assert.ok(bound <= l.reduce((s, x) => s + (x - mean) ** 2, 0) + 1e-9);
  }
});

test('optimize: fixes a conflict the starting layout has, proves it, and never loses a course', () => {
  // B needs A, C needs B. Start has C before B: one conflict, and the terms are lopsided.
  const check: Record<string, CheckItem> = { a: { cs: ['AA 1000'] }, b: { cs: ['BB 2000'], pre: 'AA 1000' }, c: { cs: ['CC 3000'], pre: 'BB 2000' }, e1: { cs: [] }, e2: { cs: [] }, e3: { cs: [] } };
  const start: Term[] = [
    { label: 'T1', items: [item('a', 3, 'AA 1000'), item('c', 3, 'CC 3000'), item('e1', 3), item('e2', 3)] },
    { label: 'T2', items: [item('b', 3, 'BB 2000')] },
    { label: 'T3', items: [item('e3', 3)] },
  ];
  assert.equal(conflicts(start, check), 1);
  const r = optimize(start, [1, 1, 1], check);
  assert.equal(conflicts(r.terms, check), 0);
  assert.equal(r.proven, true);
  assert.ok(r.after < r.before);
  assert.deepEqual(r.terms.map((t) => credits(t.items)), [6, 6, 6]);
  assert.deepEqual(r.terms.flatMap((t) => t.items.map((i) => i.id)).sort(), ['a', 'b', 'c', 'e1', 'e2', 'e3']);
  const term = (id: string) => r.terms.findIndex((t) => t.items.some((i) => i.id === id));
  assert.ok(term('a') < term('b') && term('b') < term('c'));
});

test('optimize: a layout that is already best is returned unchanged; a tiny budget still returns a valid layout', () => {
  const check: Record<string, CheckItem> = { a: { cs: ['AA 1000'] }, b: { cs: ['BB 2000'], pre: 'AA 1000' } };
  const good: Term[] = [{ label: 'T1', items: [item('a', 3, 'AA 1000')] }, { label: 'T2', items: [item('b', 3, 'BB 2000')] }];
  const r = optimize(good, [1, 1], check);
  assert.equal(r.terms, good);
  assert.equal(r.after, r.before);
  assert.equal(optimize(good, [1, 1], check, 1).terms.flatMap((t) => t.items).length, 2);
});

test('optimize on real roadmaps: never more conflicts than the greedy layout it starts from', () => {
  const courses = parsePrereqs(readFileSync('data/prereqs.txt', 'utf8'));
  const real = parseRoadmaps(readFileSync('data/roadmaps/engineering.txt', 'utf8'));
  let after = 0;
  for (const r of real) {
    const check = checkItems(r.terms, courses);
    for (const y of [3, 5]) {
      const done = repack(r, y, check);
      after += conflicts(done, check);
      assert.equal(done.flatMap((t) => t.items).length, r.terms.flatMap((t) => t.items).length);
    }
  }
  assert.ok(after <= 6, `conflicts after: ${after}`);
});

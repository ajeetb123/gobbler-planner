import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { byCollege, credits, parseNoRoadmap, parseRoadmaps, repack, YEAR_OPTIONS } from '../src/plan/roadmap.ts';
import { checkItems, parseExpr, parsePrereqs, planIssues } from '../src/plan/prereq.ts';
import { switchCost, type SwitchItem } from '../src/plan/switch.ts';
import { compareData, COMPARE_JS, renderCompare } from '../src/site/compare-page.ts';
import { PLAN_JS, renderPlan, renderPlanAbout, renderPlanIndex } from '../src/site/plan-page.ts';

const texts = readdirSync('data/roadmaps').filter((f) => f.endsWith('.txt')).sort().map((f) => readFileSync(`data/roadmaps/${f}`, 'utf8'));
// Every saved roadmap, all colleges.
const real = texts.flatMap((t) => parseRoadmaps(t));
/** On a roadmap but absent from the catalog's undergraduate course descriptions (Nov 21, 2026): no prerequisite data. */
const NOT_IN_CATALOG = ['AINS 2414', 'BSE 5344', 'BSE 5524', 'ENT 4224', 'NR 2554'];
const courses = parsePrereqs(readFileSync('data/prereqs.txt', 'utf8'));
const cs = real.find((r) => r.slug === 'computer-science')!;
const ids = (terms: Array<{ items: Array<{ id: string }> }>) => terms.map((t) => t.items.map((i) => i.id));
const idOf = (code: string) => cs.terms.flatMap((t) => t.items).find((i) => i.code === code)!.id;

test('parseExpr: "and" binds tighter than "or", commas mean and, free text is refused', () => {
  assert.deepEqual(parseExpr('CS 2114'), 'CS 2114');
  assert.deepEqual(parseExpr('A 1000 or B 1000 and C 1000'.replace(/([ABC])/g, '$1$1')), ['|', 'AA 1000', ['&', 'BB 1000', 'CC 1000']]);
  assert.deepEqual(parseExpr('(CS 2114 or ECE 3514) and MATH 2534'), ['&', ['|', 'CS 2114', 'ECE 3514'], 'MATH 2534']);
  assert.deepEqual(parseExpr('MATH 2214, PHYS 2306'), ['&', 'MATH 2214', 'PHYS 2306']);
  assert.deepEqual(parseExpr('PHYS 2305 AND (MATH 2204 or MATH 2204H)'), ['&', 'PHYS 2305', ['|', 'MATH 2204', 'MATH 2204H']]);
  assert.deepEqual(parseExpr('ESM 2104 or ESM 2114.'), ['|', 'ESM 2104', 'ESM 2114']);
  for (const bad of ['', '4065 or 4165 for 4105.', 'CHE 2164 2164', '(CS 2114', 'CS 2114 or'])
    assert.equal(parseExpr(bad), undefined, bad);
});

test('prerequisite file covers every course on a roadmap, and every prerequisite line parses', () => {
  const missing = [...new Set(texts.join('\n').match(/[A-Z]{2,4} \d{4}H?/g))].filter((code) => !courses.has(code)).sort();
  assert.deepEqual(missing, NOT_IN_CATALOG);
  for (const c of courses.values()) if (c.preText) assert.ok(c.pre, `${c.code}: ${c.preText}`);
});

test('every saved roadmap: unique slug, term sums and total match what the catalog prints, known college', () => {
  assert.equal(real.length, 128);
  assert.equal(new Set(real.map((r) => r.slug)).size, real.length);
  for (const r of real) {
    assert.ok(r.terms.length >= 8, r.slug);
    r.terms.forEach((t, i) => assert.equal(credits(t.items), r.printedSums[i], `${r.slug} ${t.label}`));
    assert.equal(credits(r.terms.flatMap((t) => t.items)), r.total, r.slug);
  }
  const groups = byCollege(real);
  assert.ok(!groups.some(([c]) => c === 'Other'));
  assert.equal(groups.length, 7);
  const none = parseNoRoadmap(readFileSync('data/no-roadmap.txt', 'utf8'));
  assert.equal(none.length, 88);
  const have = new Set(real.map((r) => r.catalogPath));
  for (const x of none) assert.ok(!have.has(x.catalogPath), x.name);
});

test('official roadmaps show no prerequisite conflicts', () => {
  for (const r of real) {
    const issues = planIssues(checkItems(r.terms, courses), ids(r.terms), []);
    for (const [id, v] of Object.entries(issues)) assert.deepEqual([v.late, v.coLate], [[], []], `${r.slug} ${id}`);
  }
});

test('planIssues: a move ahead of a prerequisite is flagged, finished courses count, chains have no slack', () => {
  const check = checkItems(cs.terms, courses);
  const terms = ids(cs.terms);
  const a = idOf('CS 2114'), b = idOf('CS 2505');
  // Pull CS 2505 (second year fall) into the term CS 2114 is in.
  const moved = terms.map((t) => t.filter((x) => x !== b));
  moved[1]!.push(b);
  assert.deepEqual(planIssues(check, moved, [])[b]!.late, [a]);
  assert.deepEqual(planIssues(check, moved, [a])[b]!.late, []);
  const base = planIssues(check, terms, []);
  assert.ok(base[a]!.unlocks.includes('CS 2505'));
  // Longest chain: CS 1114 -> 2114 -> 2505 -> 3114 -> 3304 is 4 steps, so CS 1114 can sit in term 3 of 0..7 at the latest.
  assert.equal(base[idOf('CS 1114')]!.slack, 3);
  assert.equal(base[idOf('CS 3114')]!.slack, 2);
  assert.equal(base[idOf('CS 4944')]!.slack, undefined);
  // "MATH 2534 or MATH 3034" is one slot: CS 3114 needs it whichever is taken.
  assert.ok(base[cs.terms[2]!.items.find((i) => i.code === 'MATH 2534')!.id]!.unlocks.includes('CS 3114'));
});

test('repack with prerequisites: few conflicts left, every course kept, loads stay sane', () => {
  let conflicts = 0;
  for (const r of real) {
    const check = checkItems(r.terms, courses);
    for (const y of YEAR_OPTIONS) {
      const terms = repack(r, y, check);
      assert.equal(terms.flatMap((t) => t.items).length, r.terms.flatMap((t) => t.items).length, `${r.slug} ${y}`);
      assert.ok(Math.max(...terms.map((t) => credits(t.items))) <= 27, `${r.slug} ${y}: ${terms.map((t) => credits(t.items))}`);
      conflicts += Object.values(planIssues(check, ids(terms), [])).filter((v) => v.late.length || v.coLate.length).length;
    }
  }
  // 47 over 640 layouts on Nov 21, 2026, mostly a two-part capstone landing in the last term of a 3-year plan. The page flags them.
  assert.ok(conflicts <= 47, `conflicts: ${conflicts}`);
});

test('switchCost: same course carries, same-name electives likely carry, each target slot is used once', () => {
  const item = (id: string, cr: number, label: string, ...cs: string[]): SwitchItem => ({ id, cr, label, cs });
  const from = [item('a', 4, 'Calc', 'MATH 1225'), item('b', 3, 'Pathways 2'), item('c', 3, 'Pathways 2'), item('d', 3, 'Intro', 'CS 1114'), item('e', 2, 'Seminar', 'XX 1000')];
  const to = [item('p', 4, 'Calc', 'MATH 1225', 'MATH 1025'), item('q', 3, 'pathways 2'), item('r', 3, 'Core', 'ECE 1004'), item('s', 3, 'Free Elective')];
  const r = switchCost(from, to, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(r.carried, [['a', 'p']]);
  assert.deepEqual(r.likely, [['b', 'q']]);
  assert.deepEqual([r.free, r.freeUsed], [['c'], 3]); // one 3-credit leftover fits the free elective
  assert.deepEqual(r.unmatched, ['d', 'e']);
  assert.equal(r.doneCredits, 15);
  assert.equal(r.counted, 10);
  assert.equal(r.remaining, 3);
  assert.equal(switchCost(from, to, []).remaining, 13);
});

test('compare data: CS to Computer Engineering after year one keeps the shared first-year courses', () => {
  const data = compareData(real, courses);
  const a = data.find((m) => m.slug === 'computer-science')!, b = data.find((m) => m.slug === 'computer-engineering')!;
  const arr = (m: typeof a) => Object.entries(m.items).map(([id, i]) => ({ id, ...i }));
  const r = switchCost(arr(a), arr(b), a.terms.slice(0, 2).flatMap((t) => t.ids));
  const carried = r.carried.map(([x]) => a.items[x]!.code);
  for (const code of ['MATH 1225', 'MATH 1226', 'ENGE 1215', 'ENGL 1105']) assert.ok(carried.includes(code), code);
  assert.ok(r.counted <= r.doneCredits);
  assert.equal(r.remaining, b.total - r.counted);
  // Switching to the same major loses nothing.
  assert.equal(switchCost(arr(a), arr(a), a.terms.slice(0, 3).flatMap((t) => t.ids)).unmatched.length, 0);
});

test('planner-only build: no grade pages linked, links out to UDC and RMP, scripts are valid JavaScript', () => {
  const html = renderPlan(cs, courses);
  assert.ok(!html.includes('course/'));
  assert.ok(html.includes('https://udc.vt.edu/irdata/data/courses/grades'));
  assert.ok(html.includes('https://www.ratemyprofessors.com/school/1349'));
  assert.ok(html.includes('compare.html#from=computer-science'));
  assert.ok(!html.includes('>Grades</a>'));
  const data = JSON.parse(/id="plan-data">(.*?)<\/script>/s.exec(html)![1]!);
  assert.equal(data.items[idOf('CS 2114')].label, 'Software Design and Data Structures');
  assert.deepEqual(data.items[idOf('CS 2505')].pre, 'CS 2114');
  assert.ok(renderPlanIndex(real, undefined, true).includes('href="plan/computer-science.html"'));
  assert.ok(renderPlanAbout().includes('HokieGPS'));
  assert.ok(renderCompare(real, courses).includes('id="cmp-data"'));
  for (const js of [PLAN_JS, COMPARE_JS]) assert.doesNotThrow(() => new Function(js));
});

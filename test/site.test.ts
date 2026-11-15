import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UdcRow } from '../src/grades/udc.ts';
import { BASELINE_PARAMS } from '../src/grades/estimate.ts';
import { spreadOf } from '../src/grades/matters.ts';
import { defaultGrid, tune } from '../src/grades/tune.ts';
import { buildSite, dedupeRows, termLabel } from '../src/site/model.ts';
import { bOrBetter, esc, renderCourse, renderIndex, renderProf, rmpUrl, slugs } from '../src/site/render.ts';

let crn = 10000;
function row(course: string, instructor: string, term: number, gpa: number, graded = 40, title = 'Intro'): UdcRow {
  const [subject, courseNo] = course.split(' ') as [string, string];
  const pct = { A: 50, 'A-': 0, 'B+': 0, B: 30, 'B-': 0, 'C+': 0, C: 20, 'C-': 0, 'D+': 0, D: 0, 'D-': 0, F: 0 };
  return { term, termLabel: '', subject, courseNo, course, title, instructor, gpa, pct, withdraws: 2, graded, crn: String(crn++), coTaught: false };
}

// Terms 4040..4047. Target is 4048. Abbott grades high, Baker low, in both of their courses.
function fixture(): UdcRow[] {
  const rows: UdcRow[] = [];
  for (let t = 4040; t <= 4047; t++) {
    rows.push(row('CS 1114', 'Abbott', t, 3.6), row('CS 1114', 'Baker', t, 2.8), row('CS 1114', 'Lee', t, 3.2));
    rows.push(row('CS 2505', 'Abbott', t, 3.5), row('CS 2505', 'Baker', t, 2.9));
    rows.push(row('CS 5000', 'Abbott', t, 3.9)); // graduate: no page
  }
  rows.push(row('CS 1114', 'Oldtimer', 4040, 3.0));
  rows.push(row('CS 3214', 'A&B <Team>', 4047, 3.1, 40, 'Systems & "Stuff"'));
  return rows;
}
const site = () => buildSite(fixture());
const linksFor = (s: ReturnType<typeof site>) => ({ course: slugs(s.courses.map((c) => c.course)), prof: slugs(s.profs.map((p) => p.key)) });

test('termLabel inverts the term index', () => {
  assert.equal(termLabel(4047), 'Fall 2023');
  assert.equal(termLabel(4048), 'Spring 2024');
});

test('spreadOf: verdict follows the gap and ignores thin histories', () => {
  assert.equal(spreadOf([{ gpa: 3.0, students: 100 }, { gpa: 3.1, students: 100 }]).verdict, 'barely');
  assert.equal(spreadOf([{ gpa: 3.0, students: 100 }, { gpa: 3.3, students: 100 }]).verdict, 'some');
  assert.equal(spreadOf([{ gpa: 2.5, students: 100 }, { gpa: 3.1, students: 100 }]).verdict, 'matters');
  // The 1.0 outlier has only 10 students, so it cannot create a "matters" verdict.
  assert.equal(spreadOf([{ gpa: 3.0, students: 100 }, { gpa: 3.1, students: 100 }, { gpa: 1.0, students: 10 }]).verdict, 'barely');
  assert.equal(spreadOf([{ gpa: 3.0, students: 100 }]).verdict, 'unknown');
});

test('tune only scores the two terms before the target', () => {
  const rows = fixture();
  const grid = [BASELINE_PARAMS, { ...BASELINE_PARAMS, kIC: 50 }];
  const before = tune(rows, 4046, grid);
  // Wild grades in the target term and later must not change the choice.
  const poisoned = [...rows, row('CS 1114', 'Abbott', 4046, 0.5, 4000), row('CS 1114', 'Baker', 4047, 4.0, 4000)];
  assert.equal(tune(poisoned, 4046, grid).kIC, before.kIC);
  assert.ok(defaultGrid().length > 100);
});

test('dedupeRows drops exact repeats but keeps co-taught rows', () => {
  const a = row('CS 1114', 'Abbott', 4040, 3);
  assert.equal(dedupeRows([a, { ...a }, { ...a, instructor: 'Baker' }]).length, 2);
});

test('buildSite: undergrad courses only, target is one term past the data', () => {
  const s = site();
  assert.equal(s.target, 4048);
  assert.deepEqual(s.courses.map((c) => c.course), ['CS 1114', 'CS 2505', 'CS 3214']);
  assert.equal(s.enrollmentShare, 1);
});

test('course page: sorted by name, flags, earlier instructors, verdict, wider unknown range', () => {
  const c = site().courses[0]!;
  assert.deepEqual(c.instructors.map((i) => i.name), ['Abbott', 'Baker', 'Lee']);
  assert.deepEqual(c.earlier.map((e) => e.name), ['Oldtimer']);
  assert.ok(c.instructors.find((i) => i.name === 'Lee')!.ambiguous);
  assert.ok(!c.instructors.find((i) => i.name === 'Abbott')!.ambiguous);
  assert.equal(c.spread.verdict, 'matters');
  const abbott = c.instructors[0]!;
  assert.ok(abbott.gpa > 3.4 && abbott.gpa <= 3.6);
  assert.ok(abbott.lo <= abbott.gpa && abbott.gpa <= abbott.hi);
  // Never narrower than a known instructor (equal here: the tiny fixture uses one pooled band).
  assert.ok(c.unknown.hi - c.unknown.lo >= abbott.hi - abbott.lo);
  // Fixture rows: 40 graded (50% A, 30% B, 20% C), 2 withdraws. Last 4 terms x 3 sections = 12 sections.
  assert.deepEqual(c.dist.bars.map((b) => b.label), ['W', 'F', 'D', 'C', 'B', 'A']);
  assert.deepEqual(c.dist.bars.map((b) => Math.round(b.n)), [24, 0, 0, 96, 144, 240]);
  assert.equal(c.dist.students, 480);
  assert.deepEqual(c.dist.top, { label: 'A', pct: 50 });
  assert.equal(abbott.terms, 8);
  assert.equal(abbott.dist.students, 320);
  assert.ok(Math.abs(abbott.dist.gpa - 3.6) < 1e-9);
  assert.ok(Math.abs(c.withdrawRate - 2 / 42) < 1e-9);
});

test('professor page: flagged names are never pooled across courses', () => {
  const s = site();
  const lee = s.profs.find((p) => p.key === 'CS|Lee')!;
  assert.ok(lee.ambiguous);
  assert.equal(lee.effect, undefined);
  assert.equal(lee.dist, undefined); // no "All Courses" total for a flagged name
  assert.match(renderProf(lee, s, linksFor(s)), /may cover more than one person/);
  const abbott = s.profs.find((p) => p.key === 'CS|Abbott')!;
  assert.deepEqual(abbott.panels.map((p) => p.course), ['CS 1114', 'CS 2505']); // no CS 5000
  assert.equal(abbott.panels[0]!.history[0]!.term, 4047); // newest first
  assert.equal(abbott.dist!.students, 640); // both undergrad courses, not CS 5000
  assert.match(renderProf(abbott, s, linksFor(s)), /id="overall"/);
  assert.doesNotMatch(renderProf(lee, s, linksFor(s)), /id="overall"/);
});

test('--top keeps the most-taken courses and only their instructors', () => {
  const s = buildSite(fixture(), { top: 1 });
  assert.deepEqual(s.courses.map((c) => c.course), ['CS 1114']);
  assert.ok(s.enrollmentShare < 1 && s.enrollmentShare > 0.5);
  assert.ok(!s.profs.some((p) => p.name === 'A&B <Team>'));
});

test('render escapes data and never labels anyone easy or best', () => {
  const s = site();
  const links = linksFor(s);
  const html = renderCourse(s.courses.find((c) => c.course === 'CS 3214')!, s, links);
  assert.ok(html.includes('Systems &amp; &quot;Stuff&quot;'));
  assert.ok(html.includes('A&amp;B &lt;Team&gt;'));
  assert.ok(!html.includes('<Team>'));
  for (const c of s.courses) assert.doesNotMatch(renderCourse(c, s, links), /\b(easy|easiest|best|worst)\b/i);
  assert.equal(esc(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});

test('slugs are unique even on case-insensitive file systems', () => {
  const m = slugs(["CS|O'Brien", 'CS|O Brien', 'CS|o brien', 'CS|Chen']);
  assert.equal(new Set([...m.values()].map((v) => v.toLowerCase())).size, 4);
  assert.equal(m.get('CS|Chen'), 'CS-Chen');
});

test('RateMyProfessors links: VT search by last name, encoded, on course and instructor pages', () => {
  assert.equal(rmpUrl('MADRID PADILLA'), 'https://www.ratemyprofessors.com/search/professors/1349?q=MADRID%20PADILLA');
  const s = site();
  const links = linksFor(s);
  assert.ok(renderCourse(s.courses[0]!, s, links).includes('search/professors/1349?q=Abbott'));
  assert.ok(renderProf(s.profs.find((p) => p.key === 'CS|Abbott')!, s, links).includes('search/professors/1349?q=Abbott'));
  const odd = renderProf(s.profs.find((p) => p.name === 'A&B <Team>')!, s, links);
  assert.ok(odd.includes('q=A%26B%20%3CTeam%3E'));
});

test('home page links both ways in: grades and the degree planner', () => {
  const s = site();
  const html = renderIndex(s, linksFor(s), 15);
  assert.ok(html.includes('href="plan/index.html"'));
  assert.ok(html.includes('href="course/CS-1114.html"')); // most-taken courses
  assert.ok(html.includes('href="subject/CS.html"'));
});

test('course page: compare buttons carry the estimate and a spread taken from the 80% range', () => {
  const s = site();
  const c = s.courses[0]!;
  const html = renderCourse(c, s, linksFor(s));
  const a = c.instructors[0]!;
  const m = /class="pick"[^>]*data-n="Abbott" data-g="([\d.]+)" data-s="([\d.]+)"/.exec(html)!;
  assert.ok(Math.abs(Number(m[1]) - a.gpa) < 0.001);
  assert.ok(Math.abs(Number(m[2]) - (a.hi - a.lo) / 2.563) < 0.001);
  assert.equal((html.match(/class="pick"/g) ?? []).length, c.instructors.length + 1); // plus "a new instructor"
  assert.ok(html.includes('id="cmp"'));
  // Fixture grades: 50% A, 30% B.
  assert.ok(Math.abs(bOrBetter(c.dist) - 80) < 1e-9);
  assert.ok(html.includes('got a B or higher'));
});

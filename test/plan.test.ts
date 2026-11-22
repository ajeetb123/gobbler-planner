import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePrereqs } from '../src/plan/prereq.ts';
import { credits, parseRoadmaps, repack, slots, YEAR_OPTIONS } from '../src/plan/roadmap.ts';

const real = parseRoadmaps(readFileSync('data/roadmaps/engineering.txt', 'utf8'));
const courses = parsePrereqs(readFileSync('data/prereqs.txt', 'utf8'));

test('parseRoadmaps: names with commas and brackets, "or" pairs, choice lists', () => {
  const [r] = parseRoadmaps(`## demo | Demo | x/y/
First Year
 Fall: MATH 2534or MATH 3034 (3), Elective (Pathways Concept 2, 3, or 7) (3), Select one of the following: (3), STAT 4604 (), STAT 4705 (), ENGE 3900 Bridge Experience 1 (0), CS 3/4/5XXX (3), sum 12
TOTAL 12
`);
  const items = r!.terms[0]!.items;
  assert.deepEqual(items.map((i) => i.code), ['MATH 2534', undefined, undefined, 'ENGE 3900', undefined]);
  assert.deepEqual(items[0]!.alt, ['MATH 3034']);
  assert.equal(items[1]!.label, 'Elective (Pathways Concept 2, 3, or 7)');
  assert.deepEqual(items[2]!.choices, ['STAT 4604', 'STAT 4705']);
  assert.equal(r!.terms[0]!.label, 'First year, Fall');
  assert.equal(credits(items), 12);
});

test('saved catalog roadmaps add up to the sums and totals the catalog prints', () => {
  assert.equal(real.length, 15);
  for (const r of real) {
    r.terms.forEach((t, i) => assert.equal(credits(t.items), r.printedSums[i], `${r.slug} ${t.label}`));
    assert.equal(credits(r.terms.flatMap((t) => t.items)), r.total, r.slug);
  }
  const cs = real.find((r) => r.slug === 'computer-science')!;
  assert.equal(cs.total, 123);
  assert.equal(cs.terms[0]!.items[0]!.code, 'CS 1114');
});

test('repack: 4 years is the official plan; other lengths keep every course and each subject\'s order', () => {
  for (const r of real) {
    assert.equal(repack(r, 4), r.terms);
    const official = r.terms.flatMap((t) => t.items.map((i) => i.id));
    const bySubject = (ids: string[], sub: string) => ids.filter((id) => all.get(id)!.code?.startsWith(sub + ' '));
    const all = new Map(r.terms.flatMap((t) => t.items).map((i) => [i.id, i]));
    const subjects = new Set([...all.values()].flatMap((i) => (i.code ? [i.code.split(' ')[0]!] : [])));
    for (const y of YEAR_OPTIONS) {
      if (y === 4) continue;
      const terms = repack(r, y);
      assert.equal(terms.length, slots(y).length, `${r.slug} ${y}`);
      const got = terms.flatMap((t) => t.items.map((i) => i.id));
      assert.deepEqual([...got].sort(), [...official].sort(), `${r.slug} ${y}`);
      for (const sub of subjects) assert.deepEqual(bySubject(got, sub), bySubject(official, sub), `${r.slug} ${y} ${sub}`);
    }
  }
});

test('repack: same-subject courses from different official terms never share a term', () => {
  for (const r of real)
    for (const y of [3, 3.5, 4.5, 5]) {
      const terms = repack(r, y);
      terms.slice(0, -1).forEach((t) => {
        for (const a of t.items) for (const b of t.items)
          if (a.code && b.code && a.src < b.src) assert.notEqual(a.code.split(' ')[0], b.code.split(' ')[0], `${r.slug} ${y}y ${t.label}: ${a.code} with ${b.code}`);
      });
    }
});

test('repack: longer plans are lighter, shorter plans heavier', () => {
  const cs = real.find((r) => r.slug === 'computer-science')!;
  const max = (y: number) => Math.max(...repack(cs, y).map((t) => credits(t.items)));
  assert.ok(max(5) < max(4));
  assert.ok(max(3) > max(4));
  // Under 4 years the plan leans on summers; from 4 years up it never does.
  assert.deepEqual(slots(3).map((x) => x.label.split(', ')[1]), ['Fall', 'Spring', 'Summer', 'Fall', 'Spring', 'Summer', 'Fall', 'Spring']);
  assert.ok(!slots(4.5).some((x) => x.label.includes('Summer')));
  for (const r of real) assert.ok(Math.max(...repack(r, 3).map((t) => credits(t.items))) <= 24, r.slug);
  assert.equal(repack(cs, 5)[0]!.label, 'First year, Fall');
  assert.equal(repack(cs, 5)[9]!.label, 'Fifth year, Spring');
});

// ---- planner page ----
import { buildSite } from '../src/site/model.ts';
import { slugs } from '../src/site/render.ts';
import { planData, renderPlan, renderPlanIndex } from '../src/site/plan-page.ts';
import type { UdcRow } from '../src/grades/udc.ts';

function demoSite() {
  let crn = 1;
  const rows: UdcRow[] = [];
  for (let t = 4040; t <= 4047; t++)
    for (const [course, title, gpa] of [['CS 1114', 'Intro to Software Design', 3.1], ['MATH 1225', 'Calculus </script> & more', 2.5]] as const) {
      const [subject, courseNo] = course.split(' ') as [string, string];
      rows.push({ term: t, termLabel: '', subject, courseNo, course, title, instructor: 'Abbott', gpa, pct: {} as UdcRow['pct'], withdraws: 0, graded: 40, crn: String(crn++), coTaught: false });
    }
  const site = buildSite(rows);
  return { site, links: { course: slugs(site.courses.map((c) => c.course)), prof: slugs(site.profs.map((p) => p.key)) } };
}

test('planData: grade data is attached to known courses, elective slots stay plain', () => {
  const { site, links } = demoSite();
  const cs = real.find((r) => r.slug === 'computer-science')!;
  const d = planData(cs, courses, site, links);
  const first = d.items[cs.terms[0]!.items[0]!.id]!;
  assert.equal(first.code, 'CS 1114');
  assert.equal(first.label, 'Intro to Software Design');
  assert.equal(first.h, 'course/CS-1114.html');
  assert.ok(Math.abs(first.g! - 3.1) < 0.01);
  const elective = Object.values(d.items).find((i) => i.label === 'Natural Science Elective')!;
  assert.equal(elective.g, undefined);
  assert.equal(elective.h, undefined);
  assert.equal(d.total, 123);
  assert.deepEqual(Object.keys(d.plans).sort(), ['2', '2.5', '3', '3.5', '4', '4.5', '5']);
  assert.equal(d.plans['4']!.length, 8);
  // Every plan length holds every course exactly once.
  for (const p of Object.values(d.plans)) assert.equal(p.flatMap((t) => t.ids).length, Object.keys(d.items).length);
});

test('plan pages: embedded JSON cannot close its script tag, and every major is listed', () => {
  const { site, links } = demoSite();
  const html = renderPlan(real.find((r) => r.slug === 'computer-science')!, courses, site, links);
  const json = /<script type="application\/json" id="plan-data">(.*?)<\/script>/s.exec(html)![1]!;
  assert.ok(!json.includes('</'));
  assert.equal(JSON.parse(json).items['t0-3'].label, 'Calculus </script> & more');
  assert.match(html, /catalog\.vt\.edu\/undergraduate\/college-engineering\/computer-science\/computer-science-bs\/#roadmaptext/);
  const index = renderPlanIndex(real, site);
  for (const r of real) assert.ok(index.includes(`href="${r.slug}.html"`), r.slug);
});

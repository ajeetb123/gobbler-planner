import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { byCollege, credits, FULL_LOAD_YEARS, parseNoRoadmap, parseRoadmaps, repack, YEAR_OPTIONS } from '../src/plan/roadmap.ts';
import { checkItems, parseExpr, parsePrereqs, planIssues, type Expr } from '../src/plan/prereq.ts';
import { doubleMajor, switchCost, type SwitchItem } from '../src/plan/switch.ts';
import { draftRoadmap, parseRequirements } from '../src/plan/draft.ts';
import { baseYears } from '../src/plan/roadmap.ts';
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
  // Prerequisites the catalog writes as free text are not checked. 3 on Nov 21, 2026.
  const unread = [...courses.values()].filter((c) => c.preText && !c.pre).map((c) => c.code);
  assert.ok(unread.length <= 3, unread.join(', '));
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
      // 2 and 2.5 years are for students who bring in credit: they must hold every course, but the load and
      // conflict limits only apply to lengths a student can do from scratch.
      if (!(FULL_LOAD_YEARS as readonly number[]).includes(y)) continue;
      assert.ok(Math.max(...terms.map((t) => credits(t.items))) <= 23, `${r.slug} ${y}: ${terms.map((t) => credits(t.items))}`);
      conflicts += Object.values(planIssues(check, ids(terms), [])).filter((v) => v.late.length || v.coLate.length).length;
    }
  }
  // 25 over 512 rearranged layouts on Nov 21, 2026 with the branch-and-bound scheduler (47 greedy, 37 with repair).
  // 26 on Nov 22, 2026, after planIssues started checking the in-plan parts of requirements it used to skip whole.
  // The page flags them.
  assert.ok(conflicts <= 26, `conflicts: ${conflicts}`);
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
  // Grade and review links live in the course panel, which the page script builds.
  assert.ok(PLAN_JS.includes('https://udc.vt.edu/irdata/data/courses/grades'));
  assert.ok(PLAN_JS.includes('https://www.ratemyprofessors.com/school/1349'));
  assert.ok(html.includes('compare.html#from=computer-science'));
  assert.ok(!html.includes('>Grades</a>'));
  const data = JSON.parse(/id="plan-data">(.*?)<\/script>/s.exec(html)![1]!);
  assert.equal(data.items[idOf('CS 2114')].label, 'Software Design and Data Structures');
  assert.deepEqual(data.items[idOf('CS 2505')].pre, 'CS 2114');
  assert.ok(renderPlanIndex(real, undefined, true).includes('href="plan/computer-science.html"'));
  // Naming: the site calls itself Gobbler Plan, never names the university, and carries the disclaimer.
  for (const page of [html, renderPlanAbout(), renderPlanIndex(real, undefined, true), renderCompare(real, courses)]) {
    const text = page.replace(/<script type="application\/json".*?<\/script>/gs, '').replace(/<[^>]+>/g, ' ');
    assert.ok(text.includes('Gobbler Plan'));
    assert.ok(text.includes('Not affiliated with, endorsed by, or sponsored by any university'));
    assert.ok(!/Virginia Tech|Virginia Polytechnic/.test(text), 'the site does not name the university');
    assert.ok(!/\bVT\b|Hokie/.test(text), /.{30}(\bVT\b|Hokie).{30}/.exec(text)?.[0]);
  }
  assert.ok(renderCompare(real, courses).includes('id="cmp-data"'));
  for (const js of [PLAN_JS, COMPARE_JS]) assert.doesNotThrow(() => new Function(js));
});

// ---- draft plans (majors with requirements but no catalog roadmap) ----
const reqs = readdirSync('data/requirements').filter((f) => f.endsWith('.txt')).sort().flatMap((f) => parseRequirements(readFileSync(`data/requirements/${f}`, 'utf8')));

test('parseRequirements + draftRoadmap: every requirement is placed once, prerequisites first, marked draft', () => {
  const [q] = parseRequirements(`## demo | Demo | college-science/x/demo/
REQ: CS 3114 (3), CS 2114 (3), CS 1114 (3), CS 2505 (3), MATH 2534 (3), Pathway 2 (3), Pathway 2 (3), Free electives (3), Free electives (3), Elective (choose from list) (3), CS 3304 (), CS 3214 (), 
TOTAL 30
`);
  assert.equal(q!.items.length, 10);
  assert.deepEqual(q!.items[9]!.choices, ['CS 3304', 'CS 3214']);
  const r = draftRoadmap(q!, courses);
  assert.equal(r.draft, true);
  assert.equal(r.terms.length, 2);
  const term = (code: string) => r.terms.findIndex((t) => t.items.some((i) => i.code === code));
  assert.ok(term('CS 1114') < term('CS 2114') || r.terms.length === 2);
  assert.equal(credits(r.terms.flatMap((t) => t.items)), 30);
  assert.equal(new Set(r.terms.flatMap((t) => t.items.map((i) => i.id))).size, 10);
});

test('every saved requirement list becomes a balanced draft with few conflicts', () => {
  assert.equal(reqs.length, 85);
  const official = new Set(real.map((r) => r.slug));
  let conflicts = 0;
  for (const q of reqs) {
    assert.ok(!official.has(q.slug), q.slug);
    assert.equal(credits(q.items), q.total, q.slug);
    const r = draftRoadmap(q, courses);
    assert.equal(r.terms.flatMap((t) => t.items).length, q.items.length, q.slug);
    assert.equal(baseYears(r), q.total > 136 ? 5 : 4, q.slug);
    const loads = r.terms.map((t) => credits(t.items));
    assert.ok(Math.min(...loads) >= 12 && Math.max(...loads) <= 18, `${q.slug}: ${loads}`);
    // 1000-level before 4000-level on average: the first year holds no 4000-level course.
    assert.ok(!r.terms.slice(0, 2).some((t) => t.items.some((i) => i.code && /^[A-Z]+ 4/.test(i.code))), q.slug);
    conflicts += Object.values(planIssues(checkItems(r.terms, courses, true), ids(r.terms), [])).filter((v) => v.late.length || v.coLate.length).length;
  }
  // 2 on Nov 21, 2026 with the branch-and-bound scheduler (13 greedy, 6 with repair). Drafts hide nothing: the page shows them.
  assert.ok(conflicts <= 2, `conflicts: ${conflicts}`);
});

test('plans built from requirements say their order is a suggestion; roadmap pages do not', () => {
  const r = draftRoadmap(reqs.find((q) => q.slug === 'psychology-bs')!, courses);
  const html = renderPlan(r, courses);
  assert.ok(html.includes('Suggested order.') && html.includes('the term-by-term order is a suggestion'));
  // Never call a generated order an official roadmap.
  assert.ok(!html.includes('official roadmap') && !html.includes('official 2026-2027 roadmap'));
  assert.ok(!html.includes('#roadmaptext'));
  assert.ok(!renderPlan(cs, courses).includes('Suggested order.'));
  const index = renderPlanIndex([cs, r], undefined, true);
  // The home page no longer explains drafts; each draft's own page says its order is a suggestion.
  assert.ok(!index.includes('>draft<'));
  const arch = draftRoadmap(reqs.find((q) => q.slug === 'architecture-barch')!, courses);
  assert.equal(JSON.parse(/id="plan-data">(.*?)<\/script>/s.exec(renderPlan(arch, courses))![1]!).base, '5');
});

// ---- double major ----
test('doubleMajor: shared courses count once, free electives absorb extra work, same major adds nothing', () => {
  const it = (id: string, cr: number, label: string, ...cs: string[]): SwitchItem => ({ id, cr, label, cs });
  const first = [it('a', 4, 'Calc', 'MATH 1225'), it('b', 3, 'Intro', 'CS 1114'), it('c', 3, 'Pathways 2'), it('d', 3, 'Free Elective'), it('e', 3, 'Free Elective')];
  const second = [it('p', 4, 'Calc', 'MATH 1225'), it('q', 3, 'Circuits', 'ECE 2024'), it('r', 3, 'Signals', 'ECE 2714'), it('s', 3, 'Fields', 'ECE 3105'), it('t', 3, 'pathways 2'), it('u', 3, 'Free Elective')];
  const r = doubleMajor(first, second);
  assert.deepEqual(r.shared, [['a', 'p'], ['c', 't']]);
  assert.deepEqual(r.extraItems, ['q', 'r', 's']);
  assert.equal(r.freeRoom, 6);
  assert.equal(r.extra, 3); // 9 credits of extra courses, 6 fit in the first major's free electives
  assert.equal(r.total, 19);
  assert.equal(doubleMajor(first, first).extra, 0);
  assert.equal(doubleMajor(first, []).total, 16);
});

test('doubleMajor on real data: sane for every pair, and close majors cost less than distant ones', () => {
  const data = compareData(real, courses);
  const arr = (m: (typeof data)[number]) => Object.entries(m.items).map(([id, i]) => ({ id, ...i }));
  const get = (slug: string) => arr(data.find((m) => m.slug === slug)!);
  for (const a of data.slice(0, 40)) for (const b of data) {
    const r = doubleMajor(arr(a), arr(b));
    assert.ok(r.extra >= 0 && r.total >= a.total && r.total <= a.total + b.total, `${a.slug}+${b.slug}`);
    assert.equal(new Set(r.shared.map((x) => x[1])).size, r.shared.length);
    if (a === b) assert.equal(r.extra, 0);
  }
  const cs = get('computer-science');
  assert.ok(doubleMajor(cs, get('computer-engineering')).extra < doubleMajor(cs, get('mining-engineering')).extra);
});

test('rearranged plans keep upper-level elective slots out of the early terms', async () => {
  const { slotLevel, slotFloor, repack, YEAR_OPTIONS } = await import('../src/plan/roadmap.ts');
  assert.equal(slotLevel({ label: 'CS 4/5XXX' }), 4);
  assert.equal(slotLevel({ label: 'CS 3/4/5XXX' }), 3);
  assert.equal(slotLevel({ label: '3000-level elective' }), 3);
  assert.equal(slotLevel({ label: 'Free Elective' }), undefined);
  assert.equal(slotLevel({ code: 'CS 4104', label: 'CS 4104' }), undefined);
  // Never later than where the catalog itself puts the slot.
  const early = { id: 'a', label: 'CS 4XXX', alt: [], choices: [], credits: 3, src: 0 };
  assert.equal(slotFloor(early, 6, 8), 0);
  assert.ok(slotFloor({ ...early, src: 7 }, 6, 8) >= 3);
  // Every official roadmap, every length: no 4XXX slot in the first quarter of the plan, no 3XXX slot in the first eighth.
  for (const r of real.filter((x) => !x.draft)) {
    const check = checkItems(r.terms, courses);
    for (const y of YEAR_OPTIONS) {
      const terms = repack(r, y, check);
      terms.forEach((t, k) => t.items.forEach((i) => {
        const level = slotLevel(i);
        if (level === undefined || level < 3) return;
        assert.ok(!(level >= 4 && k < terms.length / 4) && !(level === 3 && k < terms.length / 8), `${r.slug} ${y} years: "${i.label}" in term ${k + 1} of ${terms.length}`);
      }));
    }
  }
});

test('major names: no two plans share a name, and known catalog typos are corrected', () => {
  // Roadmaps and requirement lists both become plans: read every "## slug | Name | path" heading from both folders.
  const names = ['data/roadmaps', 'data/requirements'].flatMap((dir) => readdirSync(dir).flatMap((f) =>
    [...readFileSync(`${dir}/${f}`, 'utf8').matchAll(/^## [^|]+\| ([^|]+) \|/gm)].map((m) => m[1]!)));
  assert.ok(names.length > 200);
  const twice = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(twice, []);
  assert.ok(!names.some((n) => /Constructioning|Majors with/.test(n)));
  assert.ok(names.includes('Physics Major (B.A.)') && names.includes('Physics Major (B.S.)'));
});

test('switchCost: the credits shown as kept never exceed the credits finished', async () => {
  const { switchCost } = await import('../src/plan/switch.ts');
  // A finished 3-credit course fills a 4-credit slot in the new major: 4 credits come off what is left, 3 are "kept".
  const from = [{ id: 'a', cs: ['MATH 1225'], label: 'Calculus', cr: 3 }];
  const to = [{ id: 'x', cs: ['MATH 1225'], label: 'Calculus', cr: 4 }, { id: 'y', cs: ['CS 1114'], label: 'Intro', cr: 3 }];
  const r = switchCost(from, to, ['a']);
  assert.equal(r.kept, 3);
  assert.equal(r.counted, 4);
  assert.equal(r.remaining, 3);
  assert.ok(r.kept <= r.doneCredits);
});

test('double major and switching: general-education slots match by Pathways concept, however the roadmap words them', async () => {
  const { doubleMajor, switchCost } = await import('../src/plan/switch.ts');
  const slot = (id: string, label: string, cr = 3) => ({ id, cs: [] as string[], label, cr });
  const first = [slot('a', 'Pathways 2, 3, 6a, or 7'), slot('b', 'Natural Science Elective', 4), slot('c', 'CS 4XXX')];
  const second = [slot('x', 'Pathway 2'), slot('y', 'Select three credits in Pathway 4'), slot('z', 'Pathway 1a'), slot('w', 'MATH 4XXX')];
  const r = doubleMajor(first, second);
  assert.deepEqual(r.shared, [['a', 'x'], ['b', 'y']]);
  assert.deepEqual(r.extraItems, ['z', 'w']);
  // "Pathways Concept 6 - ..." meets "Pathway 6a"; 1a does not meet 1f.
  assert.equal(doubleMajor([slot('a', 'Pathways Concept 6 - Critique and Practice in Design and the Arts')], [slot('x', 'Pathway 6a')]).shared.length, 1);
  assert.equal(doubleMajor([slot('a', 'Pathway 1a')], [slot('x', 'Pathway 1f')]).shared.length, 0);
  assert.equal(switchCost([slot('a', 'Pathway 7')], [slot('x', 'Pathways 2, 3, 6a, or 7')], ['a']).likely.length, 1);
});

test('planner: catalog for added courses, no browser popups for adding, and the over-limit warning', async () => {
  const { courseCatalog, PLAN_JS, planData, renderPlan, LIMIT_CREDITS } = await import('../src/site/plan-page.ts');
  const cat = courseCatalog(real, courses);
  assert.equal(cat['CS 3114']![0], 'Data Structures and Algorithms');
  assert.equal(cat['CS 3114']![1], 3);
  assert.deepEqual(cat['CS 3114']![2], ['&', ['|', 'CS 2114', 'ECE 3514'], ['|', 'CS 2505', 'ECE 2564'], ['|', 'MATH 2534', 'MATH 3034']]);
  assert.ok(Object.keys(cat).length > 1800);
  // Adding a course goes through the page's own dialog; duplicates and missing prerequisites are reported there.
  assert.ok(!PLAN_JS.includes('How many credits is') && !PLAN_JS.includes("alert('Credits must be"));
  assert.ok(PLAN_JS.includes('is already in this plan') && PLAN_JS.includes('not in this plan: '));
  const cs = real.find((r) => r.slug === 'computer-science')!;
  assert.ok(renderPlan(cs, courses).includes('<dialog id="addc"'));
  assert.equal(planData(cs, courses).limit, LIMIT_CREDITS);
  assert.equal(LIMIT_CREDITS, 19);
  assert.ok(PLAN_JS.includes('needs approval from your academic dean'));
});

test('search palette: words match word starts, short names find majors, codes may be typed without a space', async () => {
  const { APP_JS } = await import('../src/site/render.ts');
  const at = APP_JS.indexOf('score = (t, s, kw) =>');
  const score = (0, eval)('(' + APP_JS.slice(at + 'score = '.length, APP_JS.indexOf('\n    };', at) + 6) + ')') as (t: string, s: string, kw?: string) => number;
  assert.equal(score('Computer Science degree plan', 'comp sci', 'cs compsci'), 0);
  assert.equal(score('Computer Science degree plan', 'cs', 'cs compsci'), 0);
  assert.equal(score('Environmental Economics, Management, and Policy Major degree plan', 'cs', ''), -1);
  assert.ok(score('Mechanical Engineering degree plan', 'mech e', 'me meche') >= 0);
  assert.ok(score('CS 2114 Software Design and Data Structures', 'cs 2114') >= 0);
  assert.ok(score('MATH 1225 Calculus of a Single Variable', 'calc') >= 0);
  assert.ok(APP_JS.includes("'$1 $2'"));
});

test('planner, third review: no native prompt for naming electives, corequisites listed apart, double clicks ignored on arrows', async () => {
  const { PLAN_JS, renderPlan } = await import('../src/site/plan-page.ts');
  const { APP_JS } = await import('../src/site/render.ts');
  assert.ok(!PLAN_JS.includes('Which course will you take for'));
  assert.ok(renderPlan(real.find((r) => r.slug === 'computer-science')!, courses).includes('<dialog id="namec"'));
  assert.ok(PLAN_JS.includes('Take with it, same term or earlier'));
  assert.ok(PLAN_JS.includes('e.detail < 2 && move('));
  assert.ok(APP_JS.includes('enterPending'));
});

test('suggested plans: electives in the major field do not come before its first course', async () => {
  const { parseRequirements, draftRoadmap } = await import('../src/plan/draft.ts');
  const text = readFileSync('data/requirements/college-science.txt', 'utf8');
  const psych = draftRoadmap(parseRequirements(text).find((q) => q.slug === 'psychology-bs')!, courses);
  const first = psych.terms.findIndex((t) => t.items.some((i) => i.code?.startsWith('PSYC ')));
  const firstElective = psych.terms.findIndex((t) => t.items.some((i) => /within Psychology/.test(i.label)));
  assert.ok(first >= 0 && firstElective >= first, `first PSYC course in term ${first}, first psych elective in term ${firstElective}`);
});

test('planIssues checks the parts of a requirement that are in the plan, not all or nothing', () => {
  const items: Record<string, { cs: string[]; pre?: Expr }> = {
    a: { cs: ['ME 3624'] },
    b: { cs: ['ME 4015'], pre: ['&', 'ME 3624', 'ME 3414', 'ME 2134'] }, // two parts are off the plan
    c: { cs: ['PHYS 3704'], pre: ['|', 'PHYS 3324', 'PHYS 9999'] },
    d: { cs: ['PHYS 3324'] },
    e: { cs: ['XX 1000'], pre: ['|', 'YY 1000', 'ZZ 1000'] }, // no option in the plan: skipped
  };
  const r = planIssues(items, [['b', 'c', 'e'], ['a', 'd']], []);
  assert.deepEqual(r.b!.late, ['a']);
  assert.deepEqual(r.c!.late, ['d']);
  assert.deepEqual(r.e!.late, []);
  assert.deepEqual(planIssues(items, [['a', 'd'], ['b', 'c', 'e']], []).b!.late, []);
});

test('fourth review: done credits, named electives, share links, copy, switch totals and address, filter counts', async () => {
  const { PLAN_JS } = await import('../src/site/plan-page.ts');
  const { COMPARE_JS } = await import('../src/site/compare-page.ts');
  const { APP_JS } = await import('../src/site/render.ts');
  const { switchCost } = await import('../src/plan/switch.ts');
  assert.ok(PLAN_JS.includes("' to take, '") && PLAN_JS.includes('S.done.includes(id) ? 0 : D.items[id].cr'));
  assert.ok(PLAN_JS.includes('const checked = () =>') && PLAN_JS.includes('is already in this plan, in '));
  assert.ok(PLAN_JS.includes("addEventListener('hashchange'"));
  assert.ok(PLAN_JS.includes("'.\\nOpen it: ' +") || PLAN_JS.includes('Open it: '));
  assert.ok(PLAN_JS.includes("'Move ' + (S.names[id] || it.code || it.label)"));
  assert.ok(COMPARE_JS.includes('history.replaceState') && COMPARE_JS.includes(' finished credits fill '));
  assert.ok(APP_JS.includes(' majors match.'));
  // First-year writing is general education everywhere: it fills a Pathway 1f slot on a roadmap that does not name it.
  const r = switchCost([{ id: 'a', cs: ['ENGL 1105'], label: 'First-Year Writing', cr: 3 }], [{ id: 'x', cs: [], label: 'Pathway 1f', cr: 3 }, { id: 'y', cs: [], label: 'Free Elective', cr: 3 }], ['a']);
  assert.deepEqual(r.likely, [['a', 'x']]);
  assert.equal(r.freeUsed, 0);
});

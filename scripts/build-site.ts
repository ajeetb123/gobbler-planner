// Run: npm run build                      (public build: degree planner only, no grade data)
//      npm run build -- --grades          (private build: adds grade pages from every CSV in data/)
//      npm run build -- --grades --top 30 (pilot: the 30 most-taken courses)
// Writes a static site to dist/. UDC has not authorized republishing its grade data, so grades are opt-in.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadUdc } from '../src/grades/udc.ts';
import { buildSite, termLabel } from '../src/site/model.ts';
import { parseNoRoadmap, parseRoadmaps } from '../src/plan/roadmap.ts';
import { draftRoadmap, parseRequirements } from '../src/plan/draft.ts';
import { parsePrereqs } from '../src/plan/prereq.ts';
import { PLAN_JS, renderNotFound, renderPlan, renderPlanAbout, renderPlanIndex } from '../src/site/plan-page.ts';
import { COMPARE_JS, renderCompare } from '../src/site/compare-page.ts';
import { buildDocs } from '../src/ask/docs.ts';
import { THEME_CSS, THEME_JS } from '../src/site/theme.ts';
import { ASK_JS, renderAsk } from '../src/site/ask-page.ts';
import { APP_JS, CSS, renderAbout, renderCourse, renderIndex, renderProf, renderSubject, setAssetVersion, slugs } from '../src/site/render.ts';

const t0 = performance.now();
const topArg = process.argv.indexOf('--top');
const top = topArg > 0 ? Number(process.argv[topArg + 1]) : undefined;
if (top !== undefined && !(top > 0)) throw new Error('--top needs a positive number');
const OUT = 'dist';

const grades = process.argv.includes('--grades');
if (top !== undefined && !grades) throw new Error('--top only applies with --grades');
const files = readdirSync('data').filter((f) => f.endsWith('.csv')).sort().map((f) => join('data', f));
if (grades && files.length === 0) throw new Error('--grades needs UDC grade CSVs in data/. They are not in this repository (see data/SOURCE.md).');
const site = grades ? buildSite(loadUdc(files), { top }) : undefined;
const tModel = performance.now();

const links = site && { course: slugs(site.courses.map((c) => c.course)), prof: slugs(site.profs.map((p) => p.key)) };
rmSync(OUT, { recursive: true, force: true });
for (const d of site ? ['course', 'prof', 'subject', 'plan'] : ['plan']) mkdirSync(join(OUT, d), { recursive: true });
const sizes: number[] = [];
const write = (path: string, html: string) => { writeFileSync(join(OUT, path), html); if (path.endsWith('.html')) sizes.push(Buffer.byteLength(html)); };

// Version the assets by content, before any page is rendered (see setAssetVersion in render.ts).
setAssetVersion(createHash('sha256').update([CSS, THEME_CSS, THEME_JS, APP_JS, PLAN_JS, COMPARE_JS, ASK_JS].join('\n')).digest('hex').slice(0, 10));
write('style.css', CSS + THEME_CSS);
write('theme.js', THEME_JS);
// The in-browser model runtime for Ask's AI answers (WebLLM, Apache-2.0), served from our own site so no script
// comes from another server. It is only fetched when a visitor turns AI answers on.
const webllm = 'node_modules/@mlc-ai/web-llm/lib/index.js';
if (existsSync(webllm)) { mkdirSync(join(OUT, 'vendor'), { recursive: true }); copyFileSync(webllm, join(OUT, 'vendor', 'web-llm.js'));
  // Apache-2.0 asks that a copy of the license travel with the library.
  copyFileSync('node_modules/@mlc-ai/web-llm/LICENSE', join(OUT, 'vendor', 'web-llm.LICENSE.txt')); }
else console.warn('web-llm is not installed (run npm ci): AI answers on the Ask page will not load.');
// Self-hosted fonts (assets/fonts, open licenses): copied as they are.
mkdirSync(join(OUT, 'fonts'), { recursive: true });
// The font licenses (SIL Open Font License) ship next to the fonts, as the license asks.
for (const f of readdirSync('assets/fonts').filter((x) => x.endsWith('.woff2') || x.endsWith('.LICENSE.txt'))) copyFileSync(join('assets/fonts', f), join(OUT, 'fonts', f));
write('app.js', APP_JS);
const roadmaps = readdirSync('data/roadmaps').filter((f) => f.endsWith('.txt')).sort()
  .flatMap((f) => parseRoadmaps(readFileSync(join('data/roadmaps', f), 'utf8')));
const courses = parsePrereqs(readFileSync('data/prereqs.txt', 'utf8'));
const official = roadmaps.length;
// Majors with requirements but no catalog roadmap get a draft plan (src/plan/draft.ts), marked as such on the page.
for (const f of readdirSync('data/requirements').filter((x) => x.endsWith('.txt')).sort())
  for (const q of parseRequirements(readFileSync(join('data/requirements', f), 'utf8'))) roadmaps.push(draftRoadmap(q, courses));
const planned = new Set(roadmaps.map((r) => r.catalogPath));
write('plan.js', PLAN_JS);
write('compare.js', COMPARE_JS);
write('ask.js', ASK_JS);
write('ask.html', renderAsk(site));
const askDocs = buildDocs(roadmaps, courses);
write('ask.json', JSON.stringify(askDocs));
const noRoadmap = parseNoRoadmap(readFileSync('data/no-roadmap.txt', 'utf8')).filter((x) => !planned.has(x.catalogPath));
write('plan/index.html', renderPlanIndex(roadmaps, site, false, noRoadmap));
write('plan/compare.html', renderCompare(roadmaps, courses, site));
for (const r of roadmaps) write(`plan/${r.slug}.html`, renderPlan(r, courses, site, links));
// [label, link, kind]: c = course, i = instructor, m = degree plan. The palette groups by kind.
const search: string[][] = [...roadmaps.map((r) => [`${r.name} degree plan`, `plan/${r.slug}.html`, 'm']), ['Switch majors: what carries over', 'plan/compare.html', 'm'], ['Ask about courses and majors', 'ask.html', 'm']];
if (site && links) {
  write('index.html', renderIndex(site, links, roadmaps.length));
  write('about.html', renderAbout(site));
  for (const c of site.courses) write(`course/${links.course.get(c.course)}.html`, renderCourse(c, site, links));
  for (const p of site.profs) write(`prof/${links.prof.get(p.key)}.html`, renderProf(p, site, links));
  for (const s of new Set(site.courses.map((c) => c.subject))) write(`subject/${s}.html`, renderSubject(s, site, links));
  search.unshift(...site.courses.map((c) => [`${c.course} ${c.title}`, `course/${links.course.get(c.course)}.html`, 'c']),
    ...site.profs.map((p) => [`${p.name} (${p.subject})`, `prof/${links.prof.get(p.key)}.html`, 'i']));
} else {
  write('index.html', renderPlanIndex(roadmaps, undefined, true, noRoadmap));
  write('about.html', renderPlanAbout());
  write('404.html', renderNotFound());
  write('robots.txt', 'User-agent: *\nDisallow: /admin\nDisallow: /api/\n');
}
write('search.json', JSON.stringify(search));

sizes.sort((a, b) => a - b);
const kb = (n: number) => (n / 1024).toFixed(1);
console.log(`Degree planner: ${official} official roadmaps, ${roadmaps.length - official} draft plans, ${noRoadmap.length} programs not planned, prerequisites for ${courses.size} courses`);
if (site) {
  const v = { barely: 0, some: 0, matters: 0, unknown: 0 };
  for (const c of site.courses) v[c.spread.verdict]++;
  console.warn('PRIVATE BUILD: dist/ now contains UDC grade data. UDC has not authorized this use. Do not publish or deploy this folder.');
  console.log(`Built ${site.courses.length} course pages and ${site.profs.length} instructor pages for ${termLabel(site.target)} (data ${termLabel(site.dataFirst)} to ${termLabel(site.dataLast)})`);
  console.log(`Covers ${(site.enrollmentShare * 100).toFixed(0)}% of undergrad enrollments. Flagged names: ${site.profs.filter((p) => p.ambiguous).length}`);
  console.log(`Instructor verdicts: matters ${v.matters}, modest ${v.some}, barely ${v.barely}, not enough history ${v.unknown}`);
  console.log(`Params: kIC=${site.params.kIC} decay=${site.params.decay} instrEffect=${site.params.useInstructorEffect} kInstr=${site.params.kInstr}`);
} else console.log('Planner-only build: no grade data included (pass --grades for the private build).');
console.log(`Page weight (HTML, uncompressed): median ${kb(sizes[Math.floor(sizes.length / 2)]!)} KB, largest ${kb(sizes[sizes.length - 1]!)} KB, shared CSS ${kb(Buffer.byteLength(CSS))} KB, total ${(sizes.reduce((a, b) => a + b, 0) / 1048576).toFixed(1)} MB`);
console.log(`Time: tune + model ${((tModel - t0) / 1000).toFixed(1)}s, render + write ${((performance.now() - tModel) / 1000).toFixed(1)}s`);

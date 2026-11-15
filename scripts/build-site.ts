// Run: npm run build            (every undergrad course)
//      npm run build -- --top 30   (pilot: the 30 most-taken courses)
// Reads every CSV in data/, writes a static site to dist/.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadUdc } from '../src/grades/udc.ts';
import { buildSite, termLabel } from '../src/site/model.ts';
import { CSS, SEARCH_JS, renderAbout, renderCourse, renderIndex, renderProf, renderSubject, slugs } from '../src/site/render.ts';

const t0 = performance.now();
const topArg = process.argv.indexOf('--top');
const top = topArg > 0 ? Number(process.argv[topArg + 1]) : undefined;
if (top !== undefined && !(top > 0)) throw new Error('--top needs a positive number');
const OUT = 'dist';

const files = readdirSync('data').filter((f) => f.endsWith('.csv')).sort().map((f) => join('data', f));
const site = buildSite(loadUdc(files), { top });
const tModel = performance.now();

const links = { course: slugs(site.courses.map((c) => c.course)), prof: slugs(site.profs.map((p) => p.key)) };
rmSync(OUT, { recursive: true, force: true });
for (const d of ['course', 'prof', 'subject']) mkdirSync(join(OUT, d), { recursive: true });
const sizes: number[] = [];
const write = (path: string, html: string) => { writeFileSync(join(OUT, path), html); if (path.endsWith('.html')) sizes.push(Buffer.byteLength(html)); };

write('style.css', CSS);
write('search.js', SEARCH_JS);
write('index.html', renderIndex(site));
write('about.html', renderAbout(site));
for (const c of site.courses) write(`course/${links.course.get(c.course)}.html`, renderCourse(c, site, links));
for (const p of site.profs) write(`prof/${links.prof.get(p.key)}.html`, renderProf(p, site, links));
for (const s of new Set(site.courses.map((c) => c.subject))) write(`subject/${s}.html`, renderSubject(s, site, links));
write('search.json', JSON.stringify([
  ...site.courses.map((c) => [`${c.course} ${c.title}`, `course/${links.course.get(c.course)}.html`]),
  ...site.profs.map((p) => [`${p.name} (${p.subject})`, `prof/${links.prof.get(p.key)}.html`]),
]));

sizes.sort((a, b) => a - b);
const kb = (n: number) => (n / 1024).toFixed(1);
const v = { barely: 0, some: 0, matters: 0, unknown: 0 };
for (const c of site.courses) v[c.spread.verdict]++;
console.log(`Built ${site.courses.length} course pages and ${site.profs.length} instructor pages for ${termLabel(site.target)} (data ${termLabel(site.dataFirst)} to ${termLabel(site.dataLast)})`);
console.log(`Covers ${(site.enrollmentShare * 100).toFixed(0)}% of undergrad enrollments. Flagged names: ${site.profs.filter((p) => p.ambiguous).length}`);
console.log(`Instructor verdicts: matters ${v.matters}, modest ${v.some}, barely ${v.barely}, not enough history ${v.unknown}`);
console.log(`Params: kIC=${site.params.kIC} decay=${site.params.decay} instrEffect=${site.params.useInstructorEffect} kInstr=${site.params.kInstr}`);
console.log(`Page weight (HTML, uncompressed): median ${kb(sizes[Math.floor(sizes.length / 2)]!)} KB, largest ${kb(sizes[sizes.length - 1]!)} KB, shared CSS ${kb(Buffer.byteLength(CSS))} KB, total ${(sizes.reduce((a, b) => a + b, 0) / 1048576).toFixed(1)} MB`);
console.log(`Time: tune + model ${((tModel - t0) / 1000).toFixed(1)}s, render + write ${((performance.now() - tModel) / 1000).toFixed(1)}s`);

// HTML for every page. Static, no framework. The only client JS is the shared search box (SEARCH_JS).
// Layout: a search bar on top, then cards. Each card has the facts on the left and a grade bar chart on the right.
import { termLabel, type CoursePage, type Dist, type Estimate, type ProfPage, type Site, type Span } from './model.ts';
import type { Verdict } from '../grades/matters.ts';

export const esc = (s: string | number) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** File-safe, unique slugs: "CS|O'Brien" and "CS|O Brien" must not share a page. */
export function slugs(keys: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const k of keys) {
    const base = k.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
    let s = base;
    // Lowercase comparison: macOS and Windows file systems are case-insensitive.
    for (let i = 2; used.has(s.toLowerCase()); i++) s = `${base}-${i}`;
    used.add(s.toLowerCase());
    out.set(k, s);
  }
  return out;
}

/** Virginia Tech's school id on RateMyProfessors (checked Nov 14, 2026). */
export const RMP_SCHOOL_ID = 1349;
/**
 * Link to a RateMyProfessors search for this last name at VT. A search, not a profile: the grade
 * data has last names only, so the reader picks the right person. We link out and never copy reviews.
 */
export const rmpUrl = (name: string) => `https://www.ratemyprofessors.com/search/professors/${RMP_SCHOOL_ID}?q=${encodeURIComponent(name)}`;
const rmpLink = (name: string, text: string) => `<a href="${esc(rmpUrl(name))}" target="_blank" rel="noopener noreferrer">${text}</a>`;

export interface Links { course: Map<string, string>; prof: Map<string, string> }

export const CSS = `:root{--bg:#f7f6f3;--card:#fff;--fg:#1c1b1a;--mut:#6b6966;--line:#e4e1db;--acc:#7a1f3d;--bar:#c8a96a;--band:#d9d5cc;--p1:#fdf0c4;--p1f:#5c4a00;--p2:#dcefdc;--p2f:#1f4d24;--p3:#e3e9f6;--p3f:#243b6b;--warn:#fff4d6;--warnb:#d9a514}
@media(prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1d1c;--fg:#eeece8;--mut:#a3a09a;--line:#34322f;--acc:#e7a3b8;--bar:#b89a5c;--band:#4a4742;--p1:#4a3f12;--p1f:#f5e3a0;--p2:#1f3a23;--p2f:#bfe5c3;--p3:#232f4a;--p3f:#c5d3f2;--warn:#3a3010;--warnb:#a08020}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}a{color:var(--acc)}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px}
.hd{max-width:900px;margin:0 auto;display:flex;gap:12px;align-items:center}.brand{font-weight:700;text-decoration:none;white-space:nowrap}
.search{position:relative;flex:1}.search input{width:100%;padding:9px 14px;font:inherit;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--fg)}
#r{position:absolute;left:0;right:0;top:100%;margin:4px 0 0;padding:0;list-style:none;background:var(--card);border:1px solid var(--line);border-radius:10px;max-height:60vh;overflow:auto;box-shadow:0 6px 20px #0002}
#r:empty{display:none}#r li{padding:8px 14px;border-top:1px solid var(--line)}#r li:first-child{border:0}#r a{text-decoration:none;display:block}
main{max-width:900px;margin:0 auto;padding:16px}h1{font-size:1.7rem;margin:.3em 0 .5em;color:var(--acc)}h2{font-size:1.1rem;margin:1.6em 0 .4em}
.crumb,.mut,footer{color:var(--mut);font-size:.85rem}footer{border-top:1px solid var(--line);margin-top:2.5em;padding-top:1em}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin:10px 0;display:flex;gap:18px;justify-content:space-between;flex-wrap:wrap}
.info{flex:1 1 320px;min-width:0}.card h3{margin:0 0 2px;font-size:1.1rem}.card h3 a{text-decoration:none}.big h3{font-size:1.4rem}
.pill{display:inline-block;border-radius:6px;padding:1px 8px;font-size:.8rem;font-weight:600;margin:6px 6px 0 0;background:var(--p1);color:var(--p1f)}.pill.g{background:var(--p2);color:var(--p2f)}.pill.b{background:var(--p3);color:var(--p3f)}
.hist{flex:0 0 230px;max-width:100%}.hist .n{text-align:center;font-size:.7rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}
.bars{display:flex;gap:5px;align-items:flex-end;height:80px}.col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;text-align:center}
.col b{display:block;background:var(--bar);border-radius:3px 3px 0 0;min-height:1px}.col i{font-style:normal;font-size:.68rem;color:var(--mut);border-top:1px solid var(--line)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center}
.tile b{display:block;font-size:1.7rem;line-height:1.2}.tile span{font-size:.7rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}a.tile{text-decoration:none;color:var(--fg)}
.note{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--acc);border-radius:8px;padding:10px 14px;margin:10px 0}.warn{background:var(--warn);border-left-color:var(--warnb)}
.track{position:relative;height:8px;background:var(--bg);border-radius:4px;margin:10px 0 2px;max-width:420px}
.band{position:absolute;top:0;height:8px;background:var(--band);border-radius:4px}.dot{position:absolute;top:-3px;width:4px;height:14px;background:var(--acc);border-radius:2px}.cm{position:absolute;top:-3px;width:1px;height:14px;background:var(--mut)}
ul.plain{list-style:none;padding:0;margin:0}ul.plain li{padding:4px 0}.cols{columns:3 180px}table{border-collapse:collapse;font-size:.85rem;margin-top:6px}td,th{padding:2px 14px 2px 0;text-align:left}
details{margin-top:6px}summary{cursor:pointer;color:var(--mut);font-size:.85rem}svg{max-width:100%;height:auto}
.hero{text-align:center;padding:6vh 0 2vh}.hero h1{font-size:2rem}`;

/**
 * Shared search: one small JSON index, fetched on the first keystroke. `data-root` makes links work from sub-folders.
 * Matches at the start of a word come first, so "chen" lists Chen before "Kitchen".
 */
export const SEARCH_JS = `(()=>{const q=document.getElementById('q'),r=document.getElementById('r'),root=document.body.dataset.root;let d;q.addEventListener('input',async()=>{d??=await(await fetch(root+'search.json')).json();const s=q.value.trim().toLowerCase().replace(/\\s+/g,' ');r.textContent='';if(s.length<2)return;let n=0;const add=(t,h)=>{const li=document.createElement('li'),a=document.createElement('a');a.href=root+h;a.textContent=t;li.append(a);r.append(li);n++};const w=x=>(' '+x.toLowerCase()).includes(' '+s);for(const[t,h]of d)if(n<40&&w(t))add(t,h);for(const[t,h]of d)if(n<40&&!w(t)&&t.toLowerCase().includes(s))add(t,h);if(!n){const li=document.createElement('li');li.textContent='No match. Try "CS 2114" or a last name.';r.append(li)}});document.addEventListener('click',e=>{if(!e.target.closest('.search'))r.textContent=''})})();`;

function layout(title: string, desc: string, root: string, crumb: string, body: string, site: Site): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="stylesheet" href="${root}style.css"></head><body data-root="${root}">
<header><div class="hd"><a class="brand" href="${root}index.html">VT Grades</a><div class="search"><input type="search" id="q" placeholder="Search courses or instructors" autocomplete="off" aria-label="Search courses and instructors"><ul id="r"></ul></div></div></header>
<main>${crumb ? `<nav class="crumb">${crumb}</nav>` : ''}
${body}
<footer>Source: Virginia Tech University DataCommons grade distributions, ${termLabel(site.dataFirst)} to ${termLabel(site.dataLast)}. The source lists instructors by last name only and hides sections with fewer than 5 graded students. Expected GPA is for one section's average, not for an individual student. Not affiliated with Virginia Tech or RateMyProfessors. <a href="${root}about.html">How the numbers are made</a>.</footer>
</main><script src="${root}search.js" defer></script></body></html>`;
}

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const span = (s: Span) => (s.terms === 1 ? `1 term, ${termLabel(s.firstTerm)}` : `${s.terms} terms from ${termLabel(s.firstTerm)} to ${termLabel(s.lastTerm)}`);

/** Grade bar chart: W, F, D, C, B, A, heights relative to the tallest bar. */
function hist(d: Dist): string {
  const max = Math.max(1, ...d.bars.map((b) => b.n));
  const label = d.bars.map((b) => `${b.label} ${Math.round(b.n)}`).join(', ');
  return `<div class="hist" role="img" aria-label="Grades: ${label}"><div class="n">${num(d.students)} students</div><div class="bars">${d.bars
    .map((b) => `<div class="col" title="${b.label}: ${num(b.n)}"><b style="height:${Math.round((b.n / max) * 62)}px"></b><i>${b.label}</i></div>`).join('')}</div></div>`;
}
const topPill = (d: Dist) => `<span class="pill g">Most common: ${d.top.label} (${d.top.pct.toFixed(1)}%)</span>`;
const estPill = (e: Estimate) => `<span class="pill b">Expected next section: ${e.gpa.toFixed(2)} (${e.lo.toFixed(2)} to ${e.hi.toFixed(2)})</span>`;

// GPA axis for range bars. Almost every section GPA in the data sits between 1.5 and 4.0.
const AX_LO = 1.5, AX_HI = 4;
const pos = (g: number) => (Math.min(1, Math.max(0, (g - AX_LO) / (AX_HI - AX_LO))) * 100).toFixed(1);
function bar(e: Estimate, courseMean: number): string {
  const l = Number(pos(e.lo)), r = Number(pos(e.hi));
  return `<div class="track" role="img" aria-label="Expected ${e.gpa.toFixed(2)}, 80% range ${e.lo.toFixed(2)} to ${e.hi.toFixed(2)}"><span class="band" style="left:${l}%;width:${(r - l).toFixed(1)}%"></span><span class="cm" style="left:${pos(courseMean)}%"></span><span class="dot" style="left:calc(${pos(e.gpa)}% - 2px)"></span></div>`;
}

function sparkline(trend: CoursePage['trend']): string {
  if (trend.length < 2) return '';
  const W = 720, H = 110, P = 24;
  const lo = Math.min(...trend.map((t) => t.gpa)) - 0.1, hi = Math.max(...trend.map((t) => t.gpa)) + 0.1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (trend.length - 1);
  const y = (g: number) => H - P - ((g - lo) / (hi - lo)) * (H - 2 * P - 8);
  const pts = trend.map((t, i) => `${x(i).toFixed(0)},${y(t.gpa).toFixed(0)}`).join(' ');
  const labels = trend.map((t, i) =>
    `<text x="${x(i).toFixed(0)}" y="${(y(t.gpa) - 7).toFixed(0)}" text-anchor="middle" font-size="11" fill="currentColor">${t.gpa.toFixed(2)}</text>` +
    (i === 0 || i === trend.length - 1 ? `<text x="${x(i).toFixed(0)}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : 'end'}" font-size="11" fill="currentColor" opacity=".6">${termLabel(t.term)}</text>` : '')).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Course average GPA by term"><polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2"/>${labels}</svg>`;
}

const VERDICT: Record<Verdict, (c: CoursePage) => string> = {
  barely: (c) => `<b>Instructor choice barely matters for grades here.</b> The ${c.spread.n} recent instructors with enough history all land between ${c.spread.lo.toFixed(2)} and ${c.spread.hi.toFixed(2)}. That gap is smaller than the normal swing from one section to the next.`,
  some: (c) => `<b>Instructor choice makes a modest difference here.</b> Recent instructors with enough history span ${c.spread.lo.toFixed(2)} to ${c.spread.hi.toFixed(2)}, and the ranges overlap a lot.`,
  matters: (c) => `<b>Instructor choice matters for grades here.</b> Recent instructors with enough history span ${c.spread.lo.toFixed(2)} to ${c.spread.hi.toFixed(2)}, a gap of ${c.spread.spread.toFixed(2)} GPA points.`,
  unknown: () => `<b>Not enough history to compare instructors.</b> Fewer than two recent instructors have 30 or more past students in this course.`,
};
const VERDICT_TILE: Record<Verdict, string> = { barely: 'Barely', some: 'Somewhat', matters: 'Yes', unknown: 'Unclear' };

export function renderCourse(c: CoursePage, site: Site, links: Links): string {
  const next = termLabel(site.target);
  const prof = (key: string, name: string) => `<a href="../prof/${links.prof.get(key)}.html">${esc(name)}</a>`;
  const cards = c.instructors.map((i) => `<div class="card"><div class="info"><h3>${prof(i.key, i.name)}${i.ambiguous ? ` <span title="${esc(i.reason)}">⚠</span>` : ''}</h3>
<div class="mut">${span(i)}</div>
<span class="pill">GPA: ${i.dist.gpa.toFixed(2)}</span>${topPill(i.dist)}${estPill(i)}${bar(i, c.mean)}
<div class="mut">${i.students === 0 ? 'No usable history for an estimate. Showing the course average with a wider range.' : `Estimate from ${plural(i.sections, 'section')}.`}${i.ambiguous ? ` This last name may cover more than one person (${esc(i.reason)}).` : ''} ${rmpLink(i.name, 'Reviews on RateMyProfessors')}</div></div>${hist(i.dist)}</div>`).join('\n');
  const body = `<h1>${esc(c.course)}: ${esc(c.title)}</h1>
<div class="card big"><div class="info"><h3>All Instructors</h3><span class="pill">GPA: ${c.dist.gpa.toFixed(2)}</span>${topPill(c.dist)}
<p class="mut">Grades given over the last ${Math.min(4, c.trend.length)} offered terms. ${num(c.students)} graded students from ${termLabel(c.firstTerm)} to ${termLabel(c.lastTerm)}.</p></div>${hist(c.dist)}</div>
<div class="tiles"><div class="tile"><b>${c.mean.toFixed(2)}</b><span>Course average, recent terms weighted</span></div><div class="tile"><b>${c.typicalSize}</b><span>Typical section size</span></div><div class="tile"><b>${(c.withdrawRate * 100).toFixed(1)}%</b><span>Withdraw rate</span></div><div class="tile"><b>${VERDICT_TILE[c.spread.verdict]}</b><span>Does the instructor matter?</span></div></div>
<div class="note">${VERDICT[c.spread.verdict](c)}</div>
<h2>Course average by term</h2><div class="card"><div class="info">${sparkline(c.trend)}</div></div>
<h2>By instructor, for ${next}</h2>
<p class="mut">Listed by name, not ranked. GPA and bars = grades given in this course. Expected next section = estimate with its 80% range (4 in 5 past sections landed inside ranges built this way). On the line: grey band = range, thin mark = course average.</p>
${cards || `<p>No instructor has taught this course in the two years before ${next}.</p>`}
<div class="card"><div class="info"><h3>Someone new to this course, or not listed</h3>${estPill(c.unknown)}${bar(c.unknown, c.mean)}<div class="mut">Nothing predicts a first-time pairing better than the course average, so that is what this shows, with a wider range.</div></div></div>
<div class="note">Which instructor has your section? Check your own registration in HokieSPA. This site does not have next term's assignments.</div>
${c.earlier.length ? `<details><summary>Taught this before ${termLabel(site.target - 4)} (${c.earlier.length})</summary><ul class="plain cols">${c.earlier.map((e) => `<li>${prof(e.key, e.name)} <span class="mut">${termLabel(e.lastTerm)}</span></li>`).join('')}</ul></details>` : ''}`;
  return layout(`${c.course} grades by instructor · Virginia Tech`, `${c.course} ${c.title}: grades given and expected section GPA by instructor, from official VT grade data.`, '../',
    `<a href="../subject/${esc(c.subject)}.html">${esc(c.subject)}</a> / ${esc(c.course)}`, body, site);
}

export function renderProf(p: ProfPage, site: Site, links: Links): string {
  const students = p.panels.reduce((a, x) => a + x.dist.students, 0);
  const top = p.ambiguous || !p.dist
    ? `<div class="note warn"><b>This last name may cover more than one person</b> (${esc(p.reason)}). The grade data has last names only, so each course below is shown on its own and nothing is added up across courses. Confirm the full name in HokieSPA.</div>`
    : `<div class="card big"><div class="info"><h3>All Courses</h3><span class="pill">GPA: ${p.dist.gpa.toFixed(2)}</span>${topPill(p.dist)}
<p class="mut">This total includes courses they may not teach anymore.${p.effect !== undefined ? ` Sections under this name ran about ${Math.abs(p.effect).toFixed(2)} GPA ${p.effect >= 0 ? 'above' : 'below'} the course averages; gaps near 0.05 are noise.` : ''}</p></div>${hist(p.dist)}</div>`;
  const cards = p.panels.map((x) => `<div class="card"><div class="info"><h3><a href="../course/${links.course.get(x.course)}.html">${esc(x.course)}: ${esc(x.title)}</a></h3>
<div class="mut">${span(x)}</div>
<span class="pill">GPA: ${x.dist.gpa.toFixed(2)}</span>${topPill(x.dist)}${estPill(x)}${bar(x, x.courseMean)}
<div class="mut">Course average ${x.courseMean.toFixed(2)} (thin mark).</div>
<details><summary>Term by term</summary><table><tr><th>Term</th><th>Section GPA</th><th>Students</th></tr>${x.history.map((h) => `<tr><td>${termLabel(h.term)}</td><td>${h.gpa.toFixed(2)}</td><td>${h.students}</td></tr>`).join('')}</table></details></div>${hist(x.dist)}</div>`).join('\n');
  const body = `<h1>${esc(p.name)}</h1>${top}
<div class="tiles"><div class="tile"><b>${p.panels.length}</b><span>${p.panels.length === 1 ? 'Course' : 'Courses'}</span></div><div class="tile"><b>${num(students)}</b><span>Students graded</span></div>${rmpLink(p.name, '').replace('></a>', ` class="tile"><b>Reviews ↗</b><span>RateMyProfessors search</span></a>`)}</div>
<p class="mut">Grades say nothing about teaching. The RateMyProfessors search can return several people with this last name: match the department and first name.</p>
${cards}`;
  return layout(`${p.name} (${p.subject}) grades · Virginia Tech`, `Grades given by ${p.name} in ${p.subject} at Virginia Tech, by course, from official grade data.`, '../',
    `<a href="../subject/${esc(p.subject)}.html">${esc(p.subject)}</a> / ${esc(p.name)}`, body, site);
}

export function renderSubject(subject: string, site: Site, links: Links): string {
  const cs = site.courses.filter((c) => c.subject === subject);
  const ps = site.profs.filter((p) => p.subject === subject).sort((a, b) => a.name.localeCompare(b.name));
  return layout(`${subject} courses and instructors · Virginia Tech grades`, `Grades for ${subject} courses at Virginia Tech.`, '../', esc(subject),
    `<h1>${esc(subject)}</h1><h2>Courses (${cs.length})</h2>${cs.map((c) => `<div class="card"><div class="info"><h3><a href="../course/${links.course.get(c.course)}.html">${esc(c.course)}: ${esc(c.title)}</a></h3><span class="pill">GPA: ${c.dist.gpa.toFixed(2)}</span>${topPill(c.dist)}</div></div>`).join('')}
<h2>Instructors (${ps.length})</h2><ul class="plain cols">${ps.map((p) => `<li><a href="../prof/${links.prof.get(p.key)}.html">${esc(p.name)}</a>${p.ambiguous ? ' ⚠' : ''}</li>`).join('')}</ul>`, site);
}

export function renderIndex(site: Site): string {
  const subjects = [...new Set(site.courses.map((c) => c.subject))].sort();
  return layout('VT Grades: Virginia Tech grades by course and instructor', 'Grades given and expected section GPA for Virginia Tech courses by instructor, from official grade data.', '', '',
    `<div class="hero"><h1>What grades does this course give, and does the instructor change that?</h1>
<p class="mut">Official Virginia Tech grade data, ${termLabel(site.dataFirst)} to ${termLabel(site.dataLast)}. Search above for a course like "CS 2114" or a last name.</p></div>
<div class="tiles"><div class="tile"><b>${num(site.courses.length)}</b><span>Courses</span></div><div class="tile"><b>${num(site.profs.length)}</b><span>Instructor names</span></div><div class="tile"><b>${subjects.length}</b><span>Subjects</span></div></div>
<h2>Browse by subject</h2><div class="card"><ul class="plain cols info">${subjects.map((s) => `<li><a href="subject/${esc(s)}.html">${esc(s)}</a></li>`).join('')}</ul></div>`, site);
}

export function renderAbout(site: Site): string {
  const p = site.params;
  return layout('How the numbers are made · VT Grades', 'Method and backtest behind the Virginia Tech grade estimates.', '', 'About',
    `<h1>How the numbers are made</h1>
<h2>GPA and the bar charts</h2><p>Plain facts: the grades that were given, added up over the terms named on the card. W is withdrawals.</p>
<h2>Expected next section</h2><p>An estimate of the average GPA of one section next term (${termLabel(site.target)}) under a given instructor name. It is not a prediction of your grade. It differs from the plain GPA in four ways:</p>
<ul><li>Small samples are pulled toward the course average (prior worth ${p.kIC} students).</li><li>Each term back counts ${p.decay} times the one after it, so recent terms weigh more.</li><li>An instructor's record in other courses is used only when the last name is not flagged as possibly several people.</li><li>Ranges come from how far past estimates missed, grouped by amount of history and section size.</li></ul>
<h2>How it was checked</h2><p>Each term from Fall 2022 to Spring 2024 was predicted using only earlier terms: 15,122 undergraduate sections, 579,589 graded students. Average error was 0.185 GPA points against 0.193 for the plain instructor average (3.7% lower, 95% interval 2.8% to 4.6%). The 80% ranges contained the real result 79.7% of the time. For first-time instructor and course pairings nothing beat the course average, and the page says so.</p>
<h2>Limits</h2><ul><li>Grades are not teaching quality. This says nothing about clarity, fairness or workload. Each instructor links to a RateMyProfessors search for that.</li><li>Last names only: a flagged name may be more than one person.</li><li>Sections with fewer than 5 graded students are missing from the source.</li><li>Next term's instructor assignments are not on this site.</li></ul>`, site);
}

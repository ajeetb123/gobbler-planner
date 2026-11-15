// HTML for every page. Static, no framework, no client JS except the search box on the home page.
import { termLabel, type CoursePage, type Estimate, type ProfPage, type Site } from './model.ts';
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

export const CSS = `:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#e3e3e3;--card:#f6f6f4;--acc:#861f41;--bar:#c9c9c9;--warn:#fff4d6;--warnb:#e0b020}
@media(prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--mut:#a0a0a0;--line:#333;--card:#1e1e1e;--acc:#e5a0b5;--bar:#555;--warn:#3a3010;--warnb:#a08020}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}a{color:var(--acc)}h1{font-size:1.5rem;margin:.4em 0}h2{font-size:1.1rem;margin:1.6em 0 .5em}
.crumb,.mut,footer{color:var(--mut);font-size:.875rem}footer{border-top:1px solid var(--line);margin-top:2.5em;padding-top:1em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.stat{background:var(--card);border-radius:8px;padding:10px 12px}
.stat b{display:block;font-size:1.4rem}.note{background:var(--card);border-left:4px solid var(--acc);border-radius:4px;padding:10px 12px;margin:12px 0}
.warn{background:var(--warn);border-left-color:var(--warnb)}
.row{border-top:1px solid var(--line);padding:10px 0}.row .top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.track{position:relative;height:10px;background:var(--card);border-radius:5px;margin:6px 0 2px}
.band{position:absolute;top:0;height:10px;background:var(--bar);border-radius:5px}.dot{position:absolute;top:-2px;width:4px;height:14px;background:var(--acc);border-radius:2px}
.cm{position:absolute;top:-3px;width:1px;height:16px;background:var(--mut)}
.dist{display:flex;height:26px;border-radius:6px;overflow:hidden;font-size:.75rem;color:#fff}.dist span{display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap}
.gA{background:#2b6a4d}.gB{background:#3f7fa6}.gC{background:#8a7a2e}.gD{background:#a8622a}.gF{background:#8c3030}
input[type=search]{width:100%;padding:10px 12px;font:inherit;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
ul.plain{list-style:none;padding:0;margin:0}ul.plain li{padding:4px 0}.cols{columns:3 180px}table{border-collapse:collapse;font-size:.9rem}td,th{padding:2px 12px 2px 0;text-align:left}
svg{max-width:100%;height:auto}`;

function layout(title: string, desc: string, root: string, crumb: string, body: string, site: Site): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="stylesheet" href="${root}style.css"></head><body><main>
<nav class="crumb"><a href="${root}index.html">VT grade estimates</a>${crumb}</nav>
${body}
<footer>Source: Virginia Tech University DataCommons grade distributions, ${termLabel(site.dataFirst)} to ${termLabel(site.dataLast)}. The source lists instructors by last name only and hides sections with fewer than 5 graded students. Estimates are for one section's average GPA, not for an individual student. Not affiliated with Virginia Tech or RateMyProfessors. <a href="${root}about.html">How the numbers are made</a>.</footer>
</main></body></html>`;
}

// GPA axis for range bars. Almost every section GPA in the data sits between 1.5 and 4.0.
const AX_LO = 1.5, AX_HI = 4;
const pos = (g: number) => (Math.min(1, Math.max(0, (g - AX_LO) / (AX_HI - AX_LO))) * 100).toFixed(1);

function bar(e: Estimate, courseMean: number): string {
  const l = Number(pos(e.lo)), r = Number(pos(e.hi));
  return `<div class="track" role="img" aria-label="Expected ${e.gpa.toFixed(2)}, 80% range ${e.lo.toFixed(2)} to ${e.hi.toFixed(2)}"><span class="band" style="left:${l}%;width:${(r - l).toFixed(1)}%"></span><span class="cm" style="left:${pos(courseMean)}%"></span><span class="dot" style="left:calc(${pos(e.gpa)}% - 2px)"></span></div>`;
}
const est = (e: Estimate) => `<b>${e.gpa.toFixed(2)}</b> <span class="mut">(${e.lo.toFixed(2)} to ${e.hi.toFixed(2)})</span>`;

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

export function renderCourse(c: CoursePage, site: Site, links: Links): string {
  const next = termLabel(site.target);
  const prof = (key: string, name: string) => `<a href="../prof/${links.prof.get(key)}.html">${esc(name)}</a>`;
  const rows = c.instructors.map((i) => `<div class="row"><div class="top"><span>${prof(i.key, i.name)}${i.ambiguous ? ` <span title="${esc(i.reason)}">⚠</span>` : ''}</span><span>${est(i)}</span></div>${bar(i, c.mean)}
<div class="mut">${i.students === 0 ? 'No graded history in this course in the training data. Showing the course average with a wider range.' : `From ${i.students.toLocaleString('en-US')} students in ${i.sections} section${i.sections === 1 ? '' : 's'}. Last taught ${termLabel(i.lastTerm)}.`}${i.ambiguous ? ` This last name may cover more than one person (${esc(i.reason)}).` : ''} ${rmpLink(i.name, 'Reviews on RateMyProfessors')}</div></div>`).join('\n');
  const body = `<h1>${esc(c.course)} · ${esc(c.title)}</h1>
<div class="stats"><div class="stat"><b>${c.mean.toFixed(2)}</b>course average GPA, recent terms weighted more</div><div class="stat"><b>${c.typicalSize}</b>students in a typical section</div><div class="stat"><b>${(c.withdrawRate * 100).toFixed(1)}%</b>withdraw rate, last ${Math.min(4, c.trend.length)} offered terms</div><div class="stat"><b>${c.students.toLocaleString('en-US')}</b>graded students, ${termLabel(c.firstTerm)} to ${termLabel(c.lastTerm)}</div></div>
<div class="note">${VERDICT[c.spread.verdict](c)}</div>
<h2>Grades given, last ${Math.min(4, c.trend.length)} offered terms</h2>
<div class="dist">${c.dist.filter((d) => d.pct >= 0.5).map((d) => `<span class="g${d.label}" style="width:${d.pct.toFixed(1)}%" title="${d.label}: ${d.pct.toFixed(1)}%">${d.pct >= 6 ? `${d.label} ${d.pct.toFixed(0)}%` : ''}</span>`).join('')}</div>
<h2>Course average by term</h2>${sparkline(c.trend)}
<h2>Expected section GPA for ${next}, if your section is taught by</h2>
<p class="mut">Number = expected section average. Parentheses and grey band = 80% range (4 in 5 past sections landed inside ranges built this way). Thin line = course average. Listed by name, not ranked.</p>
${rows || `<p>No instructor has taught this course in the two years before ${next}.</p>`}
<div class="row"><div class="top"><span>Someone new to this course, or not listed</span><span>${est(c.unknown)}</span></div>${bar(c.unknown, c.mean)}<div class="mut">Nothing predicts a first-time pairing better than the course average, so that is what this shows, with a wider range.</div></div>
<div class="note">Which instructor has your section? Check your own registration in HokieSPA. This site does not have next term's assignments.</div>
${c.earlier.length ? `<details><summary>Taught this before ${termLabel(site.target - 4)} (${c.earlier.length})</summary><ul class="plain cols">${c.earlier.map((e) => `<li>${prof(e.key, e.name)} <span class="mut">${termLabel(e.lastTerm)}</span></li>`).join('')}</ul></details>` : ''}`;
  return layout(`${c.course} grades by instructor · Virginia Tech`, `${c.course} ${c.title}: expected section GPA by instructor with honest ranges, from official VT grade data.`, '../',
    ` / <a href="../subject/${esc(c.subject)}.html">${esc(c.subject)}</a> / ${esc(c.course)}`, body, site);
}

export function renderProf(p: ProfPage, site: Site, links: Links): string {
  const next = termLabel(site.target);
  const head = p.ambiguous
    ? `<div class="note warn"><b>This last name may cover more than one person</b> (${esc(p.reason)}). The grade data has last names only, so each course below is shown on its own and nothing is averaged across courses. Confirm the full name in HokieSPA.</div>`
    : p.effect !== undefined
      ? `<div class="note">Across ${p.panels.length} courses, sections under this name ran about <b>${Math.abs(p.effect).toFixed(2)} GPA ${p.effect >= 0 ? 'above' : 'below'}</b> the course averages. Small gaps like 0.05 are noise.</div>`
      : '';
  const panels = p.panels.map((x) => `<div class="row"><div class="top"><span><a href="../course/${links.course.get(x.course)}.html">${esc(x.course)}</a> ${esc(x.title)}</span><span>${est(x)}</span></div>${bar(x, x.courseMean)}
<div class="mut">Expected section GPA for ${next}. Course average ${x.courseMean.toFixed(2)}. ${x.students === 0 ? 'No usable history in the training data.' : `From ${x.students.toLocaleString('en-US')} students in ${x.sections} section${x.sections === 1 ? '' : 's'}.`}</div>
<table><tr><th>Term</th><th>Section GPA</th><th>Students</th></tr>${x.history.map((h) => `<tr><td>${termLabel(h.term)}</td><td>${h.gpa.toFixed(2)}</td><td>${h.students}</td></tr>`).join('')}</table></div>`).join('\n');
  return layout(`${p.name} (${p.subject}) grade history · Virginia Tech`, `Grade history for ${p.name} in ${p.subject} at Virginia Tech, by course, from official grade data.`, '../',
    ` / <a href="../subject/${esc(p.subject)}.html">${esc(p.subject)}</a> / ${esc(p.name)}`,
    `<h1>${esc(p.name)} · ${esc(p.subject)}</h1>${head}
<div class="note">Grades say nothing about teaching. ${rmpLink(p.name, `Read student reviews for "${esc(p.name)}" on RateMyProfessors`)}. The search can return several people with this last name: match the department and first name.</div>
<h2>By course</h2>${panels}`, site);
}

export function renderSubject(subject: string, site: Site, links: Links): string {
  const cs = site.courses.filter((c) => c.subject === subject);
  const ps = site.profs.filter((p) => p.subject === subject).sort((a, b) => a.name.localeCompare(b.name));
  return layout(`${subject} courses and instructors · Virginia Tech grades`, `Grade estimates for ${subject} courses at Virginia Tech.`, '../', ` / ${esc(subject)}`,
    `<h1>${esc(subject)}</h1><h2>Courses (${cs.length})</h2><ul class="plain">${cs.map((c) => `<li><a href="../course/${links.course.get(c.course)}.html">${esc(c.course)}</a> ${esc(c.title)} <span class="mut">${c.mean.toFixed(2)}</span></li>`).join('')}</ul>
<h2>Instructors (${ps.length})</h2><ul class="plain cols">${ps.map((p) => `<li><a href="../prof/${links.prof.get(p.key)}.html">${esc(p.name)}</a>${p.ambiguous ? ' ⚠' : ''}</li>`).join('')}</ul>`, site);
}

export function renderIndex(site: Site): string {
  const subjects = [...new Set(site.courses.map((c) => c.subject))].sort();
  // Search runs on the client over one small JSON file, fetched on first keystroke.
  const js = `let d;const q=document.getElementById('q'),r=document.getElementById('r');q.addEventListener('input',async()=>{d??=await (await fetch('search.json')).json();const s=q.value.trim().toLowerCase().replace(/\\s+/g,' ');r.textContent='';if(s.length<2)return;let n=0;for(const[t,h]of d){if(!t.toLowerCase().includes(s))continue;const li=document.createElement('li'),a=document.createElement('a');a.href=h;a.textContent=t;li.append(a);r.append(li);if(++n>=40)break}if(!n)r.textContent='No match. Try a course like "CS 2114" or a last name.'});`;
  return layout('Virginia Tech grade estimates by course and instructor', 'Expected section GPA for Virginia Tech courses by instructor, with honest ranges, from official grade data.', '', '',
    `<h1>What grades does this course give, and does the instructor change that?</h1>
<p>Official Virginia Tech grade data, ${termLabel(site.dataFirst)} to ${termLabel(site.dataLast)}. Every number comes with a range, small samples are not taken at face value, and the page tells you when the instructor makes no real difference.</p>
<input type="search" id="q" placeholder="Search a course (CS 2114) or a last name" autocomplete="off" aria-label="Search courses and instructors"><ul class="plain" id="r"></ul>
<h2>Subjects (${subjects.length})</h2><ul class="plain cols">${subjects.map((s) => `<li><a href="subject/${esc(s)}.html">${esc(s)}</a></li>`).join('')}</ul><script>${js}</script>`, site);
}

export function renderAbout(site: Site): string {
  const p = site.params;
  return layout('How the numbers are made · VT grade estimates', 'Method and backtest behind the Virginia Tech grade estimates.', '', ' / About',
    `<h1>How the numbers are made</h1>
<h2>What a number means</h2><p>The expected average GPA of one section of a course next term (${termLabel(site.target)}) under a given instructor name. It is not a prediction of your grade.</p>
<h2>How it differs from a plain average</h2><ul><li>Small samples are pulled toward the course average (prior worth ${p.kIC} students).</li><li>Each term back counts ${p.decay} times the one after it, so recent terms weigh more.</li><li>An instructor's record in other courses is used only when the last name is not flagged as possibly several people.</li><li>Ranges come from how far past estimates missed, grouped by amount of history and section size.</li></ul>
<h2>How it was checked</h2><p>Each term from Fall 2022 to Spring 2024 was predicted using only earlier terms: 15,122 undergraduate sections, 579,589 graded students. Average error was 0.185 GPA points against 0.193 for the plain instructor average that other grade sites show (3.7% lower, 95% interval 2.8% to 4.6%). The 80% ranges contained the real result 79.7% of the time. For first-time instructor and course pairings nothing beat the course average, and the page says so.</p>
<h2>Limits</h2><ul><li>Grades are not teaching quality. This says nothing about clarity, fairness or workload. Each instructor links to a RateMyProfessors search for that.</li><li>Last names only: a flagged name may be more than one person.</li><li>Sections with fewer than 5 graded students are missing from the source.</li><li>Next term's instructor assignments are not on this site.</li></ul>`, site);
}

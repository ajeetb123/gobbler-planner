// Degree planner pages. The page ships the roadmap as JSON; PLAN_JS draws the board and keeps
// the student's changes in their own browser (localStorage). Nothing is sent anywhere.
import { credits, repack, YEAR_OPTIONS, type Roadmap } from '../plan/roadmap.ts';
import { esc, layout, type Links } from './render.ts';
import type { Site } from './model.ts';

/** A term above this many credits gets a "heavy load" flag. */
export const HEAVY_CREDITS = 18;
/** Three or more unfinished courses under this course average in one term get a flag. */
export const LOW_GPA = 2.8;

export interface PlanData {
  slug: string;
  total: number;
  heavy: number;
  low: number;
  /** g = course average GPA, v = instructor-matters verdict, h = link to the course page. */
  items: Record<string, { code?: string; label: string; cr: number; alt: string[]; ch: string[]; g?: number; v?: string; h?: string }>;
  plans: Record<string, Array<{ label: string; ids: string[] }>>;
}

export function planData(r: Roadmap, site: Site, links: Links): PlanData {
  const byCourse = new Map(site.courses.map((c) => [c.course, c]));
  const items: PlanData['items'] = {};
  for (const i of r.terms.flatMap((t) => t.items)) {
    const c = i.code ? byCourse.get(i.code) : undefined;
    items[i.id] = {
      code: i.code, label: i.code ? (c?.title ?? i.label.replace(i.code, '').trim()) : i.label, cr: i.credits, alt: i.alt, ch: i.choices,
      g: c ? Math.round(c.mean * 100) / 100 : undefined, v: c?.spread.verdict, h: c ? `course/${links.course.get(c.course)}.html` : undefined,
    };
  }
  const plans: PlanData['plans'] = {};
  for (const y of YEAR_OPTIONS) plans[String(y)] = repack(r, y).map((t) => ({ label: t.label, ids: t.items.map((i) => i.id) }));
  return { slug: r.slug, total: credits(r.terms.flatMap((t) => t.items)), heavy: HEAVY_CREDITS, low: LOW_GPA, items, plans };
}

export const PLAN_JS = `(()=>{const D=JSON.parse(document.getElementById('plan-data').textContent),root=document.body.dataset.root,KEY='vtplan:'+D.slug;
let S;try{S=JSON.parse(localStorage.getItem(KEY))||{}}catch{S={}}
S.years=D.plans[S.years]?S.years:'4';S.pos=S.pos||{};S.done=S.done||[];
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const $=id=>document.getElementById(id),board=$('board'),yearsEl=$('years');
function terms(){const plan=D.plans[S.years],pos=S.pos[S.years]||{},out=plan.map(t=>({label:t.label,ids:[]}));plan.forEach((t,ti)=>t.ids.forEach(id=>{const p=pos[id];out[p!=null&&p<out.length?p:ti].ids.push(id)}));return out}
function move(id,from,d){const to=from+d;if(to<0||to>=D.plans[S.years].length)return;(S.pos[S.years]=S.pos[S.years]||{})[id]=to;save();draw()}
function draw(){board.textContent='';const ts=terms();let doneCr=0;
ts.forEach((t,ti)=>{const card=el('section','term'),list=el('ul','plain');let cr=0,gs=0,gw=0,low=0;
t.ids.forEach(id=>{const it=D.items[id],done=S.done.includes(id);cr+=it.cr;if(done)doneCr+=it.cr;if(it.g!=null){gs+=it.g*it.cr;gw+=it.cr;if(it.g<D.low&&!done)low++}
const li=el('li','it'+(done?' done':'')),cb=el('input');cb.type='checkbox';cb.checked=done;cb.setAttribute('aria-label','Done: '+(it.code||it.label));
cb.onchange=()=>{S.done=cb.checked?[...S.done,id]:S.done.filter(x=>x!==id);save();draw()};
const mid=el('div','mid'),nm=el('div','nm');if(it.h){const a=el('a',null,it.code);a.href=root+it.h;nm.append(a,' '+it.label)}else nm.textContent=(it.code?it.code+' ':'')+it.label;
mid.append(nm,el('div','mut',it.cr+' cr'+(it.alt.length?' · or '+it.alt.join(', '):'')+(it.ch.length?' · choose one: '+it.ch.join(', '):'')));
if(it.g!=null)mid.append(el('span','pill','Avg GPA '+it.g.toFixed(2)));if(it.v==='matters')mid.append(el('span','pill b','Instructor matters'));
const mv=el('div','mv'),l=el('button',null,'\\u2190'),r=el('button',null,'\\u2192');l.setAttribute('aria-label','Move to the term before');r.setAttribute('aria-label','Move to the term after');l.title='Earlier';r.title='Later';
l.disabled=ti===0;r.disabled=ti===ts.length-1;l.onclick=()=>move(id,ti,-1);r.onclick=()=>move(id,ti,1);mv.append(l,r);li.append(cb,mid,mv);list.append(li)});
card.append(el('h3',null,t.label),el('div','mut',cr+' credits'+(gw?' · typical GPA '+(gs/gw).toFixed(2):'')));
if(cr>D.heavy)card.append(el('div','flag','Heavy load: '+cr+' credits'));
if(low>=3)card.append(el('div','flag',low+' courses here average below '+D.low.toFixed(1)));
if(!t.ids.length)card.append(el('div','mut','Nothing planned here.'));card.append(list);board.append(card)});
$('prog').textContent=doneCr+' of '+D.total+' credits done';$('bar').style.width=Math.min(100,doneCr/D.total*100)+'%';
[...yearsEl.children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.y===S.years)));$('note').hidden=S.years==='4';$('summer').hidden=!(+S.years<4)}
yearsEl.addEventListener('click',e=>{const y=e.target.dataset.y;if(y){S.years=y;save();draw()}});
$('reset').onclick=()=>{if(confirm('Clear your moves and checkmarks for this major?')){S={years:S.years,pos:{},done:[]};save();draw()}};draw()})();`;

const CATALOG = 'https://catalog.vt.edu/undergraduate/';

export function renderPlan(r: Roadmap, site: Site, links: Links): string {
  // "</" inside JSON would end the script tag early.
  const json = JSON.stringify(planData(r, site, links)).replace(/</g, '\\u003c');
  const body = `<h1>${esc(r.name)} degree plan</h1>
<p class="mut">Starts from the official roadmap in the 2026-2027 VT catalog (${r.total} credits). <a href="${CATALOG}${esc(r.catalogPath)}#roadmaptext" target="_blank" rel="noopener noreferrer">See it on catalog.vt.edu</a>. Your changes are saved in this browser only.</p>
<div class="card"><div class="info"><b>How many years do you want to take?</b><div class="ctl"><div class="seg" id="years" role="group" aria-label="Years to graduate">${YEAR_OPTIONS.map((y) => `<button type="button" data-y="${y}" aria-pressed="${y === 4}">${y} years</button>`).join('')}</div></div>
<div class="ctl"><div class="prog"><span id="prog" class="mut"></span><div class="meter"><i id="bar"></i></div></div><button type="button" class="btn" id="reset">Start over</button></div></div></div>
<div class="note warn" id="note" hidden><b>This layout is a rearrangement, not an official plan.</b> It spreads the 4-year roadmap over the length you chose and keeps course sequences in order, but it does not check prerequisites or which term a course is offered. Take it to your advisor before you rely on it.</div>
<div class="note" id="summer" hidden>Finishing in under 4 years uses summer terms. AP, IB or transfer credit can replace some of them: tick those courses as done.</div>
<p class="mut">Tick a course when it's done. Use the arrows to move it to another term. "Avg GPA" is the course average; "Instructor matters" means grades differ a lot by who teaches it, so open the course before you register.</p>
<noscript><div class="note warn">The planner needs JavaScript. The official roadmap is on catalog.vt.edu.</div></noscript>
<div class="board" id="board"></div>
<script type="application/json" id="plan-data">${json}</script>`;
  return layout(`${r.name} degree plan · VT Grades`, `Plan a Virginia Tech ${r.name} degree term by term from the official roadmap, with grade data for every course.`, '../',
    `<a href="index.html">Degree planner</a> / ${esc(r.name)}`, body, site, `<script src="../plan.js" defer></script>`);
}

export function renderPlanIndex(roadmaps: Roadmap[], site: Site): string {
  const sorted = [...roadmaps].sort((a, b) => a.name.localeCompare(b.name));
  return layout('Degree planner · VT Grades', 'Plan your Virginia Tech degree from the official roadmap, with grade data for every course.', '../', '',
    `<div class="hero"><h1>Plan your whole degree.</h1><p>Pick your major to start from its official roadmap. Choose 3 to 5 years, move courses between terms, and see the grade data for each one as you go.</p></div>
<h2>Choose a major</h2><div class="doors">${sorted.map((r) => `<a class="door" href="${esc(r.slug)}.html"><b>${esc(r.name)}</b>${r.total} credits<span class="go">Start planning →</span></a>`).join('')}</div>
<p class="mut">${sorted.length} College of Engineering majors so far, read from the 2026-2027 catalog. More majors and minors are not added yet.</p>`, site);
}

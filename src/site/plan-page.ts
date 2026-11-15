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
  name: string;
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
  return { slug: r.slug, name: r.name, total: credits(r.terms.flatMap((t) => t.items)), heavy: HEAVY_CREDITS, low: LOW_GPA, items, plans };
}

/**
 * Planner script. State per major in localStorage: chosen length, moved courses, finished courses.
 * Balance: moves unfinished elective slots (items without a course code) from the heaviest
 * Fall/Spring term to the lightest until they are within 3 credits. Named courses never move on their own.
 */
export const PLAN_JS = `(()=>{const D=JSON.parse(document.getElementById('plan-data').textContent),root=document.body.dataset.root,KEY='vtplan:'+D.slug;
let S;try{S=JSON.parse(localStorage.getItem(KEY))||{}}catch{S={}}
S.years=D.plans[S.years]?S.years:'4';S.pos=S.pos||{};S.done=S.done||[];
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const $=id=>document.getElementById(id),board=$('board'),yearsEl=$('years'),over=$('over');
const cr=ids=>ids.reduce((a,id)=>a+D.items[id].cr,0),short=l=>l.replace(' year, ',' ').replace('First','Y1').replace('Second','Y2').replace('Third','Y3').replace('Fourth','Y4').replace('Fifth','Y5').replace('Spring','Sp').replace('Summer','Su').replace('Fall','F');
function terms(){const plan=D.plans[S.years],pos=S.pos[S.years]||{},out=plan.map(t=>({label:t.label,ids:[]}));plan.forEach((t,ti)=>t.ids.forEach(id=>{const p=pos[id];out[p!=null&&p<out.length?p:ti].ids.push(id)}));return out}
function put(id,to){(S.pos[S.years]=S.pos[S.years]||{})[id]=to}
function move(id,from,d){const to=from+d;if(to<0||to>=D.plans[S.years].length)return;put(id,to);save();draw()}
function balance(){let moved=0;for(let n=0;n<60;n++){const ts=terms().map((t,i)=>({i,ids:t.ids,c:cr(t.ids),su:t.label.includes('Summer')})).filter(t=>!t.su);
const hi=ts.reduce((a,b)=>b.c>a.c?b:a),lo=ts.reduce((a,b)=>b.c<a.c?b:a);if(hi.c-lo.c<=3)break;
const id=hi.ids.find(x=>!D.items[x].code&&!S.done.includes(x)&&D.items[x].cr>0&&D.items[x].cr<hi.c-lo.c);if(!id)break;put(id,lo.i);moved++}save();draw();return moved}
function draw(){board.textContent='';over.textContent='';const ts=terms();let doneCr=0;const max=Math.max(D.heavy,...ts.map(t=>cr(t.ids)));
ts.forEach((t,ti)=>{const card=el('section','term'),list=el('div');card.id='t'+ti;let c=0,gs=0,gw=0,low=0;
t.ids.forEach(id=>{const it=D.items[id],done=S.done.includes(id);c+=it.cr;if(done)doneCr+=it.cr;if(it.g!=null){gs+=it.g*it.cr;gw+=it.cr;if(it.g<D.low&&!done)low++}
const li=el('div','it'+(done?' done':'')),cb=el('input');cb.type='checkbox';cb.checked=done;cb.setAttribute('aria-label','Done: '+(it.code||it.label));
cb.onchange=()=>{S.done=cb.checked?[...S.done,id]:S.done.filter(x=>x!==id);save();draw()};
const mid=el('div','mid'),nm=el('div','nm');if(it.h){const a=el('a',null,it.code);a.href=root+it.h;nm.append(a,' '+it.label)}else nm.textContent=(it.code?it.code+' ':'')+it.label;
mid.append(nm,el('div','mut',it.cr+' cr'+(it.alt.length?' · or '+it.alt.join(', '):'')+(it.ch.length?' · choose one: '+it.ch.join(', '):'')));
if(it.g!=null)mid.append(el('span','tag','avg GPA '+it.g.toFixed(2)));if(it.v==='matters')mid.append(el('span','tag hot','instructor matters'));
const mv=el('div','mv'),l=el('button',null,'\\u2190'),r=el('button',null,'\\u2192');l.setAttribute('aria-label','Move to the term before');r.setAttribute('aria-label','Move to the term after');l.title='Earlier';r.title='Later';
l.disabled=ti===0;r.disabled=ti===ts.length-1;l.onclick=()=>move(id,ti,-1);r.onclick=()=>move(id,ti,1);mv.append(l,r);li.append(cb,mid,mv);list.append(li)});
const heavy=c>D.heavy,load=el('div','meter load'),fill=el('i');fill.style.width=Math.min(100,c/max*100)+'%';if(heavy)fill.style.background='var(--acc)';load.append(fill);
card.append(el('h3',null,t.label),el('div','mut',c+' credits'+(gw?' · typical GPA '+(gs/gw).toFixed(2):'')),load);
if(heavy)card.append(el('div','flag','Heavy load: '+c+' credits'));if(low>=3)card.append(el('div','flag',low+' courses here average below '+D.low.toFixed(1)));
if(!t.ids.length)card.append(el('div','mut','Nothing planned here.'));card.append(list);board.append(card);
const o=el('a',heavy?'hv':t.label.includes('Summer')?'sm':''),b=el('i');o.href='#t'+ti;o.title=t.label+': '+c+' credits';b.style.height=Math.round(c/max*52)+'px';o.append(el('span',null,String(c)),b,el('span',null,short(t.label)));over.append(o)});
$('prog').textContent=doneCr+' of '+D.total+' credits done';$('bar').style.width=Math.min(100,doneCr/D.total*100)+'%';
[...yearsEl.children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.y===S.years)));$('note').hidden=S.years==='4';$('summer').hidden=!(+S.years<4)}
const say=(b,t)=>{const o=b.textContent;b.textContent=t;setTimeout(()=>b.textContent=o,1600)};
yearsEl.addEventListener('click',e=>{const y=e.target.dataset.y;if(y){S.years=y;save();draw()}});
$('balance').onclick=e=>{const n=balance();say(e.target,n?'Moved '+n+' elective'+(n>1?'s':''):'Already even')};
$('copy').onclick=async e=>{const txt=D.name+' plan ('+S.years+' years)\\n'+terms().map(t=>t.label+' ('+cr(t.ids)+' cr)\\n'+t.ids.map(id=>'  '+(S.done.includes(id)?'[x] ':'[ ] ')+(D.items[id].code?D.items[id].code+' ':'')+D.items[id].label).join('\\n')).join('\\n');try{await navigator.clipboard.writeText(txt);say(e.target,'Copied')}catch{say(e.target,'Copy blocked')}};
$('reset').onclick=()=>{if(confirm('Clear your moves and checkmarks for this major?')){S={years:S.years,pos:{},done:[]};save();draw()}};draw()})();`;

const CATALOG = 'https://catalog.vt.edu/undergraduate/';

export function renderPlan(r: Roadmap, site: Site, links: Links): string {
  // "</" inside JSON would end the script tag early.
  const json = JSON.stringify(planData(r, site, links)).replace(/</g, '\\u003c');
  const body = `<h1>${esc(r.name)}</h1><p class="sub">Degree plan · ${r.total} credits · from the <a href="${CATALOG}${esc(r.catalogPath)}#roadmaptext" target="_blank" rel="noopener noreferrer">official 2026-2027 roadmap ↗</a></p>
<div class="ctl"><b>Graduate in</b><div class="seg" id="years" role="group" aria-label="Years to graduate">${YEAR_OPTIONS.map((y) => `<button type="button" data-y="${y}" aria-pressed="${y === 4}">${y} yr</button>`).join('')}</div></div>
<div class="over" id="over" aria-label="Credits per term"></div><p class="mut">Credits per term. Tap a bar to jump to that term.</p>
<div class="ctl"><div style="flex:1 1 220px"><span id="prog" class="mut"></span><div class="meter"><i id="bar"></i></div></div><button type="button" class="btn" id="balance" title="Move elective slots from the heaviest terms to the lightest">Balance terms</button><button type="button" class="btn" id="copy">Copy plan</button><button type="button" class="btn" id="reset">Start over</button></div>
<p class="note warn" id="note" hidden><b>This layout is a rearrangement, not an official plan.</b> It spreads the 4-year roadmap over the length you chose and keeps course sequences in order, but it does not check prerequisites or which term a course is offered. Take it to your advisor before you rely on it.</p>
<p class="note" id="summer" hidden>Finishing in under 4 years uses summer terms. AP, IB or transfer credit can replace some of them: tick those courses as done.</p>
<p class="mut">Tick a course when it's done. Arrows move it a term. "Instructor matters" means grades differ a lot by who teaches it: open the course before you register. Saved in this browser only.</p>
<noscript><p class="note warn">The planner needs JavaScript. The official roadmap is on catalog.vt.edu.</p></noscript>
<div class="board" id="board"></div>
<script type="application/json" id="plan-data">${json}</script>`;
  return layout(`${r.name} degree plan · VT Grades`, `Plan a Virginia Tech ${r.name} degree term by term from the official roadmap, with grade data for every course.`, '../',
    `<a href="index.html">Degree planner</a>`, body, site, 'plan', `<script src="../plan.js" defer></script>`);
}

export function renderPlanIndex(roadmaps: Roadmap[], site: Site): string {
  const sorted = [...roadmaps].sort((a, b) => a.name.localeCompare(b.name));
  return layout('Degree planner · VT Grades', 'Plan your Virginia Tech degree from the official roadmap, with grade data for every course.', '../', '',
    `<div class="hero"><h1>Your degree, <em>term by term</em>.</h1><p>Start from your major's official roadmap. Choose 3 to 5 years, rebalance heavy terms with one tap, and see the grade data for every course as you go.</p></div>
<h2>Choose a major</h2><div class="majors">${sorted.map((r) => `<a href="${esc(r.slug)}.html"><b>${esc(r.name)}</b><span>${r.total} credits →</span></a>`).join('')}</div>
<p class="mut">${sorted.length} College of Engineering majors so far, read from the 2026-2027 catalog. Other colleges and minors are not added yet.</p>`, site, 'plan');
}

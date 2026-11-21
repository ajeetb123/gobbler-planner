// Degree planner pages. The page ships the roadmap as JSON; PLAN_JS draws the board and keeps
// the student's changes in their own browser (localStorage). Nothing is sent anywhere.
import { baseYears, byCollege, collegeOf, credits, repack, YEAR_OPTIONS, type Roadmap } from '../plan/roadmap.ts';
import { checkItems, planIssues, type CourseInfo, type Expr } from '../plan/prereq.ts';
import { brand, DISCLAIMER, esc, layout, RMP_SCHOOL_URL, UDC_URL, type Links } from './render.ts';
import type { Site } from './model.ts';

/** A term above this many credits gets a "heavy load" flag. */
export const HEAVY_CREDITS = 18;
/** Three or more unfinished courses under this course average in one term get a flag. */
export const LOW_GPA = 2.8;

export interface PlanData {
  slug: string;
  name: string;
  total: number;
  /** Plan length the page opens on: the roadmap's own layout (4 years, or 5 for a 160-credit draft). */
  base: string;
  heavy: number;
  low: number;
  /** g = course average GPA, v = instructor-matters verdict, h = link to the course page (all three only with grade data).
   *  cs / pre / co = what planIssues needs: codes this slot stands for, prerequisites, corequisites. */
  items: Record<string, { code?: string; label: string; cr: number; alt: string[]; ch: string[]; cs: string[]; pre?: Expr; co?: Expr; g?: number; v?: string; h?: string }>;
  plans: Record<string, Array<{ label: string; ids: string[] }>>;
}

export function planData(r: Roadmap, courses: Map<string, CourseInfo>, site?: Site, links?: Links): PlanData {
  const byCourse = new Map((site?.courses ?? []).map((c) => [c.course, c]));
  const check = checkItems(r.terms, courses, r.draft);
  const items: PlanData['items'] = {};
  for (const i of r.terms.flatMap((t) => t.items)) {
    const c = i.code ? byCourse.get(i.code) : undefined;
    items[i.id] = {
      code: i.code, label: i.code ? (c?.title ?? courses.get(i.code)?.title ?? i.label.replace(i.code, '').trim()) : i.label, cr: i.credits, alt: i.alt, ch: i.choices,
      ...check[i.id]!,
      g: c ? Math.round(c.mean * 100) / 100 : undefined, v: c?.spread.verdict, h: c && links ? `course/${links.course.get(c.course)}.html` : undefined,
    };
  }
  const plans: PlanData['plans'] = {};
  for (const y of YEAR_OPTIONS) plans[String(y)] = repack(r, y, check).map((t) => ({ label: t.label, ids: t.items.map((i) => i.id) }));
  return { slug: r.slug, name: r.name, total: credits(r.terms.flatMap((t) => t.items)), base: String(baseYears(r)), heavy: HEAVY_CREDITS, low: LOW_GPA, items, plans };
}

/**
 * Planner script. State per major in localStorage: chosen length, moved courses, finished courses.
 * Every redraw runs planIssues (the same function the tests cover, shipped as source): a course placed before a
 * prerequisite gets a note, a course with no room to slip gets a "can't slip" tag.
 * Share: the state travels in the URL hash (#y=years&d=done ids&m=id_term moves). A plan opened from such a link
 * is shown but not saved until the visitor chooses "Keep as my plan", so a link never overwrites someone's own plan.
 * Balance: moves unfinished elective slots (items without a course code) from the heaviest
 * Fall/Spring term to the lightest until they are within 3 credits. Named courses never move on their own.
 */
export const PLAN_JS = `(()=>{const planIssues=${planIssues.toString()};
const D=JSON.parse(document.getElementById('plan-data').textContent),root=document.body.dataset.root,KEY='gobblerplan:'+D.slug;
let S;try{S=JSON.parse(localStorage.getItem(KEY))||{}}catch{S={}}
const P=new URLSearchParams(location.hash.slice(1));let shared=P.has('y');
if(shared){const ok=x=>D.items['t'+x]?'t'+x:null,p={};(P.get('m')||'').split('.').forEach(x=>{const[a,b]=x.split('_'),id=ok(a);if(id&&/^\\d+$/.test(b))p[id]=+b});
S={years:P.get('y'),pos:{[P.get('y')]:p},done:(P.get('d')||'').split('.').map(ok).filter(Boolean)}}
// Saved or shared state can be stale or hand-edited: keep only what fits this roadmap.
const clean=s=>{s=s&&typeof s==='object'&&!Array.isArray(s)?s:{};const o={years:D.plans[s.years]?String(s.years):D.base,pos:{},done:Array.isArray(s.done)?[...new Set(s.done.filter(id=>D.items[id]))]:[]};
if(s.pos&&typeof s.pos==='object')for(const y in D.plans){const p=s.pos[y];if(p&&typeof p==='object'){o.pos[y]={};for(const id in p)if(D.items[id]&&Number.isInteger(p[id])&&p[id]>=0&&p[id]<D.plans[y].length)o.pos[y][id]=p[id]}}return o};
S=clean(S);const U=[];
const snap=()=>{U.push(JSON.stringify(S));if(U.length>40)U.shift();$('undo').disabled=false};
const save=()=>{if(shared)return;try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const $=id=>document.getElementById(id),board=$('board'),yearsEl=$('years'),over=$('over');
const cr=ids=>ids.reduce((a,id)=>a+D.items[id].cr,0),short=l=>l.replace(' year, ',' ').replace('First','Y1').replace('Second','Y2').replace('Third','Y3').replace('Fourth','Y4').replace('Fifth','Y5').replace('Spring','Sp').replace('Summer','Su').replace('Fall','F');
function terms(){const plan=D.plans[S.years],pos=S.pos[S.years]||{},out=plan.map(t=>({label:t.label,ids:[]}));plan.forEach((t,ti)=>t.ids.forEach(id=>{const p=pos[id];out[p!=null&&p<out.length?p:ti].ids.push(id)}));return out}
function put(id,to){(S.pos[S.years]=S.pos[S.years]||{})[id]=to}
function move(id,from,d){const to=from+d;if(to<0||to>=D.plans[S.years].length)return;snap();put(id,to);save();draw()}
function balance(){snap();let moved=0;for(let n=0;n<60;n++){const ts=terms().map((t,i)=>({i,ids:t.ids,c:cr(t.ids),su:t.label.includes('Summer')})).filter(t=>!t.su);
const hi=ts.reduce((a,b)=>b.c>a.c?b:a),lo=ts.reduce((a,b)=>b.c<a.c?b:a);if(hi.c-lo.c<=3)break;
const id=hi.ids.find(x=>!D.items[x].code&&!S.done.includes(x)&&D.items[x].cr>0&&D.items[x].cr<hi.c-lo.c);if(!id)break;put(id,lo.i);moved++}save();draw();return moved}
const CAT='https://catalog.vt.edu/course-descriptions/';
function draw(){board.textContent='';over.textContent='';const ts=terms(),I=planIssues(D.items,ts.map(t=>t.ids),S.done),nm2=j=>D.items[j].code||D.items[j].label;let doneCr=0,bad=0,firstBad=null;const max=Math.max(D.heavy,...ts.map(t=>cr(t.ids)));
ts.forEach((t,ti)=>{const card=el('section','term'),list=el('div');card.id='t'+ti;let c=0,gs=0,gw=0,low=0,tb=0;
t.ids.forEach(id=>{const it=D.items[id],done=S.done.includes(id);c+=it.cr;if(done)doneCr+=it.cr;if(it.g!=null){gs+=it.g*it.cr;gw+=it.cr;if(it.g<D.low&&!done)low++}
const li=el('div','it'+(done?' done':'')),cb=el('input');cb.type='checkbox';cb.checked=done;cb.setAttribute('aria-label','Done: '+(it.code||it.label));
cb.onchange=()=>{snap();S.done=cb.checked?[...S.done,id]:S.done.filter(x=>x!==id);save();draw()};
const mid=el('div','mid'),nm=el('div','nm');if(it.code){const a=el('a',null,it.code);if(it.h)a.href=root+it.h;else{a.href=CAT+it.code.split(' ')[0].toLowerCase()+'/';a.target='_blank';a.rel='noopener noreferrer';a.title='Catalog description'}nm.append(a,' '+it.label)}else nm.textContent=it.label;
mid.append(nm,el('div','mut',it.cr+' cr'+(it.alt.length?' · or '+it.alt.join(', '):'')+(it.ch.length?' · choose one: '+it.ch.join(', '):'')));
if(it.g!=null)mid.append(el('span','tag','avg GPA '+it.g.toFixed(2)));if(it.v==='matters')mid.append(el('span','tag hot','instructor matters'));
const v=I[id];if(!done&&v.slack===0){const s=el('span','tag hot',"can't slip");s.title='Later courses chain off this one. Moving it later pushes graduation back.';mid.append(s)}
if(!done&&v.unlocks.length)mid.append(el('div','mut','Needed for '+v.unlocks.slice(0,3).join(', ')+(v.unlocks.length>3?' and '+(v.unlocks.length-3)+' more':'')));
if(v.late.length){bad++;tb++;mid.append(el('div','flag','Needs '+v.late.map(nm2).join(', ')+' in an earlier term'))}
if(v.coLate.length){bad++;tb++;mid.append(el('div','flag','Take '+v.coLate.map(nm2).join(', ')+' in the same term or earlier'))}
if((v.late.length||v.coLate.length)&&!firstBad)firstBad=li;
const mv=el('div','mv'),l=el('button',null,'\\u2190'),r=el('button',null,'\\u2192');l.setAttribute('aria-label','Move to the term before');r.setAttribute('aria-label','Move to the term after');l.title='Earlier';r.title='Later';
l.disabled=ti===0;r.disabled=ti===ts.length-1;l.onclick=()=>move(id,ti,-1);r.onclick=()=>move(id,ti,1);mv.append(l,r);li.append(cb,mid,mv);list.append(li)});
const heavy=c>D.heavy,load=el('div','meter load'),fill=el('i');fill.style.width=Math.min(100,c/max*100)+'%';if(heavy)fill.style.background='var(--acc)';load.append(fill);
card.append(el('h3',null,t.label),el('div','mut',c+' credits'+(gw?' · typical GPA '+(gs/gw).toFixed(2):'')),load);
if(heavy)card.append(el('div','flag','Heavy load: '+c+' credits'));if(low>=3)card.append(el('div','flag',low+' courses here average below '+D.low.toFixed(1)));
if(!t.ids.length)card.append(el('div','mut','Nothing planned here.'));card.append(list);board.append(card);
const o=el('a',(heavy?'hv':t.label.includes('Summer')?'sm':'')+(tb?' bad':'')),b=el('i');o.href='#t'+ti;o.title=t.label+': '+c+' credits'+(tb?', '+tb+' prerequisite conflict'+(tb>1?'s':''):'');b.style.height=Math.round(c/max*52)+'px';o.append(el('span',null,String(c)),b,el('span',null,short(t.label)));over.append(o)});
const cf=$('conf');cf.textContent=bad?bad+' prerequisite conflict'+(bad>1?'s':'')+' in this layout. ':'No prerequisite conflicts.';cf.className=bad?'flag':'mut';
if(firstBad){const go=el('button','lnk','Show the first one');go.type='button';go.onclick=()=>{firstBad.scrollIntoView({behavior:'smooth',block:'center'});firstBad.classList.add('pulse');setTimeout(()=>firstBad.classList.remove('pulse'),1600)};cf.append(go)}
$('shared').hidden=!shared;$('prog').textContent=doneCr>=D.total&&D.total>0?'All '+D.total+' credits done. Congratulations.':doneCr+' of '+D.total+' credits done';$('bar').style.width=Math.min(100,doneCr/D.total*100)+'%';
[...yearsEl.children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.y===S.years)));$('note').hidden=S.years===D.base;$('summer').hidden=!(+S.years<4)}
const say=(b,t)=>{const o=b.textContent;b.textContent=t;setTimeout(()=>b.textContent=o,1600)};
yearsEl.addEventListener('click',e=>{const y=e.target.dataset.y;if(y&&y!==S.years){snap();S.years=y;save();draw()}});
$('undo').onclick=()=>{if(!U.length)return;S=clean(JSON.parse(U.pop()));$('undo').disabled=!U.length;save();draw()};
$('balance').onclick=e=>{const n=balance();say(e.target,n?'Moved '+n+' elective'+(n>1?'s':''):'Already even')};
$('copy').onclick=async e=>{const txt=D.name+' plan ('+S.years+' years)\\n'+terms().map(t=>t.label+' ('+cr(t.ids)+' cr)\\n'+t.ids.map(id=>'  '+(S.done.includes(id)?'[x] ':'[ ] ')+(D.items[id].code?D.items[id].code+' ':'')+D.items[id].label).join('\\n')).join('\\n');try{await navigator.clipboard.writeText(txt);say(e.target,'Copied')}catch{say(e.target,'Copy blocked')}};
$('share').onclick=async e=>{const p=S.pos[S.years]||{},u=location.href.split('#')[0]+'#y='+S.years+'&d='+S.done.map(x=>x.slice(1)).join('.')+'&m='+Object.keys(p).map(k=>k.slice(1)+'_'+p[k]).join('.');try{await navigator.clipboard.writeText(u);say(e.target,'Link copied')}catch{prompt('Copy this link',u)}};
$('print').onclick=()=>print();
$('keep').onclick=()=>{shared=false;save();history.replaceState(null,'',location.pathname);draw()};
$('reset').onclick=()=>{if(confirm('Clear your moves and checkmarks for this major?')){snap();S={years:S.years,pos:{},done:[]};save();draw()}};draw()})();`;

const CATALOG = 'https://catalog.vt.edu/undergraduate/';

export function renderPlan(r: Roadmap, courses: Map<string, CourseInfo>, site?: Site, links?: Links): string {
  // "</" inside JSON would end the script tag early.
  const json = JSON.stringify(planData(r, courses, site, links)).replace(/</g, '\\u003c');
  const ext = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text} ↗</a>`;
  const body = `<h1>${esc(r.name)}</h1><p class="sub">${esc(collegeOf(r.catalogPath))} · ${r.total} credits · ${r.draft ? `draft from the ${ext(`${CATALOG}${esc(r.catalogPath)}`, 'official 2026-2027 requirements')}` : `from the ${ext(`${CATALOG}${esc(r.catalogPath)}#roadmaptext`, 'official 2026-2027 roadmap')}`} · <a href="compare.html#from=${esc(r.slug)}">What if I switch majors?</a></p>
${r.draft ? `<p class="note warn"><b>Draft plan, not an official roadmap.</b> The catalog lists what this major requires but not which term to take it in. This order is ours: by course level, with prerequisites first. Pathways and elective slots are placeholders, and courses under "choose from list" are your pick. Check it against the ${ext(`${CATALOG}${esc(r.catalogPath)}`, 'catalog requirements')} and with your advisor.</p>` : ''}
<p class="note warn" id="shared" hidden><b>You're viewing a shared plan.</b> Changes you make here are not saved. <button type="button" class="btn" id="keep">Keep as my plan</button></p>
<div class="ctl"><b>Graduate in</b><div class="seg" id="years" role="group" aria-label="Years to graduate">${YEAR_OPTIONS.map((y) => `<button type="button" data-y="${y}" aria-pressed="${y === baseYears(r)}">${y} yr</button>`).join('')}</div></div>
<div class="over" id="over" aria-label="Credits per term"></div><p class="mut">Credits per term. Tap a bar to jump to that term.</p>
<div class="ctl"><div style="flex:1 1 220px"><span id="prog" class="mut"></span><div class="meter"><i id="bar"></i></div></div><button type="button" class="btn" id="balance" title="Move elective slots from the heaviest terms to the lightest">Balance terms</button><button type="button" class="btn" id="undo" disabled title="Undo your last change">Undo</button><button type="button" class="btn" id="share" title="Copy a link that opens this exact plan">Share link</button><button type="button" class="btn" id="copy">Copy as text</button><button type="button" class="btn" id="print" title="Print this plan or save it as a PDF">Print</button><button type="button" class="btn" id="reset">Start over</button></div>
<p id="conf" class="mut" role="status"></p>
<p class="note warn" id="note" hidden><b>This layout is a rearrangement, not an official plan.</b> It spreads the ${r.draft ? 'draft plan' : '4-year roadmap'} over the length you chose and keeps prerequisites in order where it can. It does not know which term a course is offered. Take it to your advisor before you rely on it.</p>
<p class="note" id="summer" hidden>Finishing in under 4 years uses summer terms. AP, IB or transfer credit can replace some of them: tick those courses as done.</p>
<details class="help"><summary>How to use this page</summary>
<ul><li><b>Tick</b> a course when it's done. AP, IB and transfer credit count too.</li><li><b>Arrows</b> move a course one term. A note appears if the move breaks a prerequisite, and <b>Undo</b> takes it back.</li><li><b>"Can't slip"</b> means later courses chain off this one with no spare term.</li><li><b>Balance terms</b> evens out credits by moving elective slots only.</li><li><b>Share link</b> copies a link to this exact plan. <b>Print</b> gives you a paper or PDF copy for an advising meeting.</li>${site ? '<li><b>"Instructor matters"</b> means grades differ a lot by who teaches it.</li>' : `<li>Course codes open the catalog description. For past grades see ${ext(UDC_URL, "Virginia Tech's grade distribution page")}, and for instructor reviews ${ext(RMP_SCHOOL_URL, 'RateMyProfessors')}.</li>`}<li>Your plan is saved in this browser only.</li></ul></details>
<noscript><p class="note warn">The planner needs JavaScript. The official roadmap is on catalog.vt.edu.</p></noscript>
<div class="board" id="board"></div>
<script type="application/json" id="plan-data">${json}</script>`;
  return layout(`${r.name} degree plan · ${brand(site)}`, `Plan a Virginia Tech ${r.name} degree term by term from the official roadmap, with prerequisite checks.`, '../',
    `<a href="index.html">Degree planner</a>`, body, site, 'plan', `<script src="../plan.js" defer></script>`);
}

/** Planner landing page. `home` renders it as the site's front page (planner-only build), so links gain a "plan/" prefix. */
export function renderPlanIndex(roadmaps: Roadmap[], site?: Site, home = false, noRoadmap: Array<{ name: string; catalogPath: string }> = []): string {
  const pre = home ? 'plan/' : '';
  const groups = byCollege(roadmaps);
  const majors = groups.map(([college, rs]) => `<h3 class="col" id="${esc(college.toLowerCase().replace(/[^a-z]+/g, '-'))}">${esc(college)} <span class="mut">${rs.length}</span></h3><div class="majors">${rs.map((r) => `<a href="${pre}${esc(r.slug)}.html"><b>${esc(r.name)}</b><span>${r.draft ? '<i class="tag">draft</i> ' : ''}${r.total} credits →</span></a>`).join('')}</div>`).join('');
  const drafts = roadmaps.filter((r) => r.draft).length;
  const none = byCollege(noRoadmap).map(([college, xs]) => `<p class="mut"><b>${esc(college)}:</b> ${xs.map((x) => `<a href="${CATALOG}${esc(x.catalogPath)}" target="_blank" rel="noopener noreferrer">${esc(x.name)}</a>`).join(' · ')}</p>`).join('');
  return layout(`${home ? 'Unofficial Virginia Tech degree planner' : 'Degree planner'} · ${brand(site)}`, 'Plan your Virginia Tech degree from the official roadmap: 3 to 5 years, prerequisite checks, major-switch comparison, shareable link. No login.', home ? '' : '../', '',
    `<div class="hero"><h1>Your degree, <em>term by term</em>.</h1><p>Start from your major's official roadmap. Choose 3 to 5 years, move courses and see at once if a prerequisite breaks, and send the plan to your advisor as a link. No login.</p></div>
<h2>Choose a major</h2><input class="sel filter" id="mf" type="search" placeholder="Type to filter, for example: computer, finance, biology" aria-label="Filter majors" autocomplete="off"><p class="mut" id="mfnone" hidden>No major matches that. Try a shorter word.</p><p class="mut">${roadmaps.length - drafts} majors and options with an official roadmap in the 2026-2027 catalog${drafts ? `, and ${drafts} marked <i class="tag">draft</i> where the catalog lists requirements only and the term order is ours` : ''}. Press <kbd>/</kbd> to search by name. Jump to: ${groups.map(([c]) => `<a href="#${esc(c.toLowerCase().replace(/[^a-z]+/g, '-'))}">${esc(c)}</a>`).join(' · ')}</p>${majors}
${none ? `<h2>Not in the planner</h2><p class="mut">These ${noRoadmap.length} catalog programs have no roadmap and could not be turned into a draft. Each link opens its catalog page.</p>${none}` : ''}
<div class="paths"><a href="${pre}compare.html"><b>Thinking of switching?</b><span>Pick two majors and what you've finished. See what carries over and how many credits are left.</span></a>
<a href="${home ? '' : '../'}about.html"><b>How it works</b><span>Where the roadmaps and prerequisites come from, what is checked, and what is not.</span></a></div>`, site, 'plan');
}

export function renderPlanAbout(): string {
  return layout(`How it works · ${brand()}`, 'Where the Virginia Tech degree planner gets its data and what it checks.', '', '',
    `<h1>How it works</h1><p class="sub">What the planner knows, what it checks, and where it stops.</p>
<h2>Roadmaps</h2><p>Each major's plan is the official 8-semester roadmap from the 2026-2027 Virginia Tech catalog. The 4-year view is that roadmap unchanged. Every term's credits are checked against the totals the catalog prints.</p>
<h2>Draft plans</h2><p>About 85 majors have no roadmap in the catalog, only a list of requirements. For those the planner builds a draft: courses are ordered by level (1000-level first), a course waits for its prerequisites, and Pathways and elective credits are spread evenly as placeholders. Where the catalog lists fewer credits than the degree total, the gap is filled with "Pathways, electives and other requirements" slots. A draft is our arrangement of official requirements. It is marked on every page and is not something the department published.</p>
<h2>3 to 5 years</h2><p>Other lengths spread the same courses over more or fewer terms. Plans under 4 years use summer terms at half load. A course waits until its prerequisites sit in an earlier term, and corequisites move together. The planner does not know which term a course is offered.</p>
<h2>Prerequisite checks</h2><p>Prerequisites and corequisites are read from each course's catalog description. Move a course ahead of something it needs and a note appears under it. Three limits: a requirement only placement scores or off-roadmap courses can meet is not checked; a requirement the official roadmap itself does not follow is not checked; and a few corequisites the catalog writes in free text are skipped.</p>
<h2>"Can't slip"</h2><p>A course gets this tag when later courses chain off it and there is no spare term left: moving it one term later pushes the end of the chain past your last term.</p>
<h2>Switching majors</h2><p>The comparison matches what you've finished against the other major's roadmap: same course first, then elective slots with the same name, then free electives. It is an estimate from the two roadmaps. The department you're moving into decides what really counts.</p>
<h2>Ask</h2><p>The Ask page answers questions like "what do I need before CS 3214?". No AI model is involved: a search ranking built for this site finds the course or major you mean, and fixed rules assemble the answer from the catalog facts stored for it, with links to the sources. It runs in your browser, so your question is not sent anywhere. It can pick the wrong match, so check the catalog link.</p>
<h2>Sharing and privacy</h2><p>Your plan is saved in your browser only. "Share link" puts the plan in the link itself, so nothing is uploaded. Opening someone's link never overwrites your own plan unless you choose to keep it.</p>
<h2>What this is not</h2><p>It is not a degree audit and it does not know your record. Use the university's own degree audit and your advisor for the official check. For past grades, use ${`<a href="${UDC_URL}" target="_blank" rel="noopener noreferrer">Virginia Tech's grade distribution page ↗</a>`}.</p>
<h2>Who runs this</h2><p>${DISCLAIMER} The name, the design and the planning logic are ours. Roadmaps, requirements and prerequisites are facts taken from the university's public 2026-2027 catalog, and every plan links back to its catalog page. The site is free, has no ads, and collects nothing about you.</p>`, undefined, 'about');
}

// "Switch majors" page: pick two majors and what you've finished, see what carries over.
// Ships every roadmap as JSON plus switchCost's source; all work happens in the browser.
import { collegeOf, type Roadmap } from '../plan/roadmap.ts';
import { checkItem, type CourseInfo } from '../plan/prereq.ts';
import { switchCost } from '../plan/switch.ts';
import { brand, layout } from './render.ts';
import type { Site } from './model.ts';

/** Terms are estimated at this many credits each when turning credits left into terms left. */
export const TERM_CREDITS = 16;

/** The ranking under the comparison shows this many closest majors. */
export const RANK_SHOWN = 12;

export interface CompareMajor {
  slug: string;
  college: string;
  name: string;
  total: number;
  terms: Array<{ label: string; ids: string[] }>;
  items: Record<string, { code?: string; label: string; cr: number; cs: string[] }>;
}

export function compareData(roadmaps: Roadmap[], courses: Map<string, CourseInfo>): CompareMajor[] {
  return [...roadmaps].sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({
    slug: r.slug, college: collegeOf(r.catalogPath), name: r.name, total: r.total,
    terms: r.terms.map((t) => ({ label: t.label, ids: t.items.map((i) => i.id) })),
    items: Object.fromEntries(r.terms.flatMap((t) => t.items).map((i) => [i.id, {
      code: i.code, label: i.code ? (courses.get(i.code)?.title ?? i.label.replace(i.code, '').trim()) : i.label, cr: i.credits, cs: checkItem(i, courses).cs,
    }])),
  }));
}

/**
 * Smaller form for the page: course titles are stored once (128 roadmaps repeat the same courses), and an item is
 * [credits, codes, label] with label null when it is just the title of its first code. COMPARE_JS undoes this on load.
 */
export function packCompare(majors: CompareMajor[]) {
  const t: Record<string, string> = {};
  for (const m of majors) for (const i of Object.values(m.items)) if (i.code && t[i.code] === undefined) t[i.code] = i.label;
  return {
    t,
    m: majors.map((m) => ({
      ...m,
      terms: m.terms.map((x) => [x.label, x.ids]),
      items: Object.fromEntries(Object.entries(m.items).map(([id, i]) => [id, [i.cr, i.cs, i.code && t[i.code] === i.label ? null : i.label]])),
    })),
  };
}

/**
 * "Finished so far" is either the courses ticked in the planner for the first major (read from the same
 * localStorage key the planner writes) or every course through a chosen term of its official roadmap.
 * #from=slug&to=slug preselects majors (the planner links here with #from).
 */
export const COMPARE_JS = `(()=>{const switchCost=${switchCost.toString()};
const P=JSON.parse(document.getElementById('cmp-data').textContent),D=P.m,PER=${TERM_CREDITS},$=id=>document.getElementById(id),F=$('from'),T=$('to'),W=$('done'),out=$('out'),rank=$('rank');
D.forEach(m=>{m.terms=m.terms.map(x=>({label:x[0],ids:x[1]}));for(const id in m.items){const a=m.items[id];m.items[id]={cr:a[0],cs:a[1],code:a[2]==null?a[1][0]:undefined,label:a[2]==null?P.t[a[1][0]]:a[2]}}});
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e},by=s=>D.find(m=>m.slug===s);
for(const s of[F,T]){let g;D.slice().sort((a,b)=>a.college.localeCompare(b.college)||a.name.localeCompare(b.name)).forEach(m=>{if(!g||g.label!==m.college){g=document.createElement('optgroup');g.label=m.college;s.append(g)}g.append(new Option(m.name,m.slug))})}
const h=new URLSearchParams(location.hash.slice(1));if(by(h.get('from')))F.value=h.get('from');T.value=by(h.get('to'))&&h.get('to')!==F.value?h.get('to'):D.find(m=>m.slug!==F.value).slug;
const ticks=m=>{try{return((JSON.parse(localStorage.getItem('gobblerplan:'+m.slug))||{}).done||[]).filter(id=>m.items[id])}catch{return[]}};
function fillDone(){const m=by(F.value),t=ticks(m);W.textContent='';if(t.length)W.append(new Option('What I ticked in the planner ('+t.length+(t.length>1?' courses)':' course)'),'ticks'));
W.append(new Option('Nothing yet','0'));m.terms.forEach((x,i)=>W.append(new Option('Everything through '+x.label,String(i+1))));W.value=t.length?'ticks':'2'}
const doneIds=()=>{const m=by(F.value);return W.value==='ticks'?ticks(m):m.terms.slice(0,+W.value).flatMap(t=>t.ids)};
const arr=m=>Object.keys(m.items).map(id=>({id,...m.items[id]})),nm=(m,id)=>{const i=m.items[id];return i.code?i.code+' '+i.label:i.label},tm=c=>Math.ceil(c/PER);
function col(title,sub,rows){const s=el('section');s.append(el('h3',null,title),el('div','mut',sub));const ul=el('ul');rows.forEach(r=>ul.append(el('li',null,r)));if(!rows.length)ul.append(el('li','mut','None.'));s.append(ul);return s}
function draw(){const a=by(F.value),b=by(T.value),done=doneIds();out.textContent='';rank.textContent='';
if(a===b){out.append(el('p','note','Pick two different majors.'));return}
const r=switchCost(arr(a),arr(b),done),stay=a.total-r.doneCredits,extra=tm(r.remaining)-tm(stay),lede=el('p','lede');
lede.textContent=r.doneCredits?r.counted+' of your '+r.doneCredits+' finished credits count toward '+b.name+'.':'Nothing finished yet, so nothing is lost by switching.';
lede.append(el('small',null,r.remaining+' credits left in '+b.name+', against '+stay+' if you stay in '+a.name+'. At '+PER+' credits a term that is '+tm(r.remaining)+' more terms'+(extra>0?', '+extra+' more than staying.':extra<0?', '+(-extra)+' fewer than staying.':', the same as staying.')));
const cols=el('div','cols');cols.append(col('Carries over','The same course is on both roadmaps.',r.carried.map(([x])=>nm(a,x)+' ('+a.items[x].cr+')')),
col('Likely carries','Same elective slot on both roadmaps, or room in free electives.',[...r.likely.map(([x])=>nm(a,x)+' ('+a.items[x].cr+')'),...r.free.map(x=>nm(a,x)+' ('+a.items[x].cr+') as a free elective')]),
col("Doesn't match",'No place for these on the '+b.name+' roadmap.',r.unmatched.map(x=>nm(a,x)+' ('+a.items[x].cr+')')));out.append(lede,cols);
const rows=D.filter(m=>m!==a).map(m=>({m,r:switchCost(arr(a),arr(m),done)})).sort((x,y)=>x.r.remaining-y.r.remaining);
rows.slice(0,${RANK_SHOWN}).forEach(({m,r})=>{const bt=el('button');bt.type='button';bt.append(el('b',null,m.name),el('span',null,r.counted+' count · '+r.remaining+' left'));if(m===b)bt.setAttribute('aria-current','true');
bt.onclick=()=>{T.value=m.slug;draw();out.scrollIntoView({behavior:'smooth',block:'start'})};rank.append(bt)})}
F.onchange=()=>{if(T.value===F.value)T.value=D.find(m=>m.slug!==F.value).slug;fillDone();draw()};T.onchange=W.onchange=draw;fillDone();draw()})();`;

export function renderCompare(roadmaps: Roadmap[], courses: Map<string, CourseInfo>, site?: Site): string {
  const json = JSON.stringify(packCompare(compareData(roadmaps, courses))).replace(/</g, '\\u003c');
  return layout(`Switch majors · ${brand(site)}`, 'See what carries over when you switch between Virginia Tech majors, and how many credits are left.', '../',
    `<a href="index.html">Degree planner</a>`,
    `<h1>What if I switch majors?</h1><p class="sub">Pick where you are, where you'd go, and what you've finished.</p>
<div class="ctl"><label>From <select class="sel" id="from"></select></label><label>To <select class="sel" id="to"></select></label></div>
<div class="ctl"><label>Finished so far <select class="sel" id="done"></select></label></div>
<noscript><p class="note warn">This page needs JavaScript.</p></noscript>
<div id="out" aria-live="polite"></div>
<h2>Where your credits go furthest</h2><p class="mut">The ${RANK_SHOWN} majors with the fewest credits left for you. Tap one to compare.</p><div class="majors" id="rank"></div>
<p class="note">An estimate from the two official roadmaps: same course first, then elective slots with the same name, then free electives. The department you're moving into decides what really counts, and changing majors can have its own requirements. Ask an advisor before you act on this.</p>
<script type="application/json" id="cmp-data">${json}</script>`, site, 'switch', `<script src="../compare.js" defer></script>`);
}

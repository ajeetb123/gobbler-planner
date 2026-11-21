// HTML for every page. Static, no framework. Own design, not modelled on another site:
// a left rail (search + nav), serif headlines, ruled "sheets" instead of boxed cards, and one
// shared chart type, the lane chart: every instructor (or course) is a row on the same GPA axis.
// Client JS: APP_JS (search palette + compare), and PLAN_JS in plan-page.ts.
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
const rmpLink = (name: string, text: string, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(rmpUrl(name))}" target="_blank" rel="noopener noreferrer">${text}</a>`;

export interface Links { course: Map<string, string>; prof: Map<string, string> }

export const CSS = `:root{--paper:#f5f2ea;--sheet:#fffdf8;--ink:#1c2230;--mut:#687083;--rule:#dcd6c8;--acc:#b4470f;--soft:#ece7da;--band:#cfd9dc;--ga:#1d4955;--gb:#417784;--gc:#84aab2;--gd:#bdd0d3;--gf:#dfae93;--gw:#c9c2b2;--warn:#fbefc4}
@media(prefers-color-scheme:dark){:root{--paper:#13151a;--sheet:#1a1d24;--ink:#e9e6df;--mut:#9aa1b0;--rule:#30343e;--acc:#f0935c;--soft:#22262f;--band:#34424a;--ga:#8fd0de;--gb:#5aa3b3;--gc:#3d7480;--gd:#2c4f58;--gf:#a8674a;--gw:#565145;--warn:#3b3212}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:inherit;text-decoration-color:var(--acc);text-underline-offset:3px}a:hover{color:var(--acc)}:focus-visible{outline:2px solid var(--acc);outline-offset:2px;border-radius:4px}
h1,h2,.serif,.num{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,ui-serif,serif}
.shell{display:grid;grid-template-columns:232px minmax(0,1fr);min-height:100vh}
.rail{position:sticky;top:0;height:100vh;padding:26px 20px;border-right:1px solid var(--rule);display:flex;flex-direction:column;gap:18px}
.brand{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:1.5rem;font-weight:700;text-decoration:none;line-height:1.1}.brand i{color:var(--acc);font-style:normal}.brand small{display:block;font:500 .72rem/1.4 system-ui,sans-serif;color:var(--mut);letter-spacing:.02em;margin-top:4px}
.find{display:flex;justify-content:space-between;align-items:center;width:100%;font:inherit;color:var(--mut);background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:9px 12px;cursor:pointer;text-align:left}.find:hover{border-color:var(--acc);color:var(--ink)}
kbd{font:600 .72rem system-ui,sans-serif;border:1px solid var(--rule);border-bottom-width:2px;border-radius:5px;padding:0 6px;background:var(--paper);color:var(--mut)}
.nav{display:flex;flex-direction:column;gap:2px}.nav a{text-decoration:none;padding:8px 10px;border-radius:8px;border-left:3px solid transparent}.nav a:hover{background:var(--soft);color:var(--ink)}.nav a[aria-current]{border-left-color:var(--acc);background:var(--soft);font-weight:600}
.rail .fine{margin-top:auto;font-size:.72rem;color:var(--mut);line-height:1.45}
main{padding:34px clamp(16px,4vw,56px) 90px;max-width:940px;width:100%}
.crumb{font-size:.8rem;color:var(--mut);letter-spacing:.06em;text-transform:uppercase}.crumb a{text-decoration:none}
h1{font-size:clamp(1.7rem,3.4vw,2.5rem);line-height:1.15;margin:.2em 0 .1em;font-weight:700;letter-spacing:-.01em}.sub{font-size:1.1rem;color:var(--mut);margin:0 0 1em}
h2{font-size:1.25rem;margin:2.4em 0 .2em;padding-top:.7em;border-top:2px solid var(--ink)}h2+.mut{margin-top:0}.mut{color:var(--mut);font-size:.88rem}
.lede{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:1.3rem;line-height:1.4;margin:.9em 0;padding-left:14px;border-left:3px solid var(--acc)}.lede small{display:block;font:400 .9rem/1.5 system-ui,sans-serif;color:var(--mut);margin-top:4px}
.facts{display:flex;flex-wrap:wrap;gap:0;margin:1.2em 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}.fact{flex:1 1 130px;padding:12px 16px 12px 0;margin-right:16px;border-right:1px solid var(--rule)}.fact:last-child{border:0;margin:0}
.num{display:block;font-size:2rem;line-height:1.1;font-weight:700}.fact span{font-size:.78rem;color:var(--mut)}
.mix{display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--soft)}.mix i{display:block;height:100%}.mA{background:var(--ga)}.mB{background:var(--gb)}.mC{background:var(--gc)}.mD{background:var(--gd)}.mF{background:var(--gf)}.mW{background:repeating-linear-gradient(135deg,var(--gw) 0 4px,transparent 4px 7px)}
.key{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.8rem;color:var(--mut);margin-top:6px}.key b{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}
.lanes{margin-top:10px}.lane,.axis{border-bottom:1px solid var(--rule)}.lane summary,.axis{display:grid;grid-template-columns:30px minmax(90px,190px) 34px minmax(0,1fr) 46px;gap:10px;align-items:center;padding:9px 0}.nopick summary,.nopick.axis{grid-template-columns:minmax(110px,230px) 34px minmax(0,1fr) 46px}
.lane summary{list-style:none;cursor:pointer}.lane summary::-webkit-details-marker{display:none}.lane summary:hover .who{color:var(--acc)}.lane[open]{background:var(--sheet)}.lane[open] summary{border-bottom:1px dashed var(--rule)}
.who{font-weight:600;overflow:hidden;text-overflow:ellipsis}.who small{display:block;font-weight:400;color:var(--mut);font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.val{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.conf{font-size:.5rem;letter-spacing:2px;color:var(--ga);white-space:nowrap}.conf s{text-decoration:none;color:var(--rule)}
.track{position:relative;height:22px}.track:before{content:"";position:absolute;left:0;right:0;top:10px;height:2px;background:var(--soft)}.band{position:absolute;top:6px;height:10px;background:var(--band);border-radius:5px}.dot{position:absolute;top:3px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:var(--ink);border:3px solid var(--paper)}.lane[open] .dot{border-color:var(--sheet)}.cm{position:absolute;top:0;bottom:0;width:0;border-left:1.5px dashed var(--acc)}
.axis{color:var(--mut);font-size:.72rem;border-bottom:1px solid var(--ink);padding:4px 0}.ticks{position:relative;height:14px}.ticks span{position:absolute;transform:translateX(-50%)}
.pick{width:28px;height:28px;border-radius:50%;border:1.5px solid var(--rule);background:none;color:var(--mut);cursor:pointer;font-size:.9rem;line-height:1;padding:0}.pick:hover{border-color:var(--acc);color:var(--acc)}.pick[aria-pressed=true]{background:var(--acc);border-color:var(--acc);color:#fff}
.drawer{padding:12px 4px 16px 40px;font-size:.92rem}.nopick .drawer{padding-left:4px}.drawer p{margin:.5em 0}.go{font-weight:600;text-decoration:none;color:var(--acc);white-space:nowrap}.go:hover{text-decoration:underline}
#cmp{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:5;width:min(620px,calc(100vw - 28px));background:var(--ink);color:var(--paper);border-radius:14px;padding:13px 18px;box-shadow:0 10px 30px #0004;font-size:.95rem}
.note{background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:11px 14px;margin:14px 0;font-size:.92rem}.warn{background:var(--warn);border-color:transparent}
ul.plain{list-style:none;padding:0;margin:0}.cols{columns:3 170px}.cols li{padding:3px 0}table{border-collapse:collapse;font-size:.85rem;margin:6px 0}td,th{padding:2px 16px 2px 0;text-align:left}th{color:var(--mut);font-weight:500}
details.more>summary{cursor:pointer;color:var(--mut);font-size:.88rem;margin-top:14px}svg{max-width:100%;height:auto}
.rows a{display:grid;grid-template-columns:86px minmax(0,1fr) 120px 44px;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--rule);text-decoration:none}.rows a:hover .t{color:var(--acc)}.rows .c{font-weight:700}.rows .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hero h1{font-size:clamp(2.1rem,5vw,3.4rem);max-width:15ch}.hero h1 em{font-style:italic;color:var(--acc)}.hero p{font-size:1.1rem;color:var(--mut);max-width:52ch}
.ask{display:flex;align-items:center;gap:12px;width:100%;max-width:560px;font:inherit;font-size:1.05rem;color:var(--mut);background:var(--sheet);border:1.5px solid var(--ink);border-radius:14px;padding:15px 18px;cursor:pointer;margin:18px 0 6px;text-align:left}.ask:hover{border-color:var(--acc)}.ask span{flex:1}
.paths{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:0;border-top:2px solid var(--ink);margin-top:2.4em}.paths a{display:block;padding:18px 22px 20px 0;text-decoration:none;border-bottom:1px solid var(--rule)}.paths a+a{padding-left:22px;border-left:1px solid var(--rule)}.paths b{display:block;font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:1.3rem;margin-bottom:4px}.paths span{color:var(--mut);font-size:.93rem}.paths a:hover b{color:var(--acc)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.chips a{border:1px solid var(--rule);border-radius:8px;padding:4px 11px;text-decoration:none;font-size:.9rem;background:var(--sheet)}.chips a:hover{border-color:var(--acc)}
dialog{border:0;border-radius:16px;padding:0;width:min(600px,calc(100vw - 24px));margin-top:10vh;background:var(--sheet);color:var(--ink);box-shadow:0 20px 60px #0005}dialog::backdrop{background:#0b0d1288;backdrop-filter:blur(2px)}
#q{width:100%;font:inherit;font-size:1.1rem;padding:16px 18px;border:0;border-bottom:1px solid var(--rule);background:none;color:var(--ink);outline:none}#r{list-style:none;margin:0;padding:6px;max-height:55vh;overflow:auto}#r a{display:block;padding:8px 12px;border-radius:8px;text-decoration:none}#r a[aria-selected=true],#r a:hover{background:var(--soft);color:var(--ink)}
.grp{font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);padding:10px 12px 2px}.hint{padding:8px 14px;border-top:1px solid var(--rule);font-size:.75rem;color:var(--mut)}
.tabs{display:none}
.seg{display:inline-flex;flex-wrap:wrap;gap:2px;border:1.5px solid var(--ink);border-radius:11px;padding:3px}.seg button{font:inherit;border:0;background:none;color:var(--ink);padding:6px 13px;border-radius:8px;cursor:pointer}.seg button[aria-pressed=true]{background:var(--ink);color:var(--paper);font-weight:600}
.ctl{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}.btn{font:inherit;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);padding:7px 13px;border-radius:9px;cursor:pointer}.btn:hover{border-color:var(--acc)}
.over{display:flex;gap:5px;align-items:flex-end;height:74px;margin:14px 0 4px;border-bottom:1px solid var(--ink)}.over a{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-decoration:none;font-size:.7rem;color:var(--mut);height:100%}.over i{display:block;width:100%;background:var(--gb);border-radius:4px 4px 0 0;min-height:2px}.over .hv i{background:var(--acc)}.over .sm i{background:var(--gc)}
.meter{height:6px;background:var(--soft);border-radius:3px;overflow:hidden}.meter i{display:block;height:6px;background:var(--ga);width:0}
.board{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0 28px}.term{border-top:2px solid var(--ink);padding:10px 0 18px;scroll-margin-top:16px}.term h3{margin:0;font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:1.1rem}.term .load{margin:6px 0 2px}
.it{display:flex;gap:10px;align-items:flex-start;border-top:1px solid var(--rule);padding:8px 0}.it .mid{flex:1;min-width:0}.it .nm{font-size:.94rem}.it.done .nm{text-decoration:line-through;color:var(--mut)}.it input{margin-top:5px;width:16px;height:16px;accent-color:var(--acc)}
.tag{display:inline-block;font-size:.74rem;font-weight:600;border:1px solid var(--rule);border-radius:6px;padding:0 7px;margin:4px 6px 0 0;color:var(--mut)}.tag.hot{border-color:var(--acc);color:var(--acc)}
.mv{display:flex;gap:2px}.mv button{font:inherit;border:1px solid var(--rule);background:none;color:var(--ink);border-radius:7px;width:27px;height:27px;cursor:pointer}.mv button:disabled{opacity:.25;cursor:default}.flag{font-size:.8rem;font-weight:600;color:var(--acc);margin-top:4px}
.sel{font:inherit;padding:7px 10px;border:1px solid var(--rule);border-radius:9px;background:var(--sheet);color:var(--ink);max-width:100%}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 28px;margin-top:1.4em}.cols section{border-top:2px solid var(--ink);padding:10px 0 18px}.cols h3{margin:0 0 4px;font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:1.1rem}.cols ul{list-style:none;margin:0;padding:0;font-size:.92rem}.cols li{border-top:1px solid var(--rule);padding:6px 0}.majors button{font:inherit;color:inherit;background:none;border:0;border-bottom:1px solid var(--rule);display:flex;justify-content:space-between;gap:10px;padding:12px 0;cursor:pointer;text-align:left}.majors button:hover{color:var(--acc)}.it .mut{font-size:.82rem}
[hidden]{display:none!important}.it{cursor:grab}.term.drop{background:var(--soft);outline:2px dashed var(--acc);outline-offset:4px;border-radius:8px}.addc{font-size:.85rem;color:var(--mut);margin-top:8px}.it .lnk{font-size:.8rem;color:var(--mut)}@media print{.addc,.it .lnk{display:none!important}}.ctl label{display:flex;flex-direction:column;gap:2px;max-width:100%;min-width:0;font-size:.88rem;color:var(--mut)}.ctl label .sel{font-size:1rem;color:var(--ink);width:100%;max-width:min(100%,520px);min-width:0;text-overflow:ellipsis}
.askf{display:flex;gap:8px;max-width:640px;margin:14px 0 4px}.askf .sel{flex:1;padding:12px 14px;font-size:1.05rem}.chips button{font:inherit;font-size:.9rem;color:inherit;border:1px solid var(--rule);border-radius:8px;padding:4px 11px;background:var(--sheet);cursor:pointer;text-align:left}.chips button:hover{border-color:var(--acc)}.ans{border-left:3px solid var(--acc);padding:2px 0 2px 14px;margin:18px 0 8px;font-size:1.05rem}.ans p{margin:.5em 0}
.filter{display:block;width:100%;max-width:480px;margin:10px 0 4px;padding:10px 12px}.majors a[hidden]{display:none}.help{margin:10px 0;font-size:.9rem;color:var(--mut)}.help summary{cursor:pointer;color:var(--ink);font-weight:600}.help ul{margin:.5em 0 0;padding-left:1.2em}.help li{margin:.25em 0}.lnk{font:inherit;color:inherit;background:none;border:0;padding:0;text-decoration:underline;text-decoration-color:var(--acc);cursor:pointer}.btn:disabled{opacity:.4;cursor:default}.over .bad span:first-child{color:var(--acc);font-weight:700}.over .bad span:first-child:after{content:" !"}.pulse{outline:2px solid var(--acc);outline-offset:4px;border-radius:6px}
@media print{.rail,.tabs,.ctl,.over,.over+p,.mv,.help,#pal,#conf .lnk,.crumb,#note,#summer,#shared{display:none!important}body{background:#fff}main{padding:0}.board{display:block}.term{break-inside:avoid;padding-bottom:8px}.it{padding:4px 0}a{text-decoration:none}}
.majors .tag{font-style:normal;margin:0 4px 0 0}.col{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:1.15rem;margin:1.6em 0 .4em;scroll-margin-top:16px}.col .mut{font-family:system-ui,sans-serif;font-weight:400}
.majors{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:0 28px;border-top:2px solid var(--ink)}.majors a{display:flex;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid var(--rule);text-decoration:none}.majors a:hover{color:var(--acc)}.majors span{color:var(--mut);font-size:.85rem;white-space:nowrap}
footer{margin-top:4em;padding-top:1em;border-top:1px solid var(--rule);font-size:.8rem;color:var(--mut)}
@media(max-width:820px){.shell{display:block}.rail{position:static;height:auto;flex-direction:row;align-items:center;padding:12px 16px;border-right:0;border-bottom:1px solid var(--rule)}.rail .nav,.rail .fine,.brand small,.find kbd{display:none}.brand{font-size:1.2rem}.find{flex:1}
main{padding:20px 16px 110px}.tabs{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:4;background:var(--sheet);border-top:1px solid var(--rule);padding-bottom:env(safe-area-inset-bottom)}.tabs a,.tabs button{flex:1;font:inherit;font-size:.82rem;border:0;background:none;color:var(--mut);padding:11px 4px;text-align:center;text-decoration:none;cursor:pointer}.tabs [aria-current]{color:var(--acc);font-weight:700}
#cmp{bottom:62px}.lane summary,.axis{grid-template-columns:30px minmax(0,1fr) 34px 46px;grid-template-areas:"p w c v" "t t t t";gap:4px 8px}.nopick summary,.nopick.axis{grid-template-columns:minmax(0,1fr) 34px 46px;grid-template-areas:"w c v" "t t t"}
.pick{grid-area:p}.who{grid-area:w}.conf{grid-area:c}.val{grid-area:v}.track,.ticks{grid-area:t}.axis>:not(.ticks){display:none}.drawer{padding-left:4px}.rows a{grid-template-columns:76px minmax(0,1fr) 44px}.rows .mix{display:none}.facts{display:grid;grid-template-columns:1fr 1fr}.fact{border:0;margin:0}.paths a+a{padding-left:0;border-left:0}}`;

/**
 * Shared script. Search palette: opens from any [data-search] control, "/" or Cmd/Ctrl+K; results are
 * grouped by kind and ranked (starts-with, then word-start, then contains); the group holding the
 * closest match comes first, so "mech" leads with the Mechanical Engineering plan. Arrows and Enter work.
 * Compare: two .pick buttons carry an estimate (data-g) and its spread (data-s, from the 80% range);
 * the bar says how often one section would average higher, treating both as independent normals.
 */
export const APP_JS = `(()=>{const root=document.body.dataset.root,dlg=document.getElementById('pal'),q=document.getElementById('q'),r=document.getElementById('r');let d,sel=0;
// Anonymous usage counts for the owner's dashboard: an event type, this page's name and a short value. Nothing is
// sent if the browser asks not to be tracked (Do Not Track or Global Privacy Control), and nothing breaks if no
// server is listening (the static-only build).
const page=((location.pathname.split('/').pop()||'index.html').replace(/\\.html$/,'')||'index').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,80)||'index';
const quiet=navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
window.gpTrack=(t,v)=>{if(quiet||!navigator.sendBeacon)return;try{navigator.sendBeacon(root+'api/event',new Blob([JSON.stringify({t,p:page,v:v==null?'':String(v).slice(0,120)})],{type:'text/plain'}))}catch{}};
gpTrack('view');
const tb=document.getElementById('theme');if(tb)tb.onclick=()=>{const el=document.documentElement,next=(el.dataset.theme||'light')==='dark'?'light':'dark';el.dataset.theme=next;try{localStorage.setItem('gobblerplan:theme',next)}catch{}};
const open=()=>{if(!dlg.open){dlg.showModal();q.value='';r.textContent='';q.focus()}};
document.querySelectorAll('[data-search]').forEach(b=>b.addEventListener('click',open));
document.addEventListener('keydown',e=>{const t=e.target.tagName;if((e.key==='/'&&t!=='INPUT'&&t!=='TEXTAREA')||((e.metaKey||e.ctrlKey)&&e.key==='k')){e.preventDefault();open()}});
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
const K={c:'Courses',i:'Instructors',m:'Degree plans'},score=(t,s)=>{const l=t.toLowerCase();return l.startsWith(s)?0:(' '+l).includes(' '+s)?1:l.includes(s)?2:-1};
const paint=()=>[...r.querySelectorAll('a')].forEach((a,i)=>a.setAttribute('aria-selected',String(i===sel)));
q.addEventListener('input',async()=>{d??=await(await fetch(root+'search.json')).json();const s=q.value.trim().toLowerCase().replace(/\\s+/g,' ');r.textContent='';sel=0;if(s.length<2)return;
const hits=[];for(const[t,h,k]of d){const sc=score(t,s);if(sc>=0)hits.push([sc,t,h,k])}hits.sort((a,b)=>a[0]-b[0]);let n=0;
const best=k=>Math.min(9,...hits.filter(x=>x[3]===k).map(x=>x[0]));for(const k of['c','i','m'].sort((x,y)=>best(x)-best(y))){const g=hits.filter(x=>x[3]===k).slice(0,8);if(!g.length)continue;const h=document.createElement('li');h.className='grp';h.textContent=K[k];r.append(h);
for(const[,t,href]of g){const li=document.createElement('li'),a=document.createElement('a');a.href=root+href;a.textContent=t;li.append(a);r.append(li);n++}}
if(!n){const li=document.createElement('li');li.className='grp';li.textContent='No match.';r.append(li)}paint()});
const mf=document.getElementById('mf');if(mf)mf.addEventListener('input',()=>{const w=mf.value.toLowerCase().split(/\\s+/).filter(Boolean);let any=false;document.querySelectorAll('.majors').forEach(g=>{let n=0;g.querySelectorAll('a').forEach(a=>{const t=a.textContent.toLowerCase(),ok=w.every(x=>t.includes(x));a.hidden=!ok;if(ok)n++});g.hidden=!n;if(g.previousElementSibling&&g.previousElementSibling.classList.contains('col'))g.previousElementSibling.hidden=!n;if(n)any=true});document.getElementById('mfnone').hidden=any});
q.addEventListener('keydown',e=>{const as=r.querySelectorAll('a');if(e.key==='ArrowDown'){sel=Math.min(sel+1,as.length-1);paint();as[sel]&&as[sel].scrollIntoView({block:'nearest'});e.preventDefault()}else if(e.key==='ArrowUp'){sel=Math.max(sel-1,0);paint();as[sel]&&as[sel].scrollIntoView({block:'nearest'});e.preventDefault()}else if(e.key==='Enter'&&as[sel])location.href=as[sel].href});
const bar=document.getElementById('cmp'),picks=[];if(!bar)return;
const phi=x=>{const t=1/(1+.2316419*Math.abs(x)),p=1-Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*t*(.31938153+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?p:1-p};
document.querySelectorAll('.pick').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const i=picks.indexOf(b);if(i>=0)picks.splice(i,1);else{picks.push(b);if(picks.length>2)picks.shift()}
document.querySelectorAll('.pick').forEach(x=>x.setAttribute('aria-pressed',String(picks.includes(x))));bar.hidden=!picks.length;
if(picks.length<2){bar.textContent=picks.length?'Now pick a second one to compare with '+picks[0].dataset.n+'.':'';return}
let[a,b2]=picks.map(p=>({n:p.dataset.n,g:+p.dataset.g,s:+p.dataset.s}));if(b2.g>a.g)[a,b2]=[b2,a];const gap=a.g-b2.g,t=Math.round(phi(gap/Math.hypot(a.s,b2.s))*10);
bar.textContent=t<=5||gap<.005?'Too close to call. A section under '+a.n+' and one under '+b2.n+' are expected to land about the same.':'A section under '+a.n+' would average higher than one under '+b2.n+(t>=10?' more than 9':' about '+t)+' times in 10. Expected gap: '+gap.toFixed(2)+' GPA.'}))})();`;

/**
 * Cache busting. Stylesheets and scripts are cached by browsers for a long time, so every page links them as
 * "style.css?v=<version>". The build sets the version to a hash of the assets' contents: when they change, the
 * address changes, and nobody is left with a new page and an old stylesheet.
 */
let assetVersion = 'dev';
export const setAssetVersion = (v: string) => { assetVersion = v; };

type Tab = 'grades' | 'plan' | 'switch' | 'ask' | 'about';

/** VT's own grade distribution page and the RateMyProfessors school page: the planner-only build links out to both. */
export const UDC_URL = 'https://udc.vt.edu/irdata/data/courses/grades';
export const RMP_SCHOOL_URL = `https://www.ratemyprofessors.com/school/${RMP_SCHOOL_ID}`;
/** Site name. Without grade data (`site` undefined) the build is the planner alone. */
export const brand = (site?: Site) => (site ? 'Gobbler Grades' : 'Gobbler Plan');
/** Shown on every page. The site may name Virginia Tech to say what it covers, never to suggest it speaks for the university. */
/** What the site records, in one place so every page says the same thing. Keep in step with server/app.ts and server/db.ts. */
export const PRIVACY = 'Your plan stays in your browser. The site counts page views and feature use anonymously: no names, no accounts, no cookies, and no address is stored. Turn on Do Not Track or Global Privacy Control in your browser and nothing is counted.';
export const DISCLAIMER = 'An independent student project. Not affiliated with, endorsed by, or sponsored by Virginia Tech.';

export function layout(title: string, desc: string, root: string, crumb: string, body: string, site?: Site, tab: Tab = 'grades', extraScript = ''): string {
  const cur = (t: Tab) => (t === tab ? ' aria-current="page"' : '');
  const nav = `${site ? `<a href="${root}index.html"${cur('grades')}>Grades</a>` : ''}<a href="${root}plan/index.html"${cur('plan')}>Degree planner</a><a href="${root}plan/compare.html"${cur('switch')}>Switch majors</a><a href="${root}ask.html"${cur('ask')}>Ask</a>`;
  const source = site
    ? `Source: Virginia Tech University DataCommons grade distributions, ${termLabel(site.dataFirst)} to ${termLabel(site.dataLast)}. Instructors appear by last name only, and sections with fewer than 5 graded students are missing. Expected GPA is for one section's average, not for an individual student. ${DISCLAIMER} Not affiliated with RateMyProfessors. <a href="${root}about.html">How the numbers are made</a>.`
    : `Roadmaps and prerequisites come from the Virginia Tech 2026-2027 Academic Catalog. This is a planning aid, not a degree audit: confirm your plan with your advisor and the university's own planning tools. ${DISCLAIMER} <a href="${root}about.html">How it works</a>.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg transform='translate(16 26)'%3E%3Cellipse rx='3.8' ry='11' cy='-11' fill='%23ffb648' transform='rotate(-62)'/%3E%3Cellipse rx='3.8' ry='12' cy='-12' fill='%2312b886' transform='rotate(-31)'/%3E%3Cellipse rx='3.8' ry='13' cy='-13' fill='%233757f5'/%3E%3Cellipse rx='3.8' ry='12' cy='-12' fill='%2312b886' transform='rotate(31)'/%3E%3Cellipse rx='3.8' ry='11' cy='-11' fill='%23ffb648' transform='rotate(62)'/%3E%3Ccircle r='5' cy='-1' fill='%23131a2e'/%3E%3C/g%3E%3C/svg%3E"><meta name="description" content="${esc(desc)}"><link rel="stylesheet" href="${root}style.css"><script src="${root}theme.js"></script></head><body data-root="${root}">
<header class="top"><a class="brand" href="${root}index.html"><svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><g transform="translate(16 25)"><ellipse rx="3.6" ry="11" cy="-11" fill="#ffb648" transform="rotate(-62)"/><ellipse rx="3.6" ry="12" cy="-12" fill="#12b886" transform="rotate(-31)"/><ellipse rx="3.6" ry="13" cy="-13" fill="#3757f5"/><ellipse rx="3.6" ry="12" cy="-12" fill="#12b886" transform="rotate(31)"/><ellipse rx="3.6" ry="11" cy="-11" fill="#ffb648" transform="rotate(62)"/><circle r="5" cy="-1" fill="#131a2e"/></g></svg>${brand(site)}</a>
<nav class="nav" aria-label="Sections">${nav}<a href="${root}about.html"${cur('about')}>How it works</a></nav><span class="grow"></span>
<button type="button" class="find" data-search><span>Search</span><kbd>/</kbd></button><button type="button" class="icon" id="theme" aria-label="Switch between dark and light" title="Dark or light">\u25D0</button></header>
<main${tab === 'plan' && extraScript ? ' class="wide"' : ''}>${crumb ? `<nav class="crumb" aria-label="Breadcrumb">${crumb}</nav>` : ''}
${body}
<footer>${site ? `Official grade data, ${termLabel(site.dataFirst)} to ${termLabel(site.dataLast)}. ` : ''}${source} <a href="${root}about.html#privacy">Privacy</a>.</footer></main>
<nav class="tabs" aria-label="Sections">${nav}<button type="button" data-search>Search</button></nav>
<dialog id="pal" aria-label="Search"><input id="q" type="search" placeholder="${site ? 'Course, last name or major' : 'Search a major'}" autocomplete="off" aria-label="Search"><ul id="r"></ul><div class="hint">↑ ↓ to move · Enter to open · Esc to close</div></dialog>
<script src="${root}app.js" defer></script>${extraScript}</body></html>`.replace(/((?:href|src)="[^"]*\.(?:css|js))"/g, `$1?v=${assetVersion}"`);
}

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const span = (s: Span) => (s.terms === 1 ? `1 term, ${termLabel(s.firstTerm)}` : `${s.terms} terms, ${termLabel(s.firstTerm)} to ${termLabel(s.lastTerm)}`);

/** Share of graded students with an A or B, in percent. */
export const bOrBetter = (d: Dist) => (d.students ? ((d.bars.find((b) => b.label === 'A')!.n + d.bars.find((b) => b.label === 'B')!.n) / d.students) * 100 : 0);

/** Grade mix as one stacked strip (A to F, then withdrawals), with a text key underneath. */
function mix(d: Dist, key = true): string {
  const order = ['A', 'B', 'C', 'D', 'F', 'W'].map((l) => d.bars.find((b) => b.label === l)!);
  const total = order.reduce((a, b) => a + b.n, 0) || 1;
  const pct = (n: number) => (n / total) * 100;
  const text = order.map((b) => `${b.label} ${pct(b.n).toFixed(0)}%`).join(', ');
  return `<div class="mix" role="img" aria-label="Grade mix: ${text}">${order.map((b) => `<i class="m${b.label}" style="width:${pct(b.n).toFixed(1)}%"></i>`).join('')}</div>` +
    (key ? `<div class="key">${order.filter((b) => pct(b.n) >= 0.5).map((b) => `<span><b class="m${b.label}"></b>${b.label === 'W' ? 'Withdrew' : b.label} ${pct(b.n).toFixed(0)}%</span>`).join('')}</div>` : '');
}

// Shared GPA axis for every lane. Almost every section GPA in the data sits between 1.5 and 4.0.
const AX_LO = 1.5, AX_HI = 4;
const pos = (g: number) => (Math.min(1, Math.max(0, (g - AX_LO) / (AX_HI - AX_LO))) * 100).toFixed(1);
const axis = (pick: boolean) => `<div class="axis${pick ? '' : ' nopick'}" aria-hidden="true">${pick ? '<span></span>' : ''}<span></span><span></span><div class="ticks">${[2, 2.5, 3, 3.5, 4].map((t) => `<span style="left:${pos(t)}%">${t.toFixed(1)}</span>`).join('')}</div><span></span></div>`;
function track(e: Estimate, mark: number): string {
  const l = Number(pos(e.lo)), r = Number(pos(e.hi));
  return `<div class="track" role="img" aria-label="Expected ${e.gpa.toFixed(2)}, 80% range ${e.lo.toFixed(2)} to ${e.hi.toFixed(2)}"><span class="band" style="left:${l}%;width:${(r - l).toFixed(1)}%"></span><span class="cm" style="left:${pos(mark)}%"></span><span class="dot" style="left:${pos(e.gpa)}%"></span></div>`;
}
/** How much history backs an estimate, as 0 to 3 filled dots. Same cut points as the range buckets. */
function conf(students: number): string {
  const n = students === 0 ? 0 : students < 50 ? 1 : students < 200 ? 2 : 3;
  const word = ['No history', 'Thin history', 'Fair history', 'Deep history'][n];
  return `<span class="conf" title="${word}: ${num(students)} past students">${'●'.repeat(n)}<s>${'●'.repeat(3 - n)}</s></span>`;
}
/** An 80% range spans about 2.563 standard deviations of a normal. Used by the compare bar. */
const sigma = (e: Estimate) => ((e.hi - e.lo) / 2.563).toFixed(3);
const pick = (name: string, e: Estimate) => `<button type="button" class="pick" aria-pressed="false" aria-label="Compare ${esc(name)}" title="Compare" data-n="${esc(name)}" data-g="${e.gpa.toFixed(3)}" data-s="${sigma(e)}">⇄</button>`;

function sparkline(trend: CoursePage['trend']): string {
  if (trend.length < 2) return '';
  const W = 720, H = 110, P = 24;
  const lo = Math.min(...trend.map((t) => t.gpa)) - 0.1, hi = Math.max(...trend.map((t) => t.gpa)) + 0.1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (trend.length - 1);
  const y = (g: number) => H - P - ((g - lo) / (hi - lo)) * (H - 2 * P - 8);
  const pts = trend.map((t, i) => `${x(i).toFixed(0)},${y(t.gpa).toFixed(0)}`).join(' ');
  const labels = trend.map((t, i) =>
    `<circle cx="${x(i).toFixed(0)}" cy="${y(t.gpa).toFixed(0)}" r="3.5" fill="var(--ink)"/><text x="${x(i).toFixed(0)}" y="${(y(t.gpa) - 9).toFixed(0)}" text-anchor="middle" font-size="11" fill="currentColor">${t.gpa.toFixed(2)}</text>` +
    (i === 0 || i === trend.length - 1 ? `<text x="${x(i).toFixed(0)}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : 'end'}" font-size="11" fill="currentColor" opacity=".6">${termLabel(t.term)}</text>` : '')).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Course average GPA by term"><polyline points="${pts}" fill="none" stroke="var(--gb)" stroke-width="2"/>${labels}</svg>`;
}

const HEADLINE: Record<Verdict, string> = {
  barely: 'Any section is about the same.',
  some: 'Who teaches it makes a modest difference.',
  matters: 'Who teaches it matters here.',
  unknown: 'Too little history to compare instructors.',
};
const VERDICT: Record<Verdict, (c: CoursePage) => string> = {
  barely: (c) => `Instructor choice barely matters for grades: the ${c.spread.n} recent instructors with enough history all land between ${c.spread.lo.toFixed(2)} and ${c.spread.hi.toFixed(2)}, less than the normal swing from one section to the next.`,
  some: (c) => `Recent instructors with enough history span ${c.spread.lo.toFixed(2)} to ${c.spread.hi.toFixed(2)}, and their ranges overlap a lot.`,
  matters: (c) => `Instructor choice matters for grades: recent instructors with enough history span ${c.spread.lo.toFixed(2)} to ${c.spread.hi.toFixed(2)}, a gap of ${c.spread.spread.toFixed(2)} GPA points.`,
  unknown: () => `Fewer than two recent instructors have 30 or more past students in this course.`,
};

export function renderCourse(c: CoursePage, site: Site, links: Links): string {
  const next = termLabel(site.target);
  const profHref = (key: string) => `../prof/${links.prof.get(key)}.html`;
  const lanes = c.instructors.map((i) => `<details class="lane"><summary>${pick(i.name, i)}<span class="who">${esc(i.name)}${i.ambiguous ? ' ⚠' : ''}</span>${conf(i.students)}${track(i, c.mean)}<span class="val">${i.gpa.toFixed(2)}</span></summary>
<div class="drawer"><p>Expected section average <b>${i.gpa.toFixed(2)}</b>, likely between ${i.lo.toFixed(2)} and ${i.hi.toFixed(2)}. ${i.students === 0 ? 'No usable history here, so this is the course average with a wider range.' : `Based on ${plural(i.sections, 'section')}; ${span(i)}.`}</p>
${mix(i.dist)}<p><b>${bOrBetter(i.dist).toFixed(0)}%</b> of ${num(i.dist.students)} students got a B or higher. Plain GPA given: ${i.dist.gpa.toFixed(2)}.</p>
${i.ambiguous ? `<p class="note warn">This last name may cover more than one person (${esc(i.reason)}).</p>` : ''}<p><a class="go" href="${profHref(i.key)}">All courses under ${esc(i.name)} →</a> &nbsp; ${rmpLink(i.name, 'Reviews on RateMyProfessors ↗', 'go')}</p></div></details>`).join('\n');
  const body = `<h1>${esc(c.course)}</h1><p class="sub">${esc(c.title)}</p>
<p class="lede">${HEADLINE[c.spread.verdict]}<small>${VERDICT[c.spread.verdict](c)}</small></p>
<div class="facts"><div class="fact"><b class="num">${c.mean.toFixed(2)}</b><span>course GPA, recent terms weighted</span></div><div class="fact"><b class="num">${bOrBetter(c.dist).toFixed(0)}%</b><span>got a B or higher</span></div><div class="fact"><b class="num">${(c.withdrawRate * 100).toFixed(1)}%</b><span>withdrew</span></div><div class="fact"><b class="num">${c.typicalSize}</b><span>students in a typical section</span></div></div>
${mix(c.dist)}<p class="mut">Grades given over the last ${Math.min(4, c.trend.length)} offered terms (${num(c.dist.students)} students). ${num(c.students)} graded since ${termLabel(c.firstTerm)}.</p>
<h2>Expected section GPA for ${next}</h2>
<p class="mut">One row per instructor, by name. Dot = expected average. Shaded band = where 4 in 5 sections land. Dashed line = course average. Dots after the name = how much history backs it. Tap a row for detail, or tap ⇄ on two rows to compare them.</p>
<div class="lanes">${axis(true)}
${lanes || `<p class="note">No instructor has taught this course in the two years before ${next}.</p>`}
<details class="lane"><summary>${pick('a new instructor', c.unknown)}<span class="who">Someone new<small>or not listed</small></span>${conf(0)}${track(c.unknown, c.mean)}<span class="val">${c.unknown.gpa.toFixed(2)}</span></summary><div class="drawer"><p>Nothing predicts a first-time pairing better than the course average, so that is what this shows, with a wider range (${c.unknown.lo.toFixed(2)} to ${c.unknown.hi.toFixed(2)}).</p></div></details></div>
<p class="note">Which instructor has your section? Check your own registration in the university's registration system. This site does not have next term's assignments.</p>
<h2>How the course average has moved</h2>${sparkline(c.trend)}
${c.earlier.length ? `<details class="more"><summary>Taught this before ${termLabel(site.target - 4)} (${c.earlier.length})</summary><ul class="plain cols">${c.earlier.map((e) => `<li><a href="${profHref(e.key)}">${esc(e.name)}</a> <span class="mut">${termLabel(e.lastTerm)}</span></li>`).join('')}</ul></details>` : ''}
<div id="cmp" role="status" hidden></div>`;
  return layout(`${c.course} grades by instructor · ${brand(site)}`, `${c.course} ${c.title}: grades given and expected section GPA by instructor, from official VT grade data.`, '../',
    `<a href="../index.html">Grades</a> / <a href="../subject/${esc(c.subject)}.html">${esc(c.subject)}</a>`, body, site);
}

export function renderProf(p: ProfPage, site: Site, links: Links): string {
  const next = termLabel(site.target);
  const students = p.panels.reduce((a, x) => a + x.dist.students, 0);
  const top = p.ambiguous || !p.dist
    ? `<p class="note warn"><b>This last name may cover more than one person</b> (${esc(p.reason)}). The grade data has last names only, so each course below is shown on its own and nothing is added up across courses. Confirm the full name in the university's registration system.</p>`
    : `<div id="overall"><div class="facts"><div class="fact"><b class="num">${p.dist.gpa.toFixed(2)}</b><span>GPA given, all courses</span></div><div class="fact"><b class="num">${bOrBetter(p.dist).toFixed(0)}%</b><span>got a B or higher</span></div><div class="fact"><b class="num">${num(students)}</b><span>students graded</span></div><div class="fact"><b class="num">${p.panels.length}</b><span>${p.panels.length === 1 ? 'course' : 'courses'}</span></div></div>
${mix(p.dist)}<p class="mut">Totals include courses they may not teach anymore.${p.effect !== undefined ? ` Sections under this name ran about ${Math.abs(p.effect).toFixed(2)} GPA ${p.effect >= 0 ? 'above' : 'below'} the course averages; gaps near 0.05 are noise.` : ''}</p></div>`;
  const lanes = p.panels.map((x) => `<details class="lane nopick"><summary><span class="who">${esc(x.course)}<small>${esc(x.title)}</small></span>${conf(x.students)}${track(x, x.courseMean)}<span class="val">${x.gpa.toFixed(2)}</span></summary>
<div class="drawer"><p>Expected section average <b>${x.gpa.toFixed(2)}</b>, likely between ${x.lo.toFixed(2)} and ${x.hi.toFixed(2)}. The course as a whole averages ${x.courseMean.toFixed(2)}. Taught ${span(x)}.</p>
${mix(x.dist)}<p><b>${bOrBetter(x.dist).toFixed(0)}%</b> of ${num(x.dist.students)} students got a B or higher. Plain GPA given: ${x.dist.gpa.toFixed(2)}.</p>
<table><tr><th>Term</th><th>Section GPA</th><th>Students</th></tr>${x.history.map((h) => `<tr><td>${termLabel(h.term)}</td><td>${h.gpa.toFixed(2)}</td><td>${h.students}</td></tr>`).join('')}</table>
<p><a class="go" href="../course/${links.course.get(x.course)}.html">Everyone who teaches ${esc(x.course)} →</a></p></div></details>`).join('\n');
  const body = `<h1>${esc(p.name)}</h1><p class="sub">${esc(p.subject)} · grades only. ${rmpLink(p.name, 'Read reviews on RateMyProfessors ↗', 'go')}</p>${top}
<h2>By course, for ${next}</h2>
<p class="mut">Dot = expected section average. Shaded band = where 4 in 5 sections land. Dashed line = that course's average, so a dot to its right means sections under this name ran above the course. Tap a row for detail.</p>
<div class="lanes">${axis(false)}
${lanes}</div>
<p class="mut">The RateMyProfessors search can return several people with this last name: match the department and first name.</p>`;
  return layout(`${p.name} (${p.subject}) grades · ${brand(site)}`, `Grades given by ${p.name} in ${p.subject} at Virginia Tech, by course, from official grade data.`, '../',
    `<a href="../index.html">Grades</a> / <a href="../subject/${esc(p.subject)}.html">${esc(p.subject)}</a>`, body, site);
}

export function renderSubject(subject: string, site: Site, links: Links): string {
  const cs = site.courses.filter((c) => c.subject === subject);
  const ps = site.profs.filter((p) => p.subject === subject).sort((a, b) => a.name.localeCompare(b.name));
  return layout(`${subject} courses and instructors · ${brand(site)}`, `Grades for ${subject} courses at Virginia Tech.`, '../', `<a href="../index.html">Grades</a>`,
    `<h1>${esc(subject)}</h1><p class="sub">${plural(cs.length, 'course')}, ${plural(ps.length, 'instructor name')}</p>
<h2>Courses</h2><p class="mut">Strip = grade mix over the last 4 offered terms. Number = GPA given.</p><div class="rows">${cs.map((c) => `<a href="../course/${links.course.get(c.course)}.html"><span class="c">${esc(c.course)}</span><span class="t">${esc(c.title)}</span>${mix(c.dist, false)}<span class="val">${c.dist.gpa.toFixed(2)}</span></a>`).join('')}</div>
<h2>Instructors</h2><ul class="plain cols">${ps.map((p) => `<li><a href="../prof/${links.prof.get(p.key)}.html">${esc(p.name)}</a>${p.ambiguous ? ' ⚠' : ''}</li>`).join('')}</ul>`, site);
}

export function renderIndex(site: Site, links: Links, majors: number): string {
  const subjects = [...new Set(site.courses.map((c) => c.subject))].sort();
  const popular = [...site.courses].sort((a, b) => b.students - a.students).slice(0, 12).sort((a, b) => a.course.localeCompare(b.course, 'en', { numeric: true }));
  return layout(`${brand(site)}: unofficial Virginia Tech grades and degree planner`, 'Grades by course and instructor from official Virginia Tech data, plus a degree planner built on the official roadmaps.', '', '',
    `<div class="hero"><h1>Know the class <em>before</em> you take it.</h1>
<p>Real grades for ${num(site.courses.length)} Virginia Tech courses and ${num(site.profs.length)} instructor names, and a planner that lays out your whole degree with those numbers in view.</p>
<button type="button" class="ask" data-search><span>Search a course, a last name or a major</span><kbd>/</kbd></button></div>
<div class="paths"><a href="#browse"><b>Look up grades</b><span>See what a course gives, how each instructor compares on one chart, and whether the choice even matters.</span></a>
<a href="plan/index.html"><b>Plan your degree</b><span>Start from your major's official roadmap. Pick 3 to 5 years, rebalance terms, and tick off what's done. ${majors} majors so far.</span></a></div>
<h2>Most-taken courses</h2><div class="chips">${popular.map((c) => `<a href="course/${links.course.get(c.course)}.html" title="${esc(c.title)}">${esc(c.course)}</a>`).join('')}</div>
<h2 id="browse">Browse by subject</h2><div class="chips">${subjects.map((s) => `<a href="subject/${esc(s)}.html">${esc(s)}</a>`).join('')}</div>`, site);
}

export function renderAbout(site: Site): string {
  const p = site.params;
  return layout(`How it works · ${brand(site)}`, 'Method and backtest behind the Virginia Tech grade estimates.', '', '',
    `<h1>How it works</h1><p class="sub">What each number means, how it was checked, and where it stops.</p>
<h2>Grade mix, "B or higher", GPA given</h2><p>Plain facts: the grades that were given, added up over the terms named next to them. Withdrawals are shown as a hatched segment.</p>
<h2>Expected section GPA</h2><p>An estimate of the average GPA of one section next term (${termLabel(site.target)}) under a given instructor name. It is not a prediction of your grade. It differs from the plain GPA in four ways:</p>
<ul><li>Small samples are pulled toward the course average (prior worth ${p.kIC} students).</li><li>Each term back counts ${p.decay} times the one after it, so recent terms weigh more.</li><li>An instructor's record in other courses is used only when the last name is not flagged as possibly several people.</li><li>The shaded band comes from how far past estimates missed, grouped by amount of history and section size.</li></ul>
<h2>The compare sentence</h2><p>When you pick two instructors, the page turns their estimates and bands into "would average higher about N times in 10". It treats the two sections as independent and bell-shaped, which is an approximation. Read it as a rough guide.</p>
<h2>How it was checked</h2><p>Each term from Fall 2022 to Spring 2024 was predicted using only earlier terms: 15,122 undergraduate sections, 579,589 graded students. Average error was 0.185 GPA points against 0.193 for the plain instructor average (3.7% lower, 95% interval 2.8% to 4.6%). The bands contained the real result 79.7% of the time against a target of 80%. For first-time instructor and course pairings nothing beat the course average, and the page says so.</p>
<h2>The degree planner</h2><p>Roadmaps come from the 2026-2027 Virginia Tech catalog. The 4-year view is the official plan. Other lengths rearrange it and keep each subject's courses in order, but they do not check prerequisites or which term a course is offered.</p>
<h2>Limits</h2><ul><li>Grades are not teaching quality. This says nothing about clarity, fairness or workload. Each instructor links to a RateMyProfessors search for that.</li><li>Last names only: a flagged name may be more than one person.</li><li>Sections with fewer than 5 graded students are missing from the source.</li><li>Next term's instructor assignments are not on this site.</li></ul>`, site, 'about');
}

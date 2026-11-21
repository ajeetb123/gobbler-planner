// "Ask" page: a question box answered in the browser by src/ask/engine.ts. The knowledge base (ask.json) is
// fetched once when the page opens; questions never leave the browser.
import { askEngine } from '../ask/engine.ts';
import { brand, layout } from './render.ts';
import type { Site } from './model.ts';

export const EXAMPLES = [
  'What do I need before CS 3214?',
  'What does MATH 2114 unlock?',
  'Which majors require PHYS 2305?',
  'Is STAT 4714 required for Electrical Engineering?',
  'What do I take first year in Psychology?',
  'How many credits is Mechanical Engineering?',
  'organic chemistry prerequisites',
];

/**
 * The question is kept in the URL hash (#q=...), so an answer can be bookmarked or shared and the browser's
 * back button works. A hash is never sent to the server.
 */
export const ASK_JS = `(()=>{const E=(${askEngine.toString()})();
const root=document.body.dataset.root,$=id=>document.getElementById(id),el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const q=$('aq'),out=$('aout');let ix;
const ready=fetch(root+'ask.json').then(r=>r.json()).then(d=>{ix=E.buildIndex(d)}).catch(()=>{out.textContent='Could not load the course data. Reload the page to try again.'});
function show(text){out.textContent='';if(!ix||!text.trim())return;const a=E.answer(ix,text);gpTrack('ask',a.intent);if(a.intent==='none')gpTrack('ask-miss',text);
const box=el('div','ans');a.lines.forEach(l=>box.append(el('p',null,l)));out.append(box);
if(a.sources.length){const s=el('p','mut','Sources: ');a.sources.forEach((x,i)=>{const l=el('a',null,x.label+(x.external?' \\u2197':''));l.href=x.external?x.href:root+x.href;if(x.external){l.target='_blank';l.rel='noopener noreferrer'}s.append(l,i<a.sources.length-1?' \\u00b7 ':'')});out.append(s)}
const rel=a.related.filter(h=>h.score>0);if(rel.length){out.append(el('h2',null,'Closest matches'));const g=el('div','chips');rel.forEach(h=>{const b=el('button',null,h.doc.k==='c'?h.doc.id+' '+h.doc.title:h.doc.title);b.type='button';b.onclick=()=>ask(h.doc.k==='c'?h.doc.id:h.doc.title+' plan');g.append(b)});out.append(g)}}
function ask(text){q.value=text;history.replaceState(null,'','#q='+encodeURIComponent(text));ready.then(()=>show(text))}
$('aform').addEventListener('submit',e=>{e.preventDefault();ask(q.value)});
document.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.q)));
const start=new URLSearchParams(location.hash.slice(1)).get('q');if(start)ask(start);else q.focus()})();`;

export function renderAsk(site?: Site): string {
  return layout(`Ask · ${brand(site)}`, 'Ask about Virginia Tech course prerequisites, what a course unlocks, and which majors need it. Answers come from catalog facts.', '', '',
    `<div class="hero"><h1>Ask about <em>courses and majors</em>.</h1><p>Type a question. The answer is put together from catalog facts this site already holds, and it names its sources.</p></div>
<form id="aform" class="askf" role="search"><input class="sel" id="aq" type="search" placeholder="For example: what do I need before CS 3214?" aria-label="Your question" autocomplete="off"><button type="submit" class="btn">Ask</button></form>
<div class="chips">${EXAMPLES.map((x) => `<button type="button" data-q="${x}">${x}</button>`).join('')}</div>
<noscript><p class="note warn">Ask needs JavaScript.</p></noscript>
<div id="aout" aria-live="polite"></div>
<p class="note"><b>How this works.</b> No AI model is involved. Your question is matched against 2,000 or so courses and degree plans with a search ranking built for this site, and the answer is assembled by fixed rules from the facts stored for the best match. The answer is worked out in your browser. A question that finds no match is saved, with nothing identifying you, so the site can learn to answer it (<a href="about.html#privacy">privacy</a>). It can pick the wrong course or major, so check "Closest matches" and the catalog link, and ask your advisor before you rely on it.</p>`, site, 'ask', `<script src="ask.js" defer></script>`);
}

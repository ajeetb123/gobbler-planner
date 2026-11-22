// "Ask" page: a question box answered in the browser by src/ask/engine.ts. The knowledge base (ask.json) is
// fetched once when the page opens; questions never leave the browser.
import { askEngine } from '../ask/engine.ts';
import { ragGrounded, ragMessages, RAG_OFF_TOPIC } from '../ask/rag.ts';
import { brand, layout } from './render.ts';
import type { Site } from './model.ts';

/**
 * The language model for AI answers, run in the visitor's browser by WebLLM (WebGPU). Two builds of the same
 * model: 16-bit when the graphics card supports it (smaller, faster), 32-bit otherwise. About 1.8 to 2 GB; the 1B model was tried first and was wrong too often (see skills.md).
 * Ids come from the library's own list (node_modules/@mlc-ai/web-llm, prebuiltAppConfig).
 */
export const MODEL_F16 = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
export const MODEL_F32 = 'Llama-3.2-3B-Instruct-q4f32_1-MLC';

export const EXAMPLES = [
  'I have CS 2114 and CS 2505. Can I take CS 3114?',
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
const ragMessages=${ragMessages.toString()};const ragGrounded=${ragGrounded.toString()};const OFF_TOPIC=${RAG_OFF_TOPIC.toString()};
// The version tag on this script's own address, reused for the model library so it is cached the same way.
const VER=document.currentScript?new URL(document.currentScript.src).search:'';
const root=document.body.dataset.root,$=id=>document.getElementById(id),el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const q=$('aq'),out=$('aout');let ix;
const ready=fetch(root+'ask.json').then(r=>r.json()).then(d=>{ix=E.buildIndex(d)}).catch(()=>{out.textContent='Could not load the course data. Reload the page to try again.'});
function show(text){out.textContent='';if(!ix||!text.trim())return;const a=E.answer(ix,text);gpTrack('ask',a.intent);if(a.intent==='none')gpTrack('ask-miss',text);const wantAi=aiOn()&&a.lines.length;
const box=el('div','ans');a.lines.forEach(l=>box.append(el('p',null,l)));out.append(box);
if(a.sources.length){const s=el('p','mut','Sources: ');a.sources.forEach((x,i)=>{const l=el('a',null,x.label+(x.external?' \\u2197':''));l.href=x.external?x.href:root+x.href;if(x.external){l.target='_blank';l.rel='noopener noreferrer'}s.append(l,i<a.sources.length-1?' \\u00b7 ':'')});out.append(s)}
const rel=a.related.filter(h=>h.score>0);if(rel.length){out.append(el('h2',null,'Closest matches'));const g=el('div','chips');rel.forEach(h=>{const b=el('button',null,h.doc.k==='c'?h.doc.id+' '+h.doc.title:h.doc.title);b.type='button';b.onclick=()=>ask(h.doc.k==='c'?h.doc.id:h.doc.title+' plan');g.append(b)});out.append(g)}if(wantAi)aiAnswer(text,a)}
// ---- AI answers: retrieval-augmented generation with a model that runs in this browser ----
// Off until the visitor turns it on (it downloads about 2 GB once). The retrieval answer above always shows first;
// the model's answer is added under it and is told to use only the retrieved facts.
let llm=null,loading=null,turn=0;const aiBtn=$('aion'),aiMsg=$('aimsg'),aiBar=$('aibar');
const aiOn=()=>{try{return localStorage.getItem('gobblerplan:ai')==='on'}catch{return false}};
const aiLabel=()=>{aiBtn.textContent=aiOn()?'Turn off AI answers':'Turn on AI answers';aiBtn.setAttribute('aria-pressed',String(aiOn()))};
function loadModel(){if(llm)return Promise.resolve(llm);if(loading)return loading;
loading=(async()=>{if(!navigator.gpu)throw new Error('This browser cannot run the model. It needs WebGPU: try a recent Chrome, Edge or Safari on a laptop or desktop.');
const ad=await navigator.gpu.requestAdapter();if(!ad)throw new Error('No graphics adapter is available for the model on this device.');
aiBar.parentElement.hidden=false;aiMsg.textContent='Loading the model library\u2026';
// A dynamic import needs a full or ./-style address: a bare 'vendor/...' is rejected as a module name.
const lib=await import(new URL(root+'vendor/web-llm.js'+VER,location.href).href);
llm=await lib.CreateMLCEngine(ad.features.has('shader-f16')?'${MODEL_F16}':'${MODEL_F32}',{initProgressCallback:p=>{const pct=Math.round((p.progress||0)*100);aiBar.style.width=pct+'%';aiMsg.textContent='Getting the model ready: '+pct+'%. The first time downloads about 2 GB; after that it starts from your browser\u2019s storage.'}});
aiBar.parentElement.hidden=true;aiMsg.textContent='AI answers are on. The model runs in your browser; your question is not sent anywhere.';return llm})();
// A failed load switches the toggle back off, so one press tries again.
loading.catch(e=>{loading=null;aiBar.parentElement.hidden=true;try{localStorage.setItem('gobblerplan:ai','off')}catch{}aiLabel();const m=e&&e.message?e.message:'';aiMsg.textContent=/network|fetch|Cache/i.test(m)?'The download was interrupted. Press the button to try again; the parts already downloaded are usually kept.':m||'The model could not be loaded.'});return loading}
async function aiAnswer(text,a){const mine=++turn,box=el('div','ans aians'),head=el('p','mut','AI answer \u00b7 written in your browser from the facts above \u00b7 can be wrong, check the sources'),body=el('p',null,'Thinking\u2026');box.append(head,body);out.querySelector('.ans').after(box);
if(a.intent==='eligible'){body.textContent='The yes or no above was worked out exactly from the prerequisite list, so the model is not asked. In testing it said yes to questions like this even when the answer was no.';return}
if(OFF_TOPIC.test(text)){body.textContent='The facts here cover prerequisites, what a course unlocks and degree plans. They say nothing about professors, grades or how hard a course is, so the model is not asked.';return}
try{const e=await loadModel();if(mine!==turn)return;const msgs=ragMessages(text,a.related.slice(0,4).map(h=>h.doc));const stream=await e.chat.completions.create({messages:msgs,stream:true,temperature:0,max_tokens:160});let got='';
for await(const part of stream){if(mine!==turn){e.interruptGenerate();return}got+=(part.choices[0]&&part.choices[0].delta&&part.choices[0].delta.content)||'';body.textContent=got}
if(!ragGrounded(got,msgs[1].content)){body.textContent='The model named a course that is not in the facts it was given, so its answer was thrown away. Use the answer above.';return}
if(!got.trim())body.textContent='The model returned nothing. Use the answer above.'}catch(err){if(mine===turn)body.textContent='AI answer unavailable: '+(err&&err.message?err.message:'the model could not run')+'. The answer above still stands.'}}
aiBtn.onclick=()=>{const on=!aiOn();try{localStorage.setItem('gobblerplan:ai',on?'on':'off')}catch{}aiLabel();gpTrack('ai',on?'on':'off');if(on){loadModel().then(()=>{if(q.value.trim())show(q.value)}).catch(()=>{})}else{turn++;aiMsg.textContent='AI answers are off. Answers come from the catalog lookup only.';document.querySelectorAll('.aians').forEach(x=>x.remove())}};
aiLabel();if(aiOn())aiMsg.textContent='AI answers are on. The model loads when you ask your first question.';
function ask(text){q.value=text;history.replaceState(null,'','#q='+encodeURIComponent(text));ready.then(()=>show(text))}
$('aform').addEventListener('submit',e=>{e.preventDefault();ask(q.value)});
document.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.q)));
const start=new URLSearchParams(location.hash.slice(1)).get('q');if(start)ask(start);else q.focus()})();`;

export function renderAsk(site?: Site): string {
  return layout(`Ask · ${brand(site)}`, 'Ask about course prerequisites, what a course unlocks, and which majors need it. Answers come from catalog facts.', '', '',
    `<div class="hero"><h1>Ask about <em>courses and majors</em>.</h1><p>Type a question. The answer is put together from catalog facts this site already holds, and it names its sources.</p></div>
<form id="aform" class="askf" role="search"><input class="sel" id="aq" type="search" placeholder="For example: what do I need before CS 3214?" aria-label="Your question" autocomplete="off"><button type="submit" class="btn">Ask</button></form>
<div class="chips">${EXAMPLES.map((x) => `<button type="button" data-q="${x}">${x}</button>`).join('')}</div>
<div class="aibox"><button type="button" class="btn" id="aion" aria-pressed="false">Turn on AI answers</button><span class="mut" id="aimsg">Optional. Runs a small language model in your browser to write the answer from the facts found. First use downloads about 2 GB and needs a recent Chrome, Edge or Safari on a laptop or desktop.</span><div class="meter" hidden><i id="aibar" style="width:0"></i></div></div>
<noscript><p class="note warn">Ask needs JavaScript.</p></noscript>
<div id="aout" aria-live="polite"></div>
<p class="note"><b>How this works.</b> Your question is matched against 2,000 or so courses and degree plans with a search ranking built for this site, and the first answer is assembled by fixed rules from the facts stored for the best match: no AI is involved in that part. If you turn on AI answers, a language model that runs inside your browser also writes a short answer from the same retrieved facts (this is retrieval-augmented generation). It is a small model and can still get things wrong. Built with Llama (Llama 3.2, <a href="https://www.llama.com/llama3_2/license/" target="_blank" rel="noopener noreferrer">license</a>). The answer is worked out in your browser. A question that finds no match is saved, with nothing identifying you, so the site can learn to answer it (<a href="about.html#privacy">privacy</a>). It can pick the wrong course or major, so check "Closest matches" and the catalog link, and ask your advisor before you rely on it.</p>`, site, 'ask', `<script src="ask.js" defer></script>`);
}

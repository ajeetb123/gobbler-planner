import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askEngine, type AskDoc } from '../src/ask/engine.ts';
import { baselineRank, docs, engineRank, evaluate, evaluateHandWritten, ix } from '../bench/ask.eval.ts';
import { ASK_JS, EXAMPLES, MODEL_F16, MODEL_F32, renderAsk } from '../src/site/ask-page.ts';
import { ragGrounded, ragMessages, RAG_DOCS, RAG_OFF_TOPIC } from '../src/ask/rag.ts';
import { readFileSync, existsSync } from 'node:fs';

const E = askEngine();
const tiny: AskDoc[] = [
  { k: 'c', id: 'CS 2114', title: 'Software Design and Data Structures', text: 'CS', pre: 'CS 1114 or CS 2064', un: ['CS 2505'], mj: [['computer-science', 'Computer Science']], n: 1 },
  { k: 'c', id: 'CS 2505', title: 'Introduction to Computer Organization', text: 'CS', pre: 'CS 2114', un: [], mj: [], n: 0 },
  { k: 'c', id: 'CHEM 2535', title: 'Organic Chemistry', text: 'CHEM', un: [], mj: [], n: 0 },
  { k: 'p', id: 'computer-science', title: 'Computer Science', text: 'Engineering', college: 'Engineering', total: 123, draft: false, terms: [['First year, Fall', ['CS 1114', 'MATH 1225']], ['First year, Spring', ['CS 2114']]] },
];

test('tokenize: course codes are glued, filler words dropped, plurals folded', () => {
  assert.deepEqual(E.tokenize("What are CS 2114's prerequisites?"), ['cs2114', 'prerequisite']);
  assert.deepEqual(E.tokenize('cs-2114 CS2114 Cs 2114'), ['cs2114', 'cs2114', 'cs2114']);
  assert.deepEqual(E.tokenize('the of and'), []);
});

test('expand: exact word, then prefix, then one typo away, each trusted less', () => {
  const t = E.buildIndex(tiny);
  assert.deepEqual(E.expand(t, 'organic'), [['organic', 1]]);
  assert.deepEqual(E.expand(t, 'chemis'), [['chemistry', 0.7]]);
  assert.deepEqual(E.expand(t, 'organ').map((x) => x[0]).sort(), ['organic', 'organization']);
  assert.deepEqual(E.expand(t, 'chemistri'), [['chemistry', 0.5]]);
  assert.deepEqual(E.expand(t, 'zzzzzz'), []);
});

test('search: BM25 ranks the rarer, title-matching document first and can be limited to courses or plans', () => {
  const t = E.buildIndex(tiny);
  assert.equal(E.search(t, 'organic chemistry', 3)[0]!.doc.id, 'CHEM 2535');
  assert.equal(E.search(t, 'computer organization', 3, 'c')[0]!.doc.id, 'CS 2505');
  assert.equal(E.search(t, 'computer', 3, 'p')[0]!.doc.id, 'computer-science');
  assert.deepEqual(E.search(t, 'nothing matches this', 3), []);
});

test('answer: every intent, and only stored facts appear', () => {
  const t = E.buildIndex(tiny);
  const a = (q: string) => E.answer(t, q);
  assert.equal(a('what do I need before CS 2114').intent, 'prereq');
  assert.ok(a('what do I need before CS 2114').lines[0]!.includes('CS 1114 or CS 2064'));
  assert.ok(a('what does cs2114 unlock').lines[0]!.includes('CS 2505'));
  assert.ok(a('which majors require CS 2114').lines[0]!.includes('Computer Science'));
  assert.ok(a('is CS 2114 required for computer science').lines[0]!.startsWith('Yes.'));
  assert.ok(a('is CS 2505 in the computer science major').lines[0]!.includes('not a named course'));
  assert.ok(a('how many credits is computer science').lines[0]!.includes('123 credits'));
  assert.ok(a('what do I take first year in computer science').lines[0]!.startsWith('First year, Fall: CS 1114'));
  assert.equal(a('organic chemistry').intent, 'course');
  assert.ok(a('organic chemistry').lines[0]!.includes('no prerequisites'));
  assert.equal(a('computer science').intent, 'plan');
  assert.equal(a('qqqqqq wwwwww').intent, 'none');
  assert.deepEqual(a('   ').lines, []);
  assert.ok(a('CS 2114').sources[0]!.href.endsWith('/course-descriptions/cs/'));
});

test('real knowledge base: retrieval beats the word-overlap baseline on every question set', () => {
  assert.ok(docs.length > 2000);
  const eng = evaluate(engineRank), base = evaluate(baselineRank);
  for (const set of Object.keys(eng)) assert.ok(eng[set]!.at1 >= base[set]!.at1, set);
  const top1 = (s: string) => eng[s]!.at1 / eng[s]!.n, top3 = (s: string) => eng[s]!.at3 / eng[s]!.n;
  // Measured Nov 21, 2026: 99.4%, 99.2%, 78.6% (90.7% in the top 3), 95.3%. Floors sit a little below.
  assert.ok(top1('course by title') >= 0.99);
  assert.ok(top1('title with a typo') >= 0.98);
  assert.ok(top3('two word beginnings') >= 0.88);
  assert.ok(top1('plan by name') >= 0.94);
});

test('real knowledge base: the example questions on the page all get a real answer', () => {
  for (const q of EXAMPLES) {
    const a = E.answer(ix, q);
    assert.notEqual(a.intent, 'none', q);
    assert.ok(a.lines.length > 0 && a.sources.length > 0, q);
  }
  assert.ok(E.answer(ix, 'Which majors require PHYS 2305?').lines[0]!.includes('plans on this site include PHYS 2305'));
  assert.ok(E.answer(ix, 'Is STAT 4714 required for Electrical Engineering?').lines[0]!.startsWith('Yes.'));
});

test('ask page: script is valid JavaScript, explains what is and is not AI, and carries the site name rules', () => {
  assert.doesNotThrow(() => new Function(ASK_JS));
  const text = renderAsk().replace(/<[^>]+>/g, ' ');
  assert.ok(text.includes('no AI is involved in that part') && text.includes('retrieval-augmented generation'));
  // AI answers are opt-in: the page must say what turning them on costs.
  assert.ok(text.includes('Turn on AI answers') && text.includes('downloads about 2 GB'));
  assert.ok(text.includes('Not affiliated with, endorsed by, or sponsored by Virginia Tech'));
  assert.ok(!/\bVT\b|Hokie/.test(text));
});

test('hand-written student-style questions: the honest score, far below the generated sets', () => {
  const r = evaluateHandWritten();
  assert.equal(r.total, 40);
  // 27 of 40 on Nov 21, 2026. Misses are slang ("orgo", "calc 2", "comp org", "compe"), questions about meaning
  // ("easy math class") and two-course questions. The floor only guards against getting worse; do not tune the
  // engine to this list, or it stops measuring anything.
  assert.ok(r.right >= 26, `right: ${r.right}`);
});

test('ragMessages: numbered facts from retrieval and firm instructions', () => {
  const t = E.buildIndex(tiny);
  const a = E.answer(t, 'what do I need before CS 2114');
  const [system, user] = ragMessages('what do I need before CS 2114', a.related.map((h) => h.doc));
  assert.equal(system!.role, 'system');
  assert.ok(system!.content.includes('using ONLY the facts') && system!.content.includes('Never add'));
  assert.ok(user!.content.includes('[1] CS 2114 Software Design and Data Structures. Prerequisites: CS 1114 or CS 2064.'));
  assert.ok(user!.content.includes('Question: what do I need before CS 2114'));
  // Nothing found: the prompt says so instead of leaving the model to guess.
  const none = ragMessages('zzzz', []);
  assert.ok(none[1]!.content.includes('none found'));
  // Real data: at most RAG_DOCS facts, each clipped, whole prompt small enough for a 4,096-token model.
  const q = 'which majors require PHYS 2305 and what does it unlock';
  const real = E.answer(ix, q);
  const msgs = ragMessages(q, real.related.map((h) => h.doc));
  assert.ok((msgs[1]!.content.match(/^\[\d\] /gm) ?? []).length <= RAG_DOCS);
  assert.ok(msgs[0]!.content.length + msgs[1]!.content.length < 6000);
});

test('eligibility: "I have A, can I take X" is worked out from the prerequisite tree, not left to a model', () => {
  const t = E.buildIndex([
    { k: 'c', id: 'CS 3214', title: 'Computer Systems', text: 'CS', pre: '(CS 2506 and CS 2114) or (ECE 2564 and ECE 3574)', pe: ['|', ['&', 'CS 2506', 'CS 2114'], ['&', 'ECE 2564', 'ECE 3574']], un: [], mj: [], n: 0 },
    { k: 'c', id: 'CS 2506', title: 'Computer Organization II', text: 'CS', pre: 'CS 2505', pe: 'CS 2505', un: ['CS 3214'], mj: [], n: 0 },
    { k: 'c', id: 'ENGL 1105', title: 'First-Year Writing', text: 'ENGL', un: [], mj: [], n: 0 },
    { k: 'c', id: 'XX 1000', title: 'Odd One', text: 'XX', pre: 'Junior standing', un: [], mj: [], n: 0 },
  ]);
  const yes = E.answer(t, 'I took cs2506 and CS 2114, can I take CS 3214?');
  assert.equal(yes.intent, 'eligible');
  assert.ok(yes.checked!.startsWith('Yes. CS 2506 and CS 2114 cover'));
  assert.equal(yes.related[0]!.doc.id, 'CS 3214');
  // One of two "and" parts held: the other is still needed, or the whole other branch.
  const no = E.answer(t, 'I have taken CS 2506. Can I take CS 3214?');
  assert.equal(no.checked, 'No, not yet. Before CS 3214 Computer Systems you still need CS 2114 or (ECE 2564 and ECE 3574).');
  assert.ok(no.lines.some((l) => l.includes('not minimum grades')));
  // The other branch works too, and a course outside the index still counts as held.
  assert.ok(E.answer(t, 'with ECE 2564 and ECE 3574 am I eligible for CS 3214').checked!.startsWith('Yes'));
  // No prerequisites listed: yes. Prerequisites the site cannot parse: no verdict, and it says so.
  assert.ok(E.answer(t, 'I have CS 2506, can I take ENGL 1105').checked!.startsWith('Yes, as far as prerequisites go'));
  const odd = E.answer(t, 'I have CS 2506, can I take XX 1000');
  assert.equal(odd.checked, undefined);
  assert.ok(odd.lines[0]!.includes('cannot check'));
  // Without a course in hand it stays the plain prerequisite lookup.
  assert.equal(E.answer(t, 'can I take CS 3214').intent, 'prereq');
  // The page does not ask the model these: it contradicted the computed answer in testing.
  assert.ok(ASK_JS.includes("a.intent==='eligible'"));
});

test('rag guards: off-topic questions skip the model, answers naming unknown courses are rejected', () => {
  for (const q of ['best professor for calculus', 'is CS 3214 hard', 'easiest pathways class', 'average grade in MATH 2114']) assert.ok(RAG_OFF_TOPIC.test(q), q);
  for (const q of ['what do I need before CS 3214', 'which majors require PHYS 2305', 'when do CS majors take CS 2114']) assert.ok(!RAG_OFF_TOPIC.test(q), q);
  const prompt = 'Facts:\n[1] CS 3214 Computer Systems. Prerequisites: (CS 2506 and CS 2114) or (ECE 2564 and ECE 3574).';
  assert.ok(ragGrounded('You need CS 2506 and cs2114. [1]', prompt));
  assert.ok(ragGrounded('I do not know.', prompt));
  assert.ok(!ragGrounded('You need CS 2505 first. [1]', prompt));
  assert.ok(ASK_JS.includes('ragGrounded(got') && ASK_JS.includes('OFF_TOPIC.test(text)'));
});

test('the model ids exist in the installed library, and the page script uses them', () => {
  const lib = 'node_modules/@mlc-ai/web-llm/lib/index.js';
  assert.ok(existsSync(lib), 'run npm ci');
  const src = readFileSync(lib, 'utf8');
  for (const id of [MODEL_F16, MODEL_F32]) {
    assert.ok(src.includes(`model_id: "${id}"`), id);
    assert.ok(ASK_JS.includes(id));
  }
  assert.ok(src.includes('CreateMLCEngine'));
});

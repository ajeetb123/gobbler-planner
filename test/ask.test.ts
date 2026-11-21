import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askEngine, type AskDoc } from '../src/ask/engine.ts';
import { baselineRank, docs, engineRank, evaluate, ix } from '../bench/ask.eval.ts';
import { ASK_JS, EXAMPLES, renderAsk } from '../src/site/ask-page.ts';

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

test('ask page: script is valid JavaScript, says no AI is involved, and carries the site name rules', () => {
  assert.doesNotThrow(() => new Function(ASK_JS));
  const text = renderAsk().replace(/<[^>]+>/g, ' ');
  assert.ok(text.includes('No AI model is involved'));
  assert.ok(text.includes('Not affiliated with, endorsed by, or sponsored by Virginia Tech'));
  assert.ok(!/\bVT\b|Hokie/.test(text));
});

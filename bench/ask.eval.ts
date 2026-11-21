// Run: npm run eval:ask
// Measures the Ask retrieval on questions whose right answer is known, because they are generated from the
// knowledge base itself. Compared with a baseline that only counts shared words (no rarity weighting, no
// length normalization, no typo or prefix handling), to show what each part of the engine buys.
import { readFileSync, readdirSync } from 'node:fs';
import { parseRoadmaps } from '../src/plan/roadmap.ts';
import { parsePrereqs } from '../src/plan/prereq.ts';
import { draftRoadmap, parseRequirements } from '../src/plan/draft.ts';
import { buildDocs } from '../src/ask/docs.ts';
import { askEngine, type AskDoc, type AskIndex } from '../src/ask/engine.ts';

const read = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.txt')).sort().map((f) => readFileSync(`${dir}/${f}`, 'utf8'));
const courses = parsePrereqs(readFileSync('data/prereqs.txt', 'utf8'));
const roadmaps = [...read('data/roadmaps').flatMap(parseRoadmaps), ...read('data/requirements').flatMap(parseRequirements).map((q) => draftRoadmap(q, courses))];
export const docs = buildDocs(roadmaps, courses);
const E = askEngine();
export const ix = E.buildIndex(docs);

/** Baseline ranking: number of query words the document contains. Ties keep document order. */
function overlap(index: AskIndex, query: string, k: number, kind: 'c' | 'p'): AskDoc[] {
  const score: Record<number, number> = {};
  for (const w of new Set(E.tokenize(query))) for (const [d] of index.postings[w] ?? []) score[d] = (score[d] ?? 0) + 1;
  return Object.keys(score).map(Number).filter((d) => index.docs[d]!.k === kind).sort((a, b) => score[b]! - score[a]! || a - b).slice(0, k).map((d) => index.docs[d]!);
}

export interface Case { set: string; query: string; kind: 'c' | 'p'; ok: (d: AskDoc) => boolean }
const longest = (title: string, n: number) => [...new Set(title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5))].sort((a, b) => b.length - a.length).slice(0, n);

export function cases(): Case[] {
  const out: Case[] = [];
  const cs = docs.filter((d) => d.k === 'c'), ps = docs.filter((d) => d.k === 'p');
  for (const d of cs) {
    // Courses in a sequence share a title (MATH 1225 and 1226): either one is a right answer.
    const ok = (x: AskDoc) => x.title === d.title;
    out.push({ set: 'course by title', query: `what are the prerequisites for ${d.title}`, kind: 'c', ok });
    const [w] = longest(d.title, 1);
    if (w) {
      const cut = Math.floor(w.length / 2);
      out.push({ set: 'title with a typo', query: `prerequisites for ${d.title.toLowerCase().replace(w, w.slice(0, cut) + w.slice(cut + 1))}`, kind: 'c', ok });
    }
    const parts = longest(d.title, 2);
    if (parts.length === 2) out.push({ set: 'two word beginnings', query: `${d.id.split(' ')[0]} ${parts.map((p) => p.slice(0, 5)).join(' ')}`, kind: 'c', ok });
  }
  for (const p of ps) {
    out.push({ set: 'plan by name', query: `what do I take first year in ${p.title}`, kind: 'p', ok: (x) => x.id === p.id });
    out.push({ set: 'plan by name', query: `how many credits is ${p.title.replace(/ Major\b/g, '')}`, kind: 'p', ok: (x) => x.id === p.id });
  }
  return out;
}

export function evaluate(rank: (query: string, k: number, kind: 'c' | 'p') => AskDoc[]) {
  const by: Record<string, { n: number; at1: number; at3: number; rr: number }> = {};
  for (const c of cases()) {
    const hits = rank(c.query, 5, c.kind), pos = hits.findIndex(c.ok);
    const b = (by[c.set] ??= { n: 0, at1: 0, at3: 0, rr: 0 });
    b.n++; if (pos === 0) b.at1++; if (pos >= 0 && pos < 3) b.at3++; if (pos >= 0) b.rr += 1 / (pos + 1);
  }
  return by;
}

export const engineRank = (q: string, k: number, kind: 'c' | 'p') => E.search(ix, q, k, kind).map((h) => h.doc);
export const baselineRank = (q: string, k: number, kind: 'c' | 'p') => overlap(ix, q, k, kind);

if (import.meta.main) {
  const pct = (a: number, n: number) => ((100 * a) / n).toFixed(1).padStart(5) + '%';
  const eng = evaluate(engineRank), base = evaluate(baselineRank);
  console.log(`Knowledge base: ${docs.filter((d) => d.k === 'c').length} courses, ${docs.filter((d) => d.k === 'p').length} plans, ${ix.vocab.length} distinct words\n`);
  console.log('question set            questions   baseline top-1  top-3     engine top-1  top-3   MRR');
  for (const set of Object.keys(eng)) {
    const e = eng[set]!, b = base[set]!;
    console.log(`${set.padEnd(24)}${String(e.n).padStart(8)}       ${pct(b.at1, b.n)}  ${pct(b.at3, b.n)}        ${pct(e.at1, e.n)}  ${pct(e.at3, e.n)}  ${(e.rr / e.n).toFixed(3)}`);
  }
  // Exact course codes and intents.
  let codeOk = 0, n = 0;
  for (const d of docs.filter((x) => x.k === 'c')) {
    for (const [q, intent] of [[`what do I need before ${d.id}?`, 'prereq'], [`what does ${d.id.toLowerCase().replace(' ', '')} unlock`, 'unlocks'], [`which majors require ${d.id}`, 'majors']] as const) {
      n++; const a = E.answer(ix, q); if (a.intent === intent && a.lines[0]!.includes(d.id)) codeOk++;
    }
  }
  console.log(`\nQuestions with a course code (3 phrasings each): ${codeOk} of ${n} answered about the right course with the right kind of answer`);
  const t0 = performance.now(); for (let i = 0; i < 200; i++) E.answer(ix, 'what do I need before organic chemistry lab');
  console.log(`Speed: ${((performance.now() - t0) / 200).toFixed(2)} ms per question`);
}

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

/**
 * Questions written by hand in the way a student might type them (lowercase, slang, typos, no course code).
 * They are NOT from real users: the site has not launched. Replace them with real questions from the dashboard's
 * "questions with no answer" list and from students once there are some. `want` lists every acceptable course
 * code or plan slug; `intent` is checked when given.
 */
export const HAND_WRITTEN: Array<{ q: string; want: string[]; intent?: string }> = [
  { q: 'what do i need to take before computer systems', want: ['CS 3214'], intent: 'prereq' },
  { q: 'prereqs for data structures and algorithms', want: ['CS 3114'], intent: 'prereq' },
  { q: 'can i take orgo without gen chem', want: ['CHEM 2535', 'CHEM 2565'], intent: 'prereq' },
  { q: 'organic chem prerequisites', want: ['CHEM 2535', 'CHEM 2565', 'CHEM 2536', 'CHEM 2566'], intent: 'prereq' },
  { q: 'what comes after calc 2', want: ['MATH 1226'], intent: 'unlocks' },
  { q: 'what does linear algebra unlock', want: ['MATH 2114'], intent: 'unlocks' },
  { q: 'whats needed for thermo', want: ['ME 3124', 'CHE 2164', 'BSE 3154'], intent: 'prereq' },
  { q: 'thermodynamics prereqs', want: ['ME 3124', 'CHE 2164', 'BSE 3154', 'MSE 4034'], intent: 'prereq' },
  { q: 'do i need physics for statics', want: ['ESM 2104'], intent: 'prereq' },
  { q: 'dynamics prerequisites', want: ['ESM 2304'], intent: 'prereq' },
  { q: 'what classes need multivariable calculus', want: ['MATH 2204'] },
  { q: 'differential equations before or after linear algebra', want: ['MATH 2214', 'MATH 2114'] },
  { q: 'which majors take foundations of physics', want: ['PHYS 2305', 'PHYS 2306'], intent: 'majors' },
  { q: 'who needs first year writing', want: ['ENGL 1105', 'ENGL 1106'], intent: 'majors' },
  { q: 'is cs 2505 required for computer engineering', want: ['CS 2505', 'computer-engineering'], intent: 'majors' },
  { q: 'is stat 4714 in the electrical engineering major', want: ['STAT 4714', 'electrical-engineering'], intent: 'majors' },
  { q: 'comp org prereqs', want: ['CS 2505', 'CS 2506'], intent: 'prereq' },
  { q: 'intro to software design', want: ['CS 1114'] },
  { q: 'circuits and devices requirements', want: ['ECE 2024'], intent: 'prereq' },
  { q: 'what is ENGE 1216', want: ['ENGE 1216'] },
  { q: 'prinicples of economics', want: ['ECON 2005', 'ECON 2006'] },
  { q: 'genral microbiology prereq', want: ['BIOL 2604'], intent: 'prereq' },
  { q: 'tech writing prerequisite', want: ['ENGL 3764'], intent: 'prereq' },
  { q: 'senior design mechanical', want: ['ME 4015', 'ME 4016'] },
  { q: 'fluid mechanics', want: ['ME 3404', 'CEE 3304', 'BSE 2504', 'ESM 3024', 'AOE 3014'] },
  { q: 'how many credits is mechanical engineering', want: ['mechanical-engineering'], intent: 'credits' },
  { q: 'how long is architecture', want: ['architecture-barch'], intent: 'credits' },
  { q: 'what do you take freshman year in computer science', want: ['computer-science'], intent: 'year' },
  { q: 'sophomore year civil engineering classes', want: ['civil-engineering'], intent: 'year' },
  { q: 'senior year psychology', want: ['psychology-bs'], intent: 'year' },
  { q: 'chemical engineering plan', want: ['chemical-engineering'] },
  { q: 'aerospace', want: ['aerospace-engineering'] },
  { q: 'biochem major', want: ['biochemistry-bs'] },
  { q: 'physics degree', want: ['physics-bs', 'physics-ba', 'physics-ba-pre-health', 'physics-ba-pre-law', 'physics-ba-physics-education'] },
  { q: 'econ major first year', want: ['economics-ba', 'economics-ba-business', 'economics-ba-policy-regulation', 'economics-ba-managerial-economics-data-science'], intent: 'year' },
  { q: 'industrial and systems engineering credits', want: ['industrial-systems-engineering'], intent: 'credits' },
  { q: 'mining engineering', want: ['mining-engineering'] },
  { q: 'compe', want: ['computer-engineering'] },
  { q: 'easy math class', want: [] },
  { q: 'best professor for calculus', want: [] },
];

/** Share of hand-written questions where the answer is about an acceptable course or plan (and the intent matches when given). `want: []` means the honest answer is "I can't answer that". */
export function evaluateHandWritten() {
  const rows = HAND_WRITTEN.map((h) => {
    const a = E.answer(ix, h.q);
    // What the answer is about, read from its first source: "<CODE> in the catalog" or "<Plan name> plan".
    const label = a.sources[0]?.label ?? '';
    const subject = docs.find((d) => h.want.includes(d.id) && label === (d.k === 'c' ? `${d.id} in the catalog` : `${d.title} plan`));
    const right = h.want.length === 0 ? a.intent === 'none' : Boolean(subject) && (!h.intent || a.intent === h.intent);
    return { ...h, got: a.intent, right };
  });
  return { rows, right: rows.filter((r) => r.right).length, total: rows.length };
}

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
  const hw = evaluateHandWritten();
  console.log(`\nHand-written questions (not from real users): ${hw.right} of ${hw.total} right`);
  for (const r of hw.rows.filter((x) => !x.right)) console.log(`  missed: "${r.q}" -> answered as ${r.got}`);
  const t0 = performance.now(); for (let i = 0; i < 200; i++) E.answer(ix, 'what do I need before organic chemistry lab');
  console.log(`Speed: ${((performance.now() - t0) / 200).toFixed(2)} ms per question`);
}

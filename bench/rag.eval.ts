// Scores the generation half of Ask against a model served by a local Ollama (not part of `npm run check`).
//   node bench/rag.eval.ts llama3.2:3b
// Two kinds of question. Lookups ("what do I need before X"): right only if the answer names every course the
// data requires. Eligibility ("I have A, can I take X"): right only if the answer opens with the same yes or no
// that the rule engine computed from the prerequisite tree. The page does NOT send eligibility questions to the
// model (3B scored 8 of 16 alone and 10 of 16 when handed the computed answer); this part is kept so a better
// model can be tried against the same bar.
// Each question goes through the real retrieval and the real prompt (ragMessages). An answer counts as right
// only if it names every course code (or number) the stored facts say it must, and passes the grounding check.
// The browser runs the MLC build of the same model; Ollama's build is quantized a little differently, so treat
// the score as a close estimate of the browser's, not the same measurement.
import { askEngine, type AskExpr } from '../src/ask/engine.ts';
import { ragGrounded, ragMessages, RAG_DOCS, RAG_OFF_TOPIC } from '../src/ask/rag.ts';
import { docs, ix } from './ask.eval.ts';

const E = askEngine();
const model = process.argv[2] ?? 'llama3.2:3b';
const codes = (s: string): string[] => s.match(/[A-Z]{2,4} \d{4}H?/g) ?? [];
const course = (id: string) => docs.find((x) => x.k === 'c' && x.id === id);
const plan = (title: string) => docs.find((x) => x.k === 'p' && x.title === title);

// [question, strings the answer must contain]. The lists come from the data, not from me.
// A code or major that is not in the data, or has nothing to check, is left out.
const PRE = ['CS 3214', 'MATH 2214', 'CS 2114', 'PHYS 2306', 'CHEM 2535', 'ECE 2024', 'STAT 3005', 'ME 2124', 'CS 3114', 'ISE 2404'];
const UNLOCK = ['CS 2505', 'MATH 2114', 'CHEM 1035', 'ECE 2024'];
const PLANS = ['Computer Science', 'Aerospace Engineering', 'Finance'];
const CASES: Array<[string, string[]]> = [
  ...PRE.map((id): [string, string[]] => [`what do I need before ${id}`, codes(course(id)?.pre ?? '')]),
  ...UNLOCK.map((id): [string, string[]] => [`what does ${id} unlock`, (course(id)?.un ?? []).slice(0, 10)]),
  ...PLANS.map((t): [string, string[]] => [`how many credits is the ${t} major`, plan(t) ? [String(plan(t)!.total)] : []]),
].filter(([, must]) => must.length > 0) as Array<[string, string[]]>;

// Eligibility: for each course, one list of courses that meets the prerequisites and one that falls short.
const ELIG_FOR = ['CS 3214', 'MATH 2214', 'PHYS 2306', 'ECE 2024', 'CS 3114', 'CS 2506', 'CHEM 2535', 'ISE 2404'];
const enough = (e: AskExpr): string[] => (typeof e === 'string' ? [e] : e[0] === '&' ? e.slice(1).flatMap((x) => enough(x as AskExpr)) : enough(e[1] as AskExpr));
const ELIG: Array<[string, boolean]> = ELIG_FOR.flatMap((id): Array<[string, boolean]> => {
  const pe = course(id)?.pe;
  if (!pe) return [];
  const full = enough(pe), short = full.length > 1 ? full.slice(0, -1) : ['ENGL 1105'];
  return [[`I have taken ${full.join(' and ')}. Can I take ${id}?`, true], [`I have taken ${short.join(' and ')}. Can I take ${id}?`, false]];
});

async function ask(q: string): Promise<{ text: string; prompt: string; checked?: string }> {
  const a = E.answer(ix, q);
  const messages = ragMessages(q, a.related.slice(0, RAG_DOCS).map((h) => h.doc));
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0, num_predict: 160 } }),
  });
  if (!res.ok) throw new Error(`Ollama answered ${res.status}: is it running, and is ${model} pulled?`);
  const body = await res.json() as { message: { content: string } };
  return { text: body.message.content.trim(), prompt: messages[1]!.content, ...(a.checked ? { checked: a.checked } : {}) };
}

let right = 0, ungrounded = 0, refused = 0;
const flat = (s: string) => s.toUpperCase().replace(/\s+/g, '');
for (const [q, must] of CASES) {
  if (RAG_OFF_TOPIC.test(q)) throw new Error(`Off-topic guard caught an in-scope question: ${q}`);
  const { text, prompt } = await ask(q);
  const grounded = ragGrounded(text, prompt);
  const missing = must.filter((m) => !flat(text).includes(flat(m)));
  const ok = grounded && must.length > 0 && missing.length === 0;
  if (ok) right++;
  if (!grounded) ungrounded++;
  if (/I do not know/i.test(text)) refused++;
  console.log(`${ok ? 'RIGHT' : 'WRONG'} | ${q}\n   ${text.replace(/\n+/g, ' ').slice(0, 260)}${missing.length ? `\n   missing: ${missing.join(', ')}` : ''}${grounded ? '' : '\n   names a course that is not in its facts'}`);
}
let agree = 0;
for (const [q, want] of ELIG) {
  const { text, prompt, checked } = await ask(q);
  if (!checked || checked.startsWith('Yes') !== want) throw new Error(`The rule engine itself got this wrong: ${q} -> ${checked}`);
  const said = /^yes\b/i.test(text) ? true : /^no\b/i.test(text) ? false : undefined;
  const ok = said === want && ragGrounded(text, prompt);
  if (ok) agree++;
  console.log(`${ok ? 'RIGHT' : 'WRONG'} | ${q}\n   ${text.replace(/\n+/g, ' ').slice(0, 260)}`);
}
console.log(`\n${model}: eligibility ${agree} of ${ELIG.length} match the computed yes or no (the rule engine: ${ELIG.length} of ${ELIG.length}; the page uses the rule engine).`);
console.log(`${model}: lookups ${right} of ${CASES.length} right, ${refused} refused, ${ungrounded} named a course outside the facts.`);

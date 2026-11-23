// The "augmented generation" half of RAG: turn what retrieval found into a prompt for a language model.
//
// Retrieval (engine.ts) picks the documents. This file writes them out as numbered facts and tells the model to
// answer from those facts only. The model itself runs in the visitor's browser (see ask-page.ts); nothing here
// calls a server. Keeping the prompt builder separate and pure means it can be tested without a model.
import type { AskDoc } from './engine.ts';

export interface ChatMessage { role: 'system' | 'user'; content: string }

/** Retrieved documents handed to the model. More would not fit a small model's attention. */
export const RAG_DOCS = 4;
/** Longest fact block per document, in characters. */
export const RAG_DOC_CHARS = 700;

/**
 * Build the chat messages for one question from the top retrieval hits.
 * The wording was picked by trying four prompts on the real model (bench/rag.eval.ts): a worked example made the
 * 1B model fluent but wrong (it dropped "or" branches and leaked the example), so there is none.
 * Self-contained on purpose: ask-page.ts ships this function's source to the browser. Do not use imports in it.
 */
export function ragMessages(question: string, docs: AskDoc[]): ChatMessage[] {
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const fact = (d: AskDoc): string => {
    if (d.k === 'c') {
      const parts = [`${d.id} ${d.title}.`, `Prerequisites: ${d.pre || 'none listed'}.`];
      if (d.co) parts.push(`Corequisites: ${d.co}.`);
      if (d.un && d.un.length) parts.push(`It unlocks these courses (they require it first): ${d.un.slice(0, 10).join(', ')}${d.un.length > 10 ? ' and others' : ''}.`);
      if (d.n) parts.push(`It is on ${d.n} degree plan${d.n === 1 ? '' : 's'}, such as ${(d.mj || []).slice(0, 4).map((m) => m[1]).join('; ')}.`);
      return parts.join(' ');
    }
    const terms = (d.terms || []).map(([label, items]) => `${label}: ${items.join(', ')}`).join('. ');
    return `${d.title} degree plan (${d.college}): ${d.total} credits over ${(d.terms || []).length} terms${d.draft ? ', term order suggested by this site' : ''}. ${terms}`;
  };
  const facts = docs.slice(0, 4).map((d, i) => `[${i + 1}] ${clip(fact(d), 700)}`);
  const system = 'You answer questions for students using ONLY the facts given. Rules: 1) Answer in one or two short sentences. ' +
    '2) End with the fact number in brackets, like [1]. 3) The facts cover only course prerequisites, what a course unlocks, and degree plans. ' +
    'If the question asks about anything else (professors, grades, difficulty, opinions) or the facts do not answer it, reply exactly: ' +
    '"I do not know. Check the catalog or ask your advisor." 4) Never add information that is not in the facts.';
  const user = `Facts:\n${facts.length ? facts.join('\n') : 'none found.'}\n\nQuestion: ${clip(question.trim(), 300)}\n\nAnswer using only the facts:`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/**
 * Questions the facts cannot answer (people, grades, difficulty, opinions). The page does not run the model on
 * these: in testing the model refused them only some of the time, and once called a course "challenging".
 */
export const RAG_OFF_TOPIC = /\b(prof|professors?|teachers?|instructors?|hard|hardest|easy|easiest|difficult|difficulty|gpa|grades?|curve|best|worst|recommend|worth)\b/i;

/**
 * True when every course code in the model's answer also appears in the prompt it was given.
 * An answer that names a course the facts never mentioned is made up, so the page throws it away.
 * Self-contained on purpose: shipped to the browser like ragMessages.
 */
export function ragGrounded(answer: string, prompt: string): boolean {
  const codes = (s: string) => (s.toUpperCase().match(/\b[A-Z]{2,4} ?\d{4}H?\b/g) || []).map((c) => c.replace(' ', ''));
  const known = new Set(codes(prompt));
  return codes(answer).every((c) => known.has(c));
}

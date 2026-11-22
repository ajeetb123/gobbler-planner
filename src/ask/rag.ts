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
 * Build the chat messages for one question.
 * `lookup` is the rule-based answer for the best match (already checked facts); `docs` are the top retrieval hits.
 * Self-contained on purpose: ask-page.ts ships this function's source to the browser. Do not use imports in it.
 */
export function ragMessages(question: string, lookup: string[], docs: AskDoc[]): ChatMessage[] {
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const fact = (d: AskDoc): string => {
    if (d.k === 'c') {
      const parts = [`${d.id} ${d.title}.`, `Prerequisites: ${d.pre || 'none listed'}.`];
      if (d.co) parts.push(`Corequisites: ${d.co}.`);
      if (d.un && d.un.length) parts.push(`Courses that require it first: ${d.un.slice(0, 10).join(', ')}${d.un.length > 10 ? ' and others' : ''}.`);
      if (d.n) parts.push(`It is on ${d.n} degree plan${d.n === 1 ? '' : 's'}, such as ${(d.mj || []).slice(0, 4).map((m) => m[1]).join('; ')}.`);
      return parts.join(' ');
    }
    const terms = (d.terms || []).map(([label, items]) => `${label}: ${items.join(', ')}`).join('. ');
    return `${d.title} degree plan (${d.college}): ${d.total} credits over ${(d.terms || []).length} terms${d.draft ? ', term order suggested by this site' : ''}. ${terms}`;
  };
  const facts = docs.slice(0, 4).map((d, i) => `[${i + 1}] ${clip(fact(d), 700)}`);
  const system = 'You are the assistant on Gobbler Plan, an unofficial degree planner for Virginia Tech students. ' +
    'Answer the question using only the numbered facts and the lookup result below. Mention the fact number you used, like [1]. ' +
    'If they do not contain the answer, say you do not know and suggest the catalog or an advisor. ' +
    'Never invent course codes, prerequisites, professors, grades or opinions about difficulty. Answer in at most 80 words.';
  const user = `Lookup result: ${lookup.length ? lookup.join(' ') : 'no direct match.'}\n\nFacts:\n${facts.length ? facts.join('\n') : 'none found.'}\n\nQuestion: ${clip(question.trim(), 300)}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

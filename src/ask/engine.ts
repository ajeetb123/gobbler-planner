// "Ask": retrieval-augmented answers built from scratch, with no AI model and no network calls.
//
// The pipeline, in the order a question flows through it:
//   1. tokenize   question text -> normalized words ("What are CS 2114's prerequisites?" -> cs2114, prerequisite)
//   2. expand     a word the index has never seen -> words it probably meant (prefix, then one typo away)
//   3. search     BM25 ranking over an inverted index (which documents contain these words, weighted by rarity)
//   4. intent     what kind of answer is wanted (prerequisites, what it unlocks, which majors, credits, a year)
//   5. answer     sentences assembled ONLY from the facts stored on the retrieved document, plus its sources
//
// Step 5 is rule-based on purpose. A language model could phrase things more freely, but it could also state
// something the catalog never said. Here every sentence is a stored fact, so an answer can be traced to its source.
//
// Everything lives inside askEngine() and uses nothing outside it: ask-page.ts ships this function's source to
// the browser with toString(), so the tested code and the code users run are the same. Do not use imports in it.

/** Prerequisites as a tree: a course code, or ['&', ...] (all of) / ['|', ...] (one of). Same shape as plan/prereq.ts. */
export type AskExpr = string | ['&' | '|', ...AskExpr[]];

/** One retrievable thing: a course or a degree plan. `title` and `text` are searched; the rest are facts to answer from. */
export interface AskDoc {
  /** 'c' = course, 'p' = degree plan. */
  k: 'c' | 'p';
  /** Course code ("CS 2114") or plan slug. */
  id: string;
  title: string;
  /** Extra searchable words (subject name, college). */
  text: string;
  // Course facts
  pre?: string;
  co?: string;
  /** `pre` parsed into a tree, when the catalog text is a clean and/or list. Used to check "can I take it" exactly. */
  pe?: AskExpr;
  /** Courses that list this one as a prerequisite or corequisite. */
  un?: string[];
  /** Plans that include this course: [slug, name]. `n` is the full count (the list is capped). */
  mj?: Array<[string, string]>;
  n?: number;
  // Plan facts
  college?: string;
  total?: number;
  draft?: boolean;
  /** [term label, items in that term]. */
  terms?: Array<[string, string[]]>;
}

export interface AskIndex {
  docs: AskDoc[];
  /** word -> list of [document number, how often the word appears there (title counts double)]. */
  postings: Record<string, Array<[number, number]>>;
  /** Words per document, and the average: BM25 uses them so long documents do not win just by being long. */
  len: number[];
  avg: number;
  /** Course code without the space ("cs2114") -> document number, for exact lookups. */
  byCode: Record<string, number>;
  vocab: string[];
}

export interface AskHit { doc: AskDoc; score: number }
export interface AskSource { label: string; href: string; external?: boolean }
export interface AskAnswer {
  /** Which rule produced the answer: 'prereq', 'unlocks', 'majors', 'course', 'credits', 'year', 'plan', 'eligible', 'group', 'scope', 'compare', 'next', 'none'. */
  intent: string;
  lines: string[];
  /** A yes or no worked out by code for "can I take X with what I have". The page never asks the language model these. */
  checked?: string;
  sources: AskSource[];
  /** Other close matches, so a wrong guess is easy to correct. */
  related: AskHit[];
}

export function askEngine() {
  // ---- 1. tokenize ----
  const STOP = new Set(('a an the of for to in on at and or is are was do does did i im my me we you your what which who how many much ' +
    'can could should would will it its be been with about any there this that these those take taking need needs needed get have has ' +
    'if so then than from by as into before after class classes course courses major majors degree degrees program programs plan plans option').split(' '));
  /** Lowercase, drop possessives ("2114's"), glue course codes together ("CS 2114", "cs-2114" -> "cs2114"), split on anything that is not a letter or digit. */
  const words = (s: string): string[] => s.toLowerCase().replace(/['\u2019]s\b/g, '').replace(/\b([a-z]{2,4})[\s-]?(\d{4}h?)\b/g, '$1$2').split(/[^a-z0-9]+/).filter(Boolean);
  /** Crude stemming: "prerequisites" and "prerequisite" should be the same word. */
  const stem = (w: string): string => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
  // Single letters carry no meaning here ("b" matched the "B" in "(B.A.)"), so they are dropped.
  const tokenize = (s: string): string[] => words(s).filter((w) => !STOP.has(w) && w.length > 1).map(stem);

  // ---- 3a. build the inverted index ----
  const TITLE_WEIGHT = 2;
  function buildIndex(docs: AskDoc[]): AskIndex {
    const postings: Record<string, Array<[number, number]>> = {};
    const len: number[] = [];
    const byCode: Record<string, number> = {};
    docs.forEach((d, i) => {
      const tf: Record<string, number> = {};
      const idWords = d.k === 'c' ? tokenize(d.id) : [];
      for (const w of [...idWords, ...tokenize(d.title)]) tf[w] = (tf[w] || 0) + TITLE_WEIGHT;
      for (const w of tokenize(d.text)) tf[w] = (tf[w] || 0) + 1;
      let n = 0;
      for (const w in tf) { (postings[w] = postings[w] || []).push([i, tf[w]!]); n += tf[w]!; }
      len.push(n);
      if (d.k === 'c') byCode[d.id.toLowerCase().replace(' ', '')] = i;
    });
    return { docs, postings, len, avg: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length), byCode, vocab: Object.keys(postings) };
  }

  // ---- 2. expand a word the index does not know ----
  /** True when a and b differ by one inserted, deleted or changed letter. */
  const oneEditApart = (a: string, b: string): boolean => {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  };
  /** Exact word if the index has it; otherwise words starting with it ("calc" -> calculus); otherwise one typo away. Guesses count for less. */
  function expand(ix: AskIndex, w: string): Array<[string, number]> {
    if (ix.postings[w]) return [[w, 1]];
    if (w.length >= 3) {
      const pre = ix.vocab.filter((v) => v.startsWith(w)).slice(0, 12);
      if (pre.length) return pre.map((v) => [v, 0.7] as [string, number]);
    }
    if (w.length >= 5) return ix.vocab.filter((v) => oneEditApart(w, v)).slice(0, 6).map((v) => [v, 0.5] as [string, number]);
    return [];
  }

  // ---- 3b. BM25 ranking ----
  // score(doc) = sum over query words of  idf(word) * tf * (K1 + 1) / (tf + K1 * (1 - B + B * docLength / averageLength))
  // idf makes rare words count more ("thermodynamics" beats "introduction"); the tf part saturates, so the tenth
  // repeat of a word adds little; B discounts long documents.
  const K1 = 1.2, B = 0.75;
  function search(ix: AskIndex, query: string, k: number, kind?: 'c' | 'p'): AskHit[] {
    const scores: Record<number, number> = {};
    const N = ix.docs.length;
    for (const q of tokenize(query))
      for (const [w, weight] of expand(ix, q)) {
        const list = ix.postings[w]!;
        const idf = Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5));
        for (const [d, tf] of list) scores[d] = (scores[d] || 0) + weight * idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * ix.len[d]!) / ix.avg));
      }
    return Object.keys(scores).map(Number).filter((d) => !kind || ix.docs[d]!.k === kind)
      .sort((a, b) => scores[b]! - scores[a]! || a - b).slice(0, k).map((d) => ({ doc: ix.docs[d]!, score: scores[d]! }));
  }

  // ---- 4. intent ----
  /** First rule that matches wins, so the order matters: "which majors require X" is about majors, not prerequisites. */
  const INTENTS: Array<[string, RegExp]> = [
    ['majors', /\b(which|what|how many) (majors?|degrees?|programs?|plans?)\b|\bmajors? (require|need|include|use|take)|\bwho (needs|takes)\b|\brequired (for|by|in)\b|\b(in|on|part of) (the )?[a-z &]+ (major|plan|degree|roadmap)\b/],
    ['unlocks', /\bunlocks?\b|\b(leads?|opens?) (to|up)\b|\bwhat (comes|can i take|is) (after|next)\b|\bafter\b|\bnext\b/],
    ['prereq', /prereq|pre-req|\bbefore\b|\bneed(ed)? (for|to take|before)\b|\brequire(s|d|ments)?\b|\beligible\b|\bcan i take\b|coreq|co-req|\bsame (time|term|semester)\b|\balongside\b/],
    ['credits', /\bcredits?\b|\bhow (long|many hours)\b|\bhours\b/],
    ['year', /\b(first|second|third|fourth|fifth|freshman|sophomore|junior|senior)\b|\byear (one|two|three|four|five|[1-5])\b/],
  ];
  const intentOf = (q: string): string => (INTENTS.find(([, re]) => re.test(q.toLowerCase())) || ['', /x/])[0];
  const YEARS: Array<[RegExp, number]> = [[/first|freshman|year (one|1)/, 0], [/second|sophomore|year (two|2)/, 1], [/third|junior|year (three|3)/, 2], [/fourth|senior|year (four|4)/, 3], [/fifth|year (five|5)/, 4]];

  // ---- 5. answer from stored facts only ----
  const CATALOG = 'https://catalog.vt.edu/course-descriptions/';
  const list = (xs: string[], max: number): string => xs.slice(0, max).join(', ') + (xs.length > max ? ` and ${xs.length - max} more` : '');
  const courseSources = (d: AskDoc): AskSource[] => [
    { label: `${d.id} in the catalog`, href: CATALOG + d.id.split(' ')[0]!.toLowerCase() + '/', external: true },
    ...(d.mj || []).slice(0, 3).map(([slug, name]) => ({ label: `${name} plan`, href: `plan/${slug}.html` })),
  ];

  // ---- 5a. "can I take it": evaluate a prerequisite tree against the courses the student lists ----
  /** The course being asked about is the code right after one of these phrases; every other code in the question is one they have. */
  const TARGET = /\b(?:can i (?:take|enroll in|register for|get into)|could i take|able to take|eligible (?:for|to take)|ready (?:for|to take)|(?:need|missing|left) (?:for|before|to take))\s+([a-z]{2,4})[\s-]?(\d{4}h?)\b/;
  const evE = (e: AskExpr, has: (c: string) => boolean): boolean =>
    typeof e === 'string' ? has(e) : e[0] === '&' ? e.slice(1).every((x) => evE(x as AskExpr, has)) : e.slice(1).some((x) => evE(x as AskExpr, has));
  /** What is still missing, as a smaller tree. null = nothing. An "or" group is met by any one branch; an "and" group keeps only its unmet parts. */
  const rest = (e: AskExpr, has: (c: string) => boolean): AskExpr | null => {
    if (typeof e === 'string') return has(e) ? null : e;
    const parts = e.slice(1).map((x) => rest(x as AskExpr, has));
    if (e[0] === '|') return parts.some((p) => p === null) ? null : ['|', ...(parts as AskExpr[])];
    const left = parts.filter((p) => p !== null) as AskExpr[];
    return left.length === 0 ? null : left.length === 1 ? left[0]! : ['&', ...left];
  };
  const leavesE = (e: AskExpr): string[] => (typeof e === 'string' ? [e] : e.slice(1).flatMap((x) => leavesE(x as AskExpr)));
  /** The tree with these courses removed: an "or" group loses those branches, an "and" group that needs one becomes impossible (null). */
  const prune = (e: AskExpr, gone: string[]): AskExpr | null => {
    if (typeof e === 'string') return gone.includes(e) ? null : e;
    const parts = e.slice(1).map((x) => prune(x as AskExpr, gone));
    if (e[0] === '&') return parts.some((x) => x === null) ? null : parts.length === 1 ? parts[0]! : ['&', ...(parts as AskExpr[])];
    const ok = parts.filter((x) => x !== null) as AskExpr[];
    return ok.length === 0 ? null : ok.length === 1 ? ok[0]! : ['|', ...ok];
  };
  const NEGATION = /\b(without|w\/o|except|haven'?t (?:taken|had|done)|have not (?:taken|had|done)|never (?:took|taken|had)|didn'?t take|did not take|not taking|no)\b/;
  /** "what can I take now / next / after that": which courses the listed ones open up. */
  const NEXT = /\bwhat (?:can|could|should) i take (?:now|next|after)\b|\bwhat(?:'s| is) next\b|\bwhat (?:does|do) (?:that|those|these|they) (?:unlock|open)\b|\bwhat (?:am i|i am) (?:eligible|ready) for\b/;
  const show = (e: AskExpr, top = true): string =>
    typeof e === 'string' ? e : (top ? '' : '(') + e.slice(1).map((x) => show(x as AskExpr, false)).join(e[0] === '&' ? ' and ' : ' or ') + (top ? '' : ')');

  /** The same, for questions that name a course: offerings, sections and people are not in the facts either. */
  const SCOPE_ANY = /\b(offered|offering|sections?|seats|who teach(?:es)?|teaches|taught|professors?|profs?|instructors?|eas(?:y|ier|iest)|hard(?:er|est)?|difficult|gpa|grades?|curve|workload)\b/;
  /** Questions about ease, grades, people, or "gen eds" in general: nothing in the stored facts answers them. */
  const OPINION = /\b(eas(?:y|ier|iest)|hard(?:er|est)?|difficult|best|worst|professors?|profs?|teachers?|instructors?|gpa|grades?|curve|workload|blow ?off|gen ?eds?)\b/;

  // ---- 5b. "what <subject> do <group> majors take" ----
  const GROUP = /\b(?:what|which)\s+(?:kind of\s+|level of\s+)?([a-z]+)\s*(?:class|classes|course|courses)?\s*(?:do|does|should|will|would)\s+(.+?)\s+(?:majors?|students?)\s+(?:take|need|have to take|start with)\b/;
  /** Everyday words for a subject -> its course prefix. `title` narrows it ("calc" means calculus courses, not all of MATH). */
  const SUBJECTS: Record<string, { code: string; word: string; title?: RegExp }> = {
    calc: { code: 'MATH', word: 'calculus', title: /calcul/i }, calculus: { code: 'MATH', word: 'calculus', title: /calcul/i },
    math: { code: 'MATH', word: 'math' }, maths: { code: 'MATH', word: 'math' },
    physics: { code: 'PHYS', word: 'physics' }, chem: { code: 'CHEM', word: 'chemistry' }, chemistry: { code: 'CHEM', word: 'chemistry' },
    english: { code: 'ENGL', word: 'English' }, writing: { code: 'ENGL', word: 'writing' },
    stats: { code: 'STAT', word: 'statistics' }, statistics: { code: 'STAT', word: 'statistics' },
    programming: { code: 'CS', word: 'programming' }, coding: { code: 'CS', word: 'programming' },
    bio: { code: 'BIOL', word: 'biology' }, biology: { code: 'BIOL', word: 'biology' },
    econ: { code: 'ECON', word: 'economics' }, economics: { code: 'ECON', word: 'economics' }, accounting: { code: 'ACIS', word: 'accounting' },
  };

  function answer(ix: AskIndex, query: string): AskAnswer {
    // "MATH 1225 and 1226" means "MATH 1225 and MATH 1226": a bare number after a code takes that code's subject.
    const q = query.trim().replace(/\b([A-Za-z]{2,4})[\s-]?(\d{4}[Hh]?)((?:\s*(?:,|and|or|&|\/)\s*\d{4}[Hh]?\b)+)/g,
      (_m, sub: string, n: string, more: string) => `${sub} ${n}${more.replace(/(\d{4}[Hh]?)/g, `${sub} $1`)}`);
    const related = search(ix, q, 6);
    if (!q) return { intent: 'none', lines: [], sources: [], related: [] };
    let intent = intentOf(q);
    // A course code written out is an exact lookup: no ranking needed.
    const coded = words(q).map((w) => ix.byCode[w]).filter((i) => i !== undefined).map((i) => ix.docs[i!]!);
    const bestCourse = coded[0] ? { doc: coded[0], score: Infinity } : search(ix, q, 1, 'c')[0];
    // For "how many credits is Architecture", the word "credits" must not pick a major with "Credit" in its name.
    const bestPlan = search(ix, intent === 'credits' ? q.replace(/\b(credits?|credit hours?|hours?)\b/gi, ' ') : q, 1, 'p')[0];
    // "Mathematics (Major)" means the main Mathematics Major, not whichever option ranked first, unless a word of
    // the question names an option.
    const preferBase = (p: AskDoc): AskDoc => {
      const base = p.title.split(/ Major\b/)[0]!, baseWords = tokenize(base);
      const own = ix.docs.find((d) => d.k === 'p' && (d.title === base + ' Major' || d.title === base));
      if (!own || own === p) return p;
      const extra = tokenize(q).filter((t) => !baseWords.includes(t) && !/^[a-z]{2,4}\d{4}h?$/.test(t) && !/^(require|required|credit|hour|option|plan|need|part|course|take|long|total)$/.test(t));
      return extra.some((t) => tokenize(p.title).includes(t)) ? p : own;
    };
    // Course or plan? A written code decides it. Otherwise questions about credits or a year are about a plan,
    // and after that the higher retrieval score wins.
    // A bare major name ("finance") should open the major, even if some course title matches the word more tightly.
    const planTitle = bestPlan ? tokenize(bestPlan.doc.title) : [];
    const namesPlan = !intent && tokenize(q).length > 0 && tokenize(q).every((t) => planTitle.includes(t));
    const planFirst = !coded[0] && bestPlan && (intent === 'credits' || intent === 'year' || namesPlan || !bestCourse || bestPlan.score >= bestCourse.score);

    // "easy gen eds", "best professor for calc": opinions, grades and people are not in the catalog facts. Without
    // this rule the search still found some course ("Plants, Genes, and People" for "gen eds") and answered about it.
    // "who teaches CS 3114", "when is CS 3114 offered": a course code does not make these answerable.
    if (coded[0] && SCOPE_ANY.test(q.toLowerCase()))
      return { intent: 'scope', related: [], sources: courseSources(coded[0]).slice(0, 1), lines: [
        'Ask only knows catalog facts: prerequisites, what a course unlocks, and which plans include it. It has nothing on when a course is offered, who teaches it, grades, or how hard it is.',
        `The university's timetable of classes lists when ${coded[0].id} is offered and who teaches it. To see what it requires, ask "what do I need before ${coded[0].id}".`] };
    // "Can I double major in CS and Math?": that is what the Switch majors page is for.
    if (/\b(double major|second major|dual degree|switch(?:ing)? (?:my )?majors?|chang(?:e|ing) (?:my )?majors?)\b/i.test(q))
      return { intent: 'compare', related: [], sources: [{ label: 'Switch majors or add one', href: 'plan/compare.html' }], lines: [
        'Use Switch majors on this site: pick two majors to see which courses carry over, and how many extra credits a switch or a double major takes.',
        'It is an estimate from the two plans. The departments decide what counts twice, so confirm a double major with both advisors.'] };
    if (!coded[0] && OPINION.test(q.toLowerCase()))
      return { intent: 'scope', related: [], sources: [], lines: [
        'Ask only knows catalog facts: prerequisites, what a course unlocks, and what each degree plan contains. It has nothing on how easy a course is, grades, or who teaches it.',
        'For general education (Pathways) choices, open your major\'s plan: every Pathways slot is listed there, and your advisor can suggest courses that fit.'] };

    // "I have taken CS 2506. Can I take CS 3214?": the course asked about, plus what the student already has.
    // Worked out here from the and/or tree, exactly. A small language model gets this wrong: in testing it said
    // yes to all 16 such questions, 8 of which were no (bench/rag.eval.ts).
    const ask = TARGET.exec(q.toLowerCase());
    const target = ask ? ix.docs[ix.byCode[ask[1]! + ask[2]!] ?? -1] : undefined;
    // Codes after "without", "haven't taken" and the like are courses the student does NOT have.
    const codesIn = (t: string) => [...new Set(words(t).filter((w) => /^[a-z]{2,4}\d{4}h?$/.test(w)).map((w) => w.replace(/^([a-z]+)/, '$1 ').toUpperCase()))];
    const neg = NEGATION.exec(q.toLowerCase());
    const lacking = neg ? codesIn(q.slice(neg.index)).filter((c) => c !== target?.id) : [];
    const held = codesIn(neg ? q.slice(0, neg.index) : q).filter((c) => c !== target?.id && !lacking.includes(c));
    if (target && (held.length || lacking.length)) {
      const name = `${target.id} ${target.title}`;
      const has = (c: string) => held.includes(c);
      const leaves = target.pe ? leavesE(target.pe) : [];
      const notListed = lacking.filter((c) => !leaves.includes(c));
      // The tree with the lacking courses taken out: null when there is no route left.
      const pruned = target.pe ? prune(target.pe, lacking) : null;
      const without = lacking.length ? ` without ${lacking.join(' or ')}` : '';
      const first = !target.pre ? `Yes, as far as prerequisites go: the catalog lists none for ${name}.`
        : !target.pe ? ''
        : lacking.length && notListed.length === lacking.length
          ? `${lacking.join(' and ')} ${lacking.length === 1 ? 'is not a listed prerequisite' : 'are not listed prerequisites'} for ${name}. ` +
            (held.length ? (evE(target.pe, has) ? `And ${held.join(' and ')} cover what it does list.` : `It still needs ${show(rest(target.pe, has)!)}.`) : `It needs ${show(target.pe)}.`)
        : pruned === null ? `No. ${name} requires ${lacking.join(' and ')}: the catalog lists no other way in.`
        : evE(pruned, has) ? `Yes. ${held.join(' and ')} cover${held.length === 1 ? 's' : ''} the prerequisites the catalog lists for ${name}${without}.`
        : `${held.length ? 'No, not yet' : 'Not with nothing else'}. ${without ? `Without ${lacking.join(' or ')}, before` : 'Before'} ${name} you still need ${show(rest(pruned, has)!)}.`;
      const lines = [
        first || `This site cannot check ${name} automatically: its prerequisites are not written as a plain and/or list.`,
        ...(target.pre ? [`Its listed prerequisites: ${target.pre}.`] : []),
        ...(target.co ? [`Corequisites (same term or earlier): ${target.co}.`] : []),
        'This checks listed course prerequisites only, not minimum grades, placement scores or major restrictions.',
      ];
      return { intent: 'eligible', lines, sources: courseSources(target), related: [{ doc: target, score: Infinity }, ...related.filter((h) => h.doc !== target)], ...(first ? { checked: first } : {}) };
    }

    // "I took MATH 1225 and 1226, what can I take now?": courses whose listed prerequisites those now meet.
    const mine = codesIn(q).filter((c) => ix.byCode[c.toLowerCase().replace(' ', '')] !== undefined);
    if (mine.length && NEXT.test(q.toLowerCase())) {
      const has = (c: string) => mine.includes(c);
      const open = ix.docs.filter((d) => d.k === 'c' && d.pe && !mine.includes(d.id) && leavesE(d.pe).some(has) && evE(d.pe, has));
      const partly = ix.docs.filter((d) => d.k === 'c' && d.pe && !mine.includes(d.id) && leavesE(d.pe).some(has) && !evE(d.pe, has)).length;
      return { intent: 'next', related, sources: mine.map((c) => courseSources(ix.docs[ix.byCode[c.toLowerCase().replace(' ', '')]!]!)[0]!), lines: [
        open.length ? `With ${mine.join(' and ')}, you meet the listed prerequisites for: ${list(open.map((d) => `${d.id} ${d.title}`), 15)}.`
          : `No course has its prerequisites fully met by ${mine.join(' and ')} alone.`,
        ...(partly ? [`${partly} more course${partly === 1 ? '' : 's'} also need${partly === 1 ? 's' : ''} ${mine.length === 1 ? 'it' : 'one of these'} plus something else. Ask "what does ${mine[0]} unlock" to see them.`] : []),
        'Prerequisites only: corequisites, minimum grades and major restrictions are not checked.'] };
    }

    // "CS 2114 vs CS 2505": answer for each course, side by side.
    if (coded.length >= 2 && /\bvs\.?\b|\bversus\b|\bcompare\b|\bdifference\b|\bdiffer\b/i.test(q)) {
      const cs = [...new Set(coded)].slice(0, 3);
      return { intent: 'compare', related, sources: cs.map((d) => courseSources(d)[0]!), lines: cs.map((d) =>
        `${d.id} ${d.title}: prerequisites ${d.pre || 'none listed'}; needed first by ${d.un && d.un.length ? list(d.un, 6) : 'no course'}; on ${d.n || 0} plan${d.n === 1 ? '' : 's'}.`) };
    }

    // "What calc class do business majors take?": a subject and a group of majors, not one course. Without this
    // rule the question matched the course "Business Calculus" and listed two unrelated majors that require it.
    const grp = !coded[0] ? GROUP.exec(q.toLowerCase()) : null;
    const subj = grp ? SUBJECTS[grp[1]!] ?? (ix.docs.some((d) => d.k === 'c' && d.id.startsWith(grp[1]!.toUpperCase() + ' ')) ? { code: grp[1]!.toUpperCase(), word: grp[1]!.toUpperCase() } : undefined) : undefined;
    const planHits = grp && subj ? search(ix, grp[2]!, 40, 'p') : [];
    if (grp && subj && planHits[0]) {
      // "business" names a whole college; "finance" names one major.
      const want = tokenize(grp[2]!);
      const inCollege = ix.docs.filter((d) => d.k === 'p' && want.length > 0 && want.every((t) => tokenize(d.college || '').includes(t)));
      const group = inCollege.length > 1 ? inCollege : [planHits[0].doc];
      const titleOf = (code: string) => ix.docs[ix.byCode[code.toLowerCase().replace(' ', '')] ?? -1]?.title ?? '';
      const slotsOf = (p: AskDoc, strict: boolean): Array<[string, string]> =>
        (p.terms || []).flatMap(([label, items]) => items
          .filter((x) => (x.match(/[A-Z]{2,4} \d{4}H?/g) || []).some((c) => c.startsWith(subj.code + ' ') && (!strict || !subj.title || subj.title.test(titleOf(c)))))
          .map((x): [string, string] => [x, label]));
      const strict = group.some((p) => slotsOf(p, true).length > 0);
      const sources = group.slice(0, 4).map((p) => ({ label: `${p.title} plan`, href: `plan/${p.id}.html` }));
      if (group.length === 1) {
        const p = group[0]!, found = slotsOf(p, strict);
        return { intent: 'group', related, sources, lines: [found.length
          ? `On the ${p.title} plan, the ${subj.word} courses are: ${found.map(([x, label]) => `${x} (${label})`).join('; ')}.`
          : `The ${p.title} plan does not name a ${subj.word} course. It may still fit an elective slot: open the plan to check.`,
          'If you meant a different major, pick it from "Closest matches".'] };
      }
      const count: Record<string, number> = {};
      for (const p of group) for (const x of new Set(slotsOf(p, strict).map(([slot]) => slot))) count[x] = (count[x] || 0) + 1;
      const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return { intent: 'group', related, sources, lines: [top.length
        ? `Across the ${group.length} ${group[0]!.college} majors on this site, the ${subj.word} courses are: ${top.map(([x, n]) => `${x} (${n} of ${group.length} plans)`).join('; ')}.`
        : `None of the ${group.length} ${group[0]!.college} plans on this site names a ${subj.word} course.`,
        'It depends on the major: open yours to see the exact course and term.'] };
    }

    // "Is CS 3114 required for Computer Engineering?": a course AND a plan. Answer yes or no from the plan's own terms.
    if (coded[0] && bestPlan && intent === 'majors' && bestPlan.score > 2) {
      const c = coded[0], p = preferBase(bestPlan.doc);
      const term = (p.terms || []).find(([, items]) => items.some((x) => x.startsWith(c.id)));
      return { intent: 'majors', related, sources: [{ label: `${p.title} plan`, href: `plan/${p.id}.html` }, ...courseSources(c).slice(0, 1)],
        lines: [term ? `Yes. ${c.id} ${c.title} is on the ${p.title} plan, in ${term[0]}.` : `${c.id} ${c.title} is not a named course on the ${p.title} plan. It could still count as an elective: check the plan's elective slots.`] };
    }

    if (planFirst && bestPlan) {
      const p = bestPlan.doc, terms = p.terms || [];
      const kind = p.draft ? 'the official catalog requirements, in a suggested term order' : 'the official catalog roadmap';
      const sources = [{ label: `${p.title} plan`, href: `plan/${p.id}.html` }];
      // "credits for finance": Finance is four options here, and the search liked the one with "Credit" in its name.
      // When the question names only the major, list every option of it; a word from one option's name picks that option.
      const base = p.title.split(/ Major\b/)[0]!, baseWords = tokenize(base);
      const family = ix.docs.filter((d) => d.k === 'p' && (d.title === base || d.title.startsWith(base + ' Major')));
      const onlyTheMajor = tokenize(q).every((t) => baseWords.includes(t) || /^(credit|hour|long|total|option)$/.test(t));
      if (family.length > 1 && onlyTheMajor && intent !== 'year') {
        const short = (d: AskDoc) => d.title.replace(base + ' Major with ', '').replace(/ Option$/, '').replace(/ Major$/, '') || d.title;
        const totals = [...new Set(family.map((d) => d.total))];
        const links = family.slice(0, 8).map((d) => ({ label: `${d.title} plan`, href: `plan/${d.id}.html` }));
        return { intent: intent === 'credits' ? 'credits' : 'plan', related, sources: links, lines: [
          totals.length === 1
            ? `${base} has ${family.length} options on this site, and each takes ${totals[0]} credits: ${family.map(short).join('; ')}.`
            : `${base} has ${family.length} options on this site: ${family.map((d) => `${short(d)} (${d.total} credits)`).join('; ')}.`,
          'Pick one below to see its term-by-term plan.'] };
      }
      if (intent === 'credits') return { intent, related, sources, lines: [`${p.title} takes ${p.total} credits, laid out over ${terms.length} terms.`, `Source: ${kind}.`] };
      const year = YEARS.find(([re]) => re.test(q.toLowerCase()));
      if (intent === 'year' && year) {
        const picked = terms.filter(([label]) => label.toLowerCase().startsWith(['first', 'second', 'third', 'fourth', 'fifth'][year[1]]!));
        if (picked.length) return { intent, related, sources, lines: [...picked.map(([label, items]) => `${label}: ${items.join(', ')}.`), `Source: ${kind} for ${p.title}.`] };
      }
      return { intent: 'plan', related, sources, lines: [`${p.title} (${p.college}) takes ${p.total} credits over ${terms.length} terms.`, ...(terms[0] ? [`It starts with: ${terms[0][1].join(', ')}.`] : []), `Source: ${kind}. Open the plan to move courses around.`] };
    }

    if (bestCourse) {
      const c = bestCourse.doc, name = `${c.id} ${c.title}`, sources = courseSources(c);
      const pre = c.pre ? `${name} lists these prerequisites: ${c.pre}.` : `The catalog lists no prerequisites for ${name}.`;
      const co = c.co ? `Corequisites (same term or earlier): ${c.co}.` : '';
      const un = c.un && c.un.length ? `Courses that list ${c.id} as a prerequisite or corequisite: ${list(c.un, 12)}.` : `No course in this site's data lists ${c.id} as a prerequisite.`;
      // "data structures prereqs": CS 2114, CS 3114 and ECE 3514 all have "Data Structures" in the title. When no
      // code was typed and other courses match about as well, answer for each instead of silently picking one.
      const close = coded[0] ? [] : search(ix, q, 4, 'c').filter((h) => h.doc !== c && h.score >= bestCourse.score * 0.9).slice(0, 2);
      if (close.length && (intent === 'prereq' || intent === 'unlocks')) {
        const all = [c, ...close.map((h) => h.doc)];
        const line = (d: AskDoc) => intent === 'prereq'
          ? `${d.id} ${d.title}: ${d.pre ? d.pre : 'no prerequisites listed'}.`
          : `${d.id} ${d.title}: ${d.un && d.un.length ? list(d.un, 8) : 'nothing lists it as a prerequisite'}.`;
        return { intent, related, sources: all.map((d) => courseSources(d)[0]!), lines: [
          `${all.length} courses match that name. ${intent === 'prereq' ? 'Prerequisites for each' : 'Courses that need each one first'}:`, ...all.map(line)] };
      }
      // c.mj holds at most 12 names while c.n is the full count, so "and N more" is worked out from c.n.
      const named = (c.mj || []).map((m) => m[1]).slice(0, 8);
      const mj = c.n ? `${c.n} plan${c.n === 1 ? ' on this site includes' : 's on this site include'} ${c.id}: ${named.join(', ')}${c.n > named.length ? ` and ${c.n - named.length} more` : ''}.` : `No plan on this site names ${c.id} as a required course.`;
      if (intent === 'prereq') return { intent, related, sources, lines: [pre, co].filter(Boolean) };
      if (intent === 'unlocks') return { intent, related, sources, lines: [un] };
      if (intent === 'majors') return { intent, related, sources: [sources[0]!, ...(c.mj || []).slice(0, 8).map(([slug, n]) => ({ label: `${n} plan`, href: `plan/${slug}.html` }))], lines: [mj] };
      return { intent: 'course', related, sources, lines: [pre, co, un, mj].filter(Boolean) };
    }

    return { intent: 'none', related, sources: [], lines: ['I could not match that to a course or a major. Try a course code like "CS 2114" or a major name.'] };
  }

  return { tokenize, buildIndex, expand, search, intentOf, answer };
}

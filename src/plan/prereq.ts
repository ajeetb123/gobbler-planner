// Prerequisites: parse the catalog's "A and (B or C)" text (data/prereqs.txt) and check a plan against it.

/** A course code, or ['&', ...] (all of) / ['|', ...] (one of). Plain arrays so it ships to the browser as JSON. */
export type Expr = string | ['&' | '|', ...Expr[]];

export interface CourseInfo {
  code: string;
  title: string;
  /** Catalog text, kept for display. */
  preText: string;
  coText: string;
  /** Undefined when there is none, or when the catalog text is not a clean and/or list (then it is not checked). */
  pre?: Expr;
  co?: Expr;
}

/** "and" binds tighter than "or"; a comma means "and". Anything else in the text makes it unreadable: returns undefined. */
export function parseExpr(text: string): Expr | undefined {
  const tokens = text.replace(/\.$/, '').match(/[A-Z]{2,4} \d{4}H?|\(|\)|,|[A-Za-z0-9]+|\S/g) ?? [];
  let i = 0;
  let bad = tokens.length === 0;
  const isAnd = (t?: string) => t === ',' || t?.toLowerCase() === 'and';
  const atom = (): Expr => {
    const t = tokens[i++];
    if (t === '(') {
      const e = or();
      if (tokens[i++] !== ')') bad = true;
      return e;
    }
    if (t === undefined || !/^[A-Z]{2,4} \d{4}H?$/.test(t)) bad = true;
    return t ?? '';
  };
  const list = (op: '&' | '|', next: () => Expr, more: (t?: string) => boolean): Expr => {
    const parts = [next()];
    while (more(tokens[i])) { i++; parts.push(next()); }
    return parts.length === 1 ? parts[0]! : [op, ...parts];
  };
  const and = (): Expr => list('&', atom, isAnd);
  const or = (): Expr => list('|', and, (t) => t?.toLowerCase() === 'or');
  const e = or();
  return bad || i < tokens.length ? undefined : e;
}

export function parsePrereqs(text: string): Map<string, CourseInfo> {
  const out = new Map<string, CourseInfo>();
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    const [code, title, preText, coText] = line.split('|').map((s) => s.trim());
    if (!code || title === undefined || preText === undefined || coText === undefined) throw new Error(`Bad prerequisite line: ${line}`);
    out.set(code, { code, title, preText, coText, pre: parseExpr(preText), co: parseExpr(coText) });
  }
  return out;
}

export interface CheckItem {
  /** Every course code this slot can stand for: the course, its "or" alternatives, its listed choices. */
  cs: string[];
  pre?: Expr;
  co?: Expr;
}

export interface Issue {
  /** Ids of items that must come before this one but do not. */
  late: string[];
  /** Ids of corequisites that sit in a later term. */
  coLate: string[];
  /** Codes of later courses that need this one. */
  unlocks: string[];
  /** Items this one cannot do without, as [item id, gap]: gap 1 = must be in an earlier term, 0 = same term or earlier. Does not depend on where things sit. */
  needs: Array<[string, number]>;
  /** Terms this course can slip before a chain of later courses runs past the last term. Undefined when nothing depends on it. */
  slack?: number;
}

/**
 * Check a laid-out plan. `terms` is item ids per term; `done` items count as already taken.
 * Only the parts of a requirement that this plan's courses can meet are checked: in an "and", every part with a
 * course in the plan is checked and parts with none are skipped; in an "or", the options in the plan are checked,
 * and the whole "or" is skipped only when none of its options is in the plan (a placement test, an honors
 * version or a course off the roadmap may cover it, and this page cannot see those).
 * Self-contained on purpose: plan-page.ts ships this function's source to the browser. Do not use imports in it.
 */
export function planIssues(items: Record<string, CheckItem>, terms: string[][], done: string[]): Record<string, Issue> {
  const ev = (e: Expr, f: (c: string) => boolean): boolean =>
    typeof e === 'string' ? f(e) : e[0] === '&' ? e.slice(1).every((x) => ev(x, f)) : e.slice(1).some((x) => ev(x, f));
  const leaves = (e: Expr, out: string[]): string[] => {
    if (typeof e === 'string') out.push(e); else e.slice(1).forEach((x) => leaves(x, out));
    return out;
  };
  const at: Record<string, number> = {}; // course code -> term it is taken (-1 = done)
  const owner: Record<string, string> = {}; // course code -> item that provides it
  const where: Record<string, number> = {};
  terms.forEach((ids, t) => ids.forEach((id) => {
    where[id] = t;
    const tt = done.includes(id) ? -1 : t;
    for (const c of items[id]!.cs) if (at[c] === undefined || tt < at[c]) { at[c] = tt; owner[c] = id; }
  }));
  // The part of e that courses in this plan can meet, or null when none can. In an "and" the parts with nothing
  // in the plan drop out; in an "or" only the options in the plan remain.
  const inPlanPart = (e: Expr): Expr | null => {
    if (typeof e === 'string') return at[e] !== undefined ? e : null;
    const parts = e.slice(1).map((x) => inPlanPart(x)).filter((x): x is Expr => x !== null);
    if (parts.length === 0) return null;
    return parts.length === 1 ? parts[0]! : ([e[0], ...parts] as Expr);
  };
  const out: Record<string, Issue> = {};
  const edges: Record<string, Array<[string, number]>> = {};
  for (const id in where) out[id] = { late: [], coLate: [], unlocks: [], needs: [] };
  for (const id in where) {
    if (done.includes(id)) continue;
    const it = items[id]!, t = where[id]!;
    ([[it.pre, 1, out[id]!.late], [it.co, 0, out[id]!.coLate]] as const).forEach(([full, gap, list]) => {
      const e = full ? inPlanPart(full) : null;
      if (!e) return;
      const ok = (c: string) => at[c] !== undefined && at[c] <= t - gap;
      const inPlan = [...new Set(leaves(e, []).filter((c) => at[c] !== undefined && owner[c] !== id).map((c) => owner[c]!))];
      // An item is needed when the requirement cannot be met without it.
      const needed = inPlan.filter((j) => !ev(e, (c) => at[c] !== undefined && owner[c] !== j));
      for (const j of needed) {
        out[id]!.needs.push([j, gap]);
        (edges[j] = edges[j] || []).push([id, gap]);
        if (it.cs[0] && !out[j]!.unlocks.includes(it.cs[0])) out[j]!.unlocks.push(it.cs[0]);
      }
      if (ev(e, ok)) return;
      const isLate = (j: string) => !done.includes(j) && where[j]! > t - gap;
      const late = needed.filter(isLate);
      list.push(...(late.length ? late : inPlan.filter(isLate)));
    });
  }
  const last = terms.length - 1;
  const latest: Record<string, number> = {};
  const visiting: Record<string, boolean> = {};
  const latestOf = (id: string): number => {
    if (latest[id] !== undefined) return latest[id];
    if (visiting[id]) return last; // corequisite pairs point at each other
    visiting[id] = true;
    let v = last;
    for (const [child, gap] of edges[id] || []) v = Math.min(v, latestOf(child) - gap);
    visiting[id] = false;
    return (latest[id] = v);
  };
  for (const id in edges) if (!done.includes(id)) out[id]!.slack = latestOf(id) - where[id]!;
  return out;
}

const CODE_G = /[A-Z]{2,4} \d{4}H?/g;

/** What planIssues needs to know about one roadmap slot. */
export function checkItem(i: { code?: string; alt: string[]; choices: string[] }, courses: Map<string, CourseInfo>): CheckItem {
  const info = i.code ? courses.get(i.code) : undefined;
  const cs = [...(i.code ? [i.code] : []), ...i.alt, ...i.choices.flatMap((c) => c.match(CODE_G) ?? [])];
  return { cs, ...(info?.pre ? { pre: info.pre } : {}), ...(info?.co ? { co: info.co } : {}) };
}

/**
 * Check items for a whole roadmap, keyed by item id. A requirement the official 4-year layout itself does not
 * follow is dropped (CHEM 1035 lists MATH 1225 as a prerequisite, yet the catalog schedules them together:
 * a placement score covers it). That way the official plan never shows a warning.
 */
export function checkItems(officialTerms: Array<{ items: Array<{ id: string; code?: string; alt: string[]; choices: string[] }> }>, courses: Map<string, CourseInfo>, keepAll = false): Record<string, CheckItem> {
  const out: Record<string, CheckItem> = {};
  for (const t of officialTerms) for (const i of t.items) out[i.id] = checkItem(i, courses);
  // A draft's layout is ours, not the catalog's: nothing is excused, every conflict shows.
  if (keepAll) return out;
  const issues = planIssues(out, officialTerms.map((t) => t.items.map((i) => i.id)), []);
  for (const [id, v] of Object.entries(issues)) {
    if (v.late.length) delete out[id]!.pre;
    if (v.coLate.length) delete out[id]!.co;
  }
  return out;
}

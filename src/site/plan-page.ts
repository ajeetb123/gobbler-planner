// Degree planner pages. The page ships the roadmap as JSON; PLAN_JS draws the board and keeps
// the student's changes in their own browser (localStorage). Nothing is sent anywhere.
import { baseYears, byCollege, collegeOf, credits, repack, YEAR_OPTIONS, type Roadmap } from '../plan/roadmap.ts';
import { checkItems, planIssues, type CourseInfo, type Expr } from '../plan/prereq.ts';
import { brand, DISCLAIMER, esc, layout, PRIVACY, RMP_SCHOOL_URL, UDC_URL, type Links } from './render.ts';
import type { Site } from './model.ts';

/** A term above this many credits gets a "heavy load" flag. */
export const HEAVY_CREDITS = 18;
/** Three or more unfinished courses under this course average in one term get a flag. */
export const LOW_GPA = 2.8;
/** University limit for a Fall or Spring term (Policy 6320, Maximum Loads): more than this needs the academic dean's approval. */
export const LIMIT_CREDITS = 19;

export interface PlanData {
  slug: string;
  name: string;
  total: number;
  /** Plan length the page opens on: the roadmap's own layout (4 years, or 5 for a 160-credit draft). */
  base: string;
  heavy: number;
  limit: number;
  low: number;
  /** g = course average GPA, v = instructor-matters verdict, h = link to the course page (all three only with grade data).
   *  cs / pre / co = what planIssues needs: codes this slot stands for, prerequisites, corequisites. */
  items: Record<string, { code?: string; label: string; cr: number; alt: string[]; ch: string[]; cs: string[]; pre?: Expr; co?: Expr; pt?: string; ct?: string; g?: number; v?: string; h?: string }>;
  plans: Record<string, Array<{ label: string; ids: string[] }>>;
}

export function planData(r: Roadmap, courses: Map<string, CourseInfo>, site?: Site, links?: Links): PlanData {
  const byCourse = new Map((site?.courses ?? []).map((c) => [c.course, c]));
  const check = checkItems(r.terms, courses, r.draft);
  const items: PlanData['items'] = {};
  for (const i of r.terms.flatMap((t) => t.items)) {
    const c = i.code ? byCourse.get(i.code) : undefined;
    items[i.id] = {
      code: i.code, label: i.code ? (c?.title ?? courses.get(i.code)?.title ?? i.label.replace(i.code, '').trim()) : i.label, cr: i.credits, alt: i.alt, ch: i.choices,
      ...check[i.id]!,
      // Catalog wording, shown in the course panel.
      pt: (i.code && courses.get(i.code)?.preText) || undefined, ct: (i.code && courses.get(i.code)?.coText) || undefined,
      g: c ? Math.round(c.mean * 100) / 100 : undefined, v: c?.spread.verdict, h: c && links ? `course/${links.course.get(c.course)}.html` : undefined,
    };
  }
  const plans: PlanData['plans'] = {};
  for (const y of YEAR_OPTIONS) plans[String(y)] = repack(r, y, check).map((t) => ({ label: t.label, ids: t.items.map((i) => i.id) }));
  return { slug: r.slug, name: r.name, total: credits(r.terms.flatMap((t) => t.items)), base: String(baseYears(r)), heavy: HEAVY_CREDITS, limit: LIMIT_CREDITS, low: LOW_GPA, items, plans };
}

/**
 * Planner script. State per major in localStorage: chosen length, moved courses, finished courses.
 * Every redraw runs planIssues (the same function the tests cover, shipped as source): a course placed before a
 * prerequisite gets a note, a course with no room to slip gets a "can't slip" tag.
 * Share: the state travels in the URL hash (#y=years&d=done ids&m=id_term moves). A plan opened from such a link
 * is shown but not saved until the visitor chooses "Keep as my plan", so a link never overwrites someone's own plan.
 * Balance: moves unfinished elective slots (items without a course code) from the heaviest
 * Fall/Spring term to the lightest until they are within 3 credits. Named courses never move on their own.
 */
/**
 * Every catalog course the planner can add by hand: code -> [title, credits (0 = not known), prerequisites, corequisites].
 * The course list has no credit values, so credits come from the roadmaps and requirement lists: the value a course
 * most often has when it is a slot of its own. Written to courses.json and fetched only when someone adds a course.
 */
export function courseCatalog(roadmaps: Roadmap[], courses: Map<string, CourseInfo>): Record<string, [string, number, Expr | 0, Expr | 0]> {
  const seen = new Map<string, Map<number, number>>();
  for (const r of roadmaps)
    for (const i of r.terms.flatMap((t) => t.items))
      if (i.code && i.alt.length === 0 && i.credits > 0) {
        const m = seen.get(i.code) ?? new Map<number, number>();
        seen.set(i.code, m.set(i.credits, (m.get(i.credits) ?? 0) + 1));
      }
  const out: Record<string, [string, number, Expr | 0, Expr | 0]> = {};
  for (const c of courses.values()) {
    const m = seen.get(c.code);
    out[c.code] = [c.title, m ? [...m].sort((a, b) => b[1] - a[1])[0]![0] : 0, c.pre ?? 0, c.co ?? 0];
  }
  return out;
}

export const PLAN_JS = `
(() => {
  const planIssues = ${planIssues.toString()};
  const D = JSON.parse(document.getElementById('plan-data').textContent),
    root = document.body.dataset.root,
    KEY = 'gobblerplan:' + D.slug;
  // On a phone the tools start folded away so the courses show sooner; on a wide screen they are always open.
  if (matchMedia('(max-width:860px)').matches) document.getElementById('tools').open = false;
  let S;
  try {
    S = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    S = {};
  }
  const P = new URLSearchParams(location.hash.slice(1));
  let shared = P.has('y');
  // A shared link carries: y (years), d (done ids), m (id_term moves), n (id~name for named elective slots), x (term~credits~name for added courses).
  // Roadmap ids travel without their leading "t" ("0-3"); added courses are plain numbers ("2" = x2). clean() below validates all of it.
  if (shared) {
    const full = (x) => (/^\\d+-\\d+$/.test(x) ? 't' + x : 'x' + x),
      p = {},
      names = {};
    (P.get('m') || '').split('.').forEach((x) => {
      const [a, b] = x.split('_');
      if (a && /^\\d+$/.test(b)) p[full(a)] = +b;
    });
    (P.get('n') || '').split('|').forEach((x) => {
      const i = x.indexOf('~');
      if (i > 0) names[full(x.slice(0, i))] = x.slice(i + 1);
    });
    S = {
      years: P.get('y'),
      pos: { [P.get('y')]: p },
      done: (P.get('d') || '').split('.').filter(Boolean).map(full),
      names,
      extra: (P.get('x') || '')
        .split('|')
        .filter(Boolean)
        .map((x, i) => {
          const [t, c, ...l] = x.split('~');
          return { id: 'x' + i, t: +t, cr: +c, label: l.join('~') };
        }),
    };
  }
  // Saved or shared state can be stale or hand-edited: keep only what fits this roadmap.
  // Courses the student added themselves live in S.extra and are merged into the roadmap data here, so the rest of the page treats them like any other course.
  const MAX_EXTRA = 12,
    text = (v, n) => (typeof v === 'string' ? v.replace(/\\s+/g, ' ').trim().slice(0, n) : '');
  // Catalog courses for "Add a course": code -> [title, credits (0 = unknown), prerequisites, corequisites].
  // Fetched once, the first time it is needed.
  let COURSES = null,
    coursesP = null;
  const loadCourses = () =>
    coursesP ||
    (coursesP = fetch(root + 'courses.json')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((c) => (COURSES = c)));
  // "cs2114 ..." or "CS 2114 ..." at the start of the text -> "CS 2114". Empty when it does not start with a course code.
  const CODE_AT_START = /^([A-Za-z]{2,4})[ -]?(\\d{4}[Hh]?)(?![0-9A-Za-z])\\s*/;
  const codeOf = (s) => {
    const m = CODE_AT_START.exec(s);
    return m ? m[1].toUpperCase() + ' ' + m[2].toUpperCase() : '';
  };
  // A prerequisite tree: a code, or ['&', ...] (all of) / ['|', ...] (one of). evx tests it, showx prints it.
  const evx = (e, f) =>
      typeof e === 'string' ? f(e) : e[0] === '&' ? e.slice(1).every((x) => evx(x, f)) : e.slice(1).some((x) => evx(x, f)),
    showx = (e, top) =>
      typeof e === 'string'
        ? e
        : (top ? '' : '(') + e.slice(1).map((x) => showx(x, false)).join(e[0] === '&' ? ' and ' : ' or ') + (top ? '' : ')'),
    // The part of a tree that f does not satisfy, or null: so a flag names only what is missing.
    lackx = (e, f) => {
      if (typeof e === 'string') return f(e) ? null : e;
      if (e[0] === '|') return evx(e, f) ? null : e;
      const parts = e.slice(1).map((x) => lackx(x, f)).filter((x) => x !== null);
      return parts.length === 0 ? null : parts.length === 1 ? parts[0] : ['&', ...parts];
    };
  function merge(extra) {
    for (const id in D.items) if (D.items[id].custom) delete D.items[id];
    for (const y in D.plans)
      D.plans[y].forEach((t) => {
        t.ids = t.ids.filter((id) => !id.startsWith('x'));
      });
    extra.forEach((e) => {
      // A catalog course keeps its code, so its prerequisites are checked like any other course in the plan.
      // Until the catalog has loaded, a label that starts with a code is trusted; once loaded, only real codes are.
      const code = codeOf(e.label),
        info = code && COURSES && COURSES[code];
      D.items[e.id] =
        code && (info || !COURSES)
          ? {
              code,
              label: info ? info[0] : e.label.replace(CODE_AT_START, '') || 'Added course',
              cr: e.cr,
              alt: [],
              ch: [],
              cs: [code],
              pre: (info && info[2]) || undefined,
              co: (info && info[3]) || undefined,
              custom: true,
            }
          : { label: e.label, cr: e.cr, alt: [], ch: [], cs: [], custom: true };
      for (const y in D.plans) D.plans[y][Math.min(e.t, D.plans[y].length - 1)].ids.push(e.id);
    });
  }
  const clean = (s) => {
    s = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
    const seen = {},
      extra = (Array.isArray(s.extra) ? s.extra : [])
        .filter(
          (e) =>
            e &&
            typeof e === 'object' &&
            /^x\\d{1,3}$/.test(e.id) &&
            !seen[e.id] &&
            (seen[e.id] = 1) &&
            text(e.label, 60) &&
            Number.isInteger(e.cr) &&
            e.cr >= 0 &&
            e.cr <= 9 &&
            Number.isInteger(e.t) &&
            e.t >= 0 &&
            e.t < 20,
        )
        .slice(0, MAX_EXTRA)
        .map((e) => ({ id: e.id, label: text(e.label, 60), cr: e.cr, t: e.t }));
    merge(extra);
    const names = {};
    if (s.names && typeof s.names === 'object')
      for (const id in s.names)
        if (D.items[id] && !D.items[id].code && !D.items[id].custom && text(s.names[id], 60))
          names[id] = text(s.names[id], 60);
    const o = {
      years: D.plans[s.years] ? String(s.years) : D.base,
      pos: {},
      done: Array.isArray(s.done) ? [...new Set(s.done.filter((id) => D.items[id]))] : [],
      names,
      extra,
    };
    if (s.pos && typeof s.pos === 'object')
      for (const y in D.plans) {
        const p = s.pos[y];
        if (p && typeof p === 'object') {
          o.pos[y] = {};
          for (const id in p)
            if (D.items[id] && Number.isInteger(p[id]) && p[id] >= 0 && p[id] < D.plans[y].length) o.pos[y][id] = p[id];
        }
      }
    return o;
  };
  S = clean(S);
  const U = [];
  const snap = () => {
    U.push(JSON.stringify(S));
    if (U.length > 40) U.shift();
    $('undo').disabled = false;
  };
  const save = () => {
    if (shared) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch {}
  };
  const el = (t, c, x) => {
    const e = document.createElement(t);
    if (c) e.className = c;
    if (x != null) e.textContent = x;
    return e;
  };
  const $ = (id) => document.getElementById(id),
    board = $('board'),
    yearsEl = $('years'),
    over = $('over');
  // Credits still to take: done courses are not part of a term's load.
  const cr = (ids) => ids.reduce((a, id) => a + (S.done.includes(id) ? 0 : D.items[id].cr), 0),
    short = (l) =>
      l
        .replace(' year, ', ' ')
        .replace('First', 'Y1')
        .replace('Second', 'Y2')
        .replace('Third', 'Y3')
        .replace('Fourth', 'Y4')
        .replace('Fifth', 'Y5')
        .replace('Spring', 'Sp')
        .replace('Summer', 'Su')
        .replace('Fall', 'F');
  function terms() {
    const plan = D.plans[S.years],
      pos = S.pos[S.years] || {},
      out = plan.map((t) => ({ label: t.label, ids: [] }));
    plan.forEach((t, ti) =>
      t.ids.forEach((id) => {
        const p = pos[id];
        out[p != null && p < out.length ? p : ti].ids.push(id);
      }),
    );
    return out;
  }
  function put(id, to) {
    (S.pos[S.years] = S.pos[S.years] || {})[id] = to;
  }
  function move(id, from, d) {
    const to = from + d;
    if (to < 0 || to >= D.plans[S.years].length) return;
    snap();
    put(id, to);
    save();
    draw();
  }
  // Lowest level an elective slot names ("CS 4/5XXX" -> 4). Balancing keeps 3XXX and 4XXX slots out of the early terms.
  const slotLevel = (x) => {
    const m = /\\b([1-5])(?:\\/[1-5])*XXX\\b|\\b([1-5])000[- ]level/i.exec(D.items[x].label || '');
    return m ? Math.min(4, +(m[1] || m[2])) : 0;
  };
  function balance() {
    snap();
    let moved = 0;
    for (let n = 0; n < 60; n++) {
      const ts = terms()
        .map((t, i) => ({ i, ids: t.ids, c: cr(t.ids), su: t.label.includes('Summer') }))
        .filter((t) => !t.su);
      const hi = ts.reduce((a, b) => (b.c > a.c ? b : a)),
        lo = ts.reduce((a, b) => (b.c < a.c ? b : a));
      if (hi.c - lo.c <= 3) break;
      const id = hi.ids.find(
        (x) =>
          !D.items[x].code &&
          !D.items[x].custom &&
          !S.names[x] &&
          !S.done.includes(x) &&
          D.items[x].cr > 0 &&
          D.items[x].cr < hi.c - lo.c &&
          (slotLevel(x) < 3 || lo.i >= Math.floor(((slotLevel(x) - 1) * terms().length) / 4) - 1),
      );
      if (!id) break;
      put(id, lo.i);
      moved++;
    }
    save();
    draw();
    return moved;
  }
  const CAT = 'https://catalog.vt.edu/course-descriptions/',
    UDC = '${UDC_URL}',
    RMP = '${RMP_SCHOOL_URL}',
    NS = 'http://www.w3.org/2000/svg';
  let sel = null,
    LAST = {},
    lines = null;
  // One color per subject (CS, MATH, ...), derived from its letters so it is stable everywhere.
  // Subject colors: twelve shades from one warm family (maroon through orange, ochre, olive and brown), so the board never looks like a rainbow.
  const PALETTE = [
    '#861f41',
    '#e5751f',
    '#b8860b',
    '#c2552d',
    '#7a4b2a',
    '#6b7a2a',
    '#7d3c6b',
    '#a8441c',
    '#8a7560',
    '#b03a5b',
    '#9c6b1f',
    '#5d5348',
  ];
  const hue = (c) => {
    let h = 0;
    for (const ch of c.split(' ')[0]) h = (h * 31 + ch.charCodeAt(0)) % PALETTE.length;
    return PALETTE[h];
  };
  // ---- "Add a course" dialog: pick a catalog course (prerequisites get checked) or type any name ----
  const AD = $('addc'),
    AQ = $('ac-q'),
    AC = $('ac-c'),
    AM = $('ac-m'),
    AS = $('ac-s');
  let addTo = 0;
  const acSay = (m) => {
    AM.textContent = m;
    AM.hidden = !m;
  };
  // The term a course already sits in (as itself, not as an alternative in some slot), or ''.
  const whereIs = (code, except) => {
    const t = terms().find((t) =>
      t.ids.some((id) => id !== except && (D.items[id].code === code || (S.names[id] && codeOf(S.names[id]) === code))),
    );
    return t ? t.label : '';
  };
  // A named elective whose name starts with a catalog code is checked as that course: prerequisites, corequisites,
  // and the courses it stands for. Returns a copy of D.items with those slots filled in.
  const checked = () => {
    const o = {};
    for (const id in D.items) {
      const code = S.names[id] && codeOf(S.names[id]),
        info = code && COURSES && COURSES[code];
      o[id] = info
        ? { ...D.items[id], cs: [code], pre: info[2] || undefined, co: info[3] || undefined, named: code, ncr: info[1] }
        : D.items[id];
    }
    return o;
  };
  const suggest = () => {
    AS.textContent = '';
    acSay('');
    const s = AQ.value.trim().toLowerCase(),
      code = codeOf(AQ.value),
      known = code && COURSES && COURSES[code] && COURSES[code][1];
    // Credits the catalog data already knows are filled in and locked.
    if (known) AC.value = String(known);
    AC.readOnly = !!known;
    if (!COURSES || s.length < 2) return;
    const key = s.replace(/[ -]/g, ''),
      out = [];
    for (const c in COURSES) {
      if (c.toLowerCase().replace(' ', '').startsWith(key) || (s.length > 2 && COURSES[c][0].toLowerCase().includes(s))) out.push(c);
      if (out.length >= 6) break;
    }
    if (out.length === 1 && out[0] === code) return;
    out.forEach((c) => {
      const b = el('button', null, c + ' ' + COURSES[c][0]);
      b.type = 'button';
      b.onclick = () => {
        AQ.value = c + ' ' + COURSES[c][0];
        suggest();
        AQ.focus();
      };
      AS.append(b);
    });
  };
  AQ.addEventListener('input', suggest);
  function openAdd(ti, label) {
    addTo = ti;
    AQ.value = '';
    AC.value = '3';
    AC.readOnly = false;
    AS.textContent = '';
    acSay(S.extra.length >= MAX_EXTRA ? 'You can add up to ' + MAX_EXTRA + ' courses of your own. Remove one first.' : '');
    $('ac-t').textContent = 'Into ' + label + '.';
    AD.showModal();
    AQ.focus();
    loadCourses().then(suggest);
  }
  $('ac-x').onclick = () => AD.close();
  AD.addEventListener('click', (e) => {
    if (e.target === AD) AD.close();
  });
  $('ac-f').addEventListener('submit', (e) => {
    e.preventDefault();
    if (S.extra.length >= MAX_EXTRA) return acSay('You can add up to ' + MAX_EXTRA + ' courses of your own. Remove one first.');
    const typed = text(AQ.value, 60),
      code = codeOf(typed),
      info = code && COURSES && COURSES[code];
    if (!typed) return acSay('Type a course code or a name.');
    const n = parseInt(AC.value, 10);
    if (!(n >= 0 && n <= 9) || String(n) !== AC.value.trim()) return acSay('Credits must be a whole number from 0 to 9.');
    const at = info ? whereIs(code) : '';
    if (at) return acSay(code + ' is already in this plan, in ' + at + '. Move that one instead of adding it twice.');
    const name = info ? text(code + ' ' + info[0], 60) : typed;
    if (S.extra.some((x) => x.label.toLowerCase() === name.toLowerCase())) return acSay('"' + name + '" is already in this plan.');
    snap();
    const xid = 'x' + (Math.max(-1, ...S.extra.map((x) => +x.id.slice(1))) + 1);
    S.extra.push({ id: xid, label: name, cr: n, t: addTo });
    S = clean(S);
    put(xid, addTo);
    save();
    draw();
    AD.close();
  });
  // ---- "name it" dialog: write which course will fill an elective slot ----
  const ND = $('namec'),
    NQ = $('nc-q');
  let naming = null;
  function openName(id) {
    naming = id;
    $('nc-m').hidden = true;
    loadCourses();
    $('nc-t').textContent = 'For "' + D.items[id].label + '". Leave it empty to clear.';
    NQ.value = S.names[id] || '';
    ND.showModal();
    NQ.focus();
  }
  $('nc-x').onclick = () => ND.close();
  ND.addEventListener('click', (e) => {
    if (e.target === ND) ND.close();
  });
  $('nc-f').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!naming || !D.items[naming]) return ND.close();
    const code = codeOf(NQ.value),
      at = code && COURSES && COURSES[code] ? whereIs(code, naming) : '';
    if (at) {
      $('nc-m').textContent = code + ' is already in this plan, in ' + at + '.';
      $('nc-m').hidden = false;
      return;
    }
    snap();
    if (text(NQ.value, 60)) S.names[naming] = text(NQ.value, 60);
    else delete S.names[naming];
    save();
    draw();
    ND.close();
  });
  // "remove" link on a course the student added.
  const removeButton = (id, name) => {
    const x = el('button', 'lnk', 'remove');
    x.type = 'button';
    x.setAttribute('aria-label', 'Remove ' + name);
    x.onclick = () => {
      snap();
      S.extra = S.extra.filter((e) => e.id !== id);
      S = clean(S);
      save();
      draw();
    };
    return x;
  };
  function draw() {
    board.textContent = '';
    over.textContent = '';
    const ts = terms(),
      E = checked(),
      I = planIssues(
        E,
        ts.map((t) => t.ids),
        S.done,
      ),
      nm2 = (j) => D.items[j].code || D.items[j].label,
      // Every course code some slot in the plan stands for (the course, its alternatives, its listed choices).
      inPlan = new Set(ts.flatMap((t) => t.ids).flatMap((id) => E[id].cs || []));
    let doneCr = 0,
      bad = 0,
      firstBad = null;
    const max = Math.max(D.heavy, ...ts.map((t) => cr(t.ids)));
    let yrow = null,
      yname = '';
    ts.forEach((t, ti) => {
      const yr = t.label.split(' year')[0];
      if (yr !== yname) {
        yname = yr;
        const y = el('section', 'year'),
          n = board.querySelectorAll('.year').length;
        y.style.setProperty('--i', String(n));
        const h = el('h2');
        h.append(yr + ' year');
        y.append(h);
        yrow = el('div', 'yrow');
        y.append(yrow);
        board.append(y);
      }
      const card = el(
          'section',
          'term ' + (t.label.includes('Fall') ? 'fall' : t.label.includes('Spring') ? 'spring' : 'summer'),
        ),
        list = el('div');
      card.id = 't' + ti;
      let c = 0,
        dn = 0,
        gs = 0,
        gw = 0,
        low = 0,
        tb = 0;
      t.ids.forEach((id) => {
        const it = E[id],
          done = S.done.includes(id);
        // A course ticked as done (AP, IB, transfer, or already taken) is not a seat in this term: it does not count toward the term's load.
        if (done) {
          doneCr += it.cr;
          dn += it.cr;
        } else c += it.cr;
        if (it.g != null) {
          gs += it.g * it.cr;
          gw += it.cr;
          if (it.g < D.low && !done) low++;
        }
        const li = el('div', 'it' + (done ? ' done' : '')),
          cb = el('input');
        li.draggable = true;
        li.dataset.id = id;
        li.style.setProperty('--i', String(ti));
        if (it.code) li.style.setProperty('--c', hue(it.code));
        li.onclick = (e) => {
          if (e.target.closest('input,button,a')) return;
          sel = sel === id ? null : id;
          paint();
        };
        li.ondragstart = (e) => {
          e.dataTransfer.setData('text/plain', id);
          e.dataTransfer.effectAllowed = 'move';
        };
        cb.type = 'checkbox';
        cb.checked = done;
        cb.setAttribute('aria-label', 'Done: ' + (it.code || it.label));
        cb.onchange = () => {
          snap();
          S.done = cb.checked ? [...S.done, id] : S.done.filter((x) => x !== id);
          save();
          draw();
        };
        const mid = el('div', 'mid'),
          nm = el('div', 'nm');
        if (it.code) {
          const a = el('a', null, it.code);
          if (it.h) a.href = root + it.h;
          else {
            a.href = CAT + it.code.split(' ')[0].toLowerCase() + '/';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.title = 'Catalog description';
          }
          nm.append(a, ' ' + it.label + ' ');
          if (it.custom) nm.append(el('span', 'tag', 'added by you'), removeButton(id, it.code));
        } else if (it.custom) {
          nm.textContent = it.label + ' ';
          nm.append(el('span', 'tag', 'added by you'), removeButton(id, it.label));
        } else {
          nm.textContent = (S.names[id] || it.label) + ' ';
          const ed = el('button', 'lnk', S.names[id] ? 'change' : 'name it');
          ed.type = 'button';
          ed.setAttribute('aria-label', 'Write the course you plan to take for ' + it.label);
          ed.onclick = () => openName(id);
          nm.append(ed);
        }
        mid.append(
          nm,
          el(
            'div',
            'mut',
            it.cr +
              ' cr' +
              (S.names[id] ? ' · fills: ' + it.label : '') +
              (it.alt.length ? ' · or ' + it.alt.join(', ') : '') +
              (it.ch.length ? ' · choose one: ' + it.ch.join(', ') : ''),
          ),
        );
        if (it.g != null) mid.append(el('span', 'tag', 'avg GPA ' + it.g.toFixed(2)));
        if (it.v === 'matters') mid.append(el('span', 'tag hot', 'instructor matters'));
        const v = I[id];
        if (!done && v.slack === 0) {
          const s = el('span', 'tag hot', "can't slip");
          s.title = 'Later courses chain off this one. Moving it later pushes graduation back.';
          mid.append(s);
        }
        if (v.late.length) {
          bad++;
          tb++;
          mid.append(el('div', 'flag', 'Needs ' + v.late.map(nm2).join(', ') + ' in an earlier term'));
        }
        if (v.coLate.length) {
          bad++;
          tb++;
          mid.append(el('div', 'flag', 'Take ' + v.coLate.map(nm2).join(', ') + ' in the same term or earlier'));
        }
        // An added course can need courses that are nowhere in this plan. For roadmap courses such a requirement
        // is skipped (a placement test often covers it); for a course the student chose to add, it is said out loud.
        let missing = false;
        // A catalog course written into an elective slot whose credits differ from the slot's: say so.
        if (it.named && it.ncr && it.ncr !== it.cr && !done)
          mid.append(el('div', 'mut', it.named + ' is ' + it.ncr + ' cr; this slot asks for ' + it.cr + '.'));
        if ((it.custom || it.named) && !done)
          [
            [it.pre, 'Prerequisites'],
            [it.co, 'Corequisites'],
          ].forEach(([e, word]) => {
            if (!e || evx(e, (c) => inPlan.has(c))) return;
            missing = true;
            bad++;
            tb++;
            mid.append(el('div', 'flag', word + ' not in this plan: ' + showx(lackx(e, (c) => inPlan.has(c)), true)));
          });
        if (v.late.length || v.coLate.length || missing) {
          li.classList.add('conflict');
          if (!firstBad) firstBad = li;
        }
        const mv = el('div', 'mv'),
          l = el('button', null, '\\u2190'),
          r = el('button', null, '\\u2192');
        l.setAttribute('aria-label', 'Move ' + (S.names[id] || it.code || it.label) + ' to the term before');
        r.setAttribute('aria-label', 'Move ' + (S.names[id] || it.code || it.label) + ' to the term after');
        l.title = 'Earlier';
        r.title = 'Later';
        l.disabled = ti === 0;
        r.disabled = ti === ts.length - 1;
        // After a move the board redraws and another card's arrow can land under the pointer, so the second click
        // of a double click is ignored (e.detail counts rapid clicks; keyboard presses have detail 0).
        l.onclick = (e) => e.detail < 2 && move(id, ti, -1);
        r.onclick = (e) => e.detail < 2 && move(id, ti, 1);
        mv.append(l, r);
        li.append(cb, mid, mv);
        list.append(li);
      });
      const heavy = c > D.heavy,
        load = el('div', 'meter load'),
        fill = el('i');
      fill.style.width = Math.min(100, (c / max) * 100) + '%';
      if (heavy) fill.style.background = 'var(--acc)';
      load.append(fill);
      card.append(
        el('h3', null, t.label.split(', ')[1] || t.label),
        el('div', 'mut', c + ' credits' + (dn ? ' to take, ' + dn + ' done' : '') + (gw ? ' · typical GPA ' + (gs / gw).toFixed(2) : '')),
        load,
      );
      if (c > D.limit && !t.label.includes('Summer'))
        card.append(
          el(
            'div',
            'flag',
            'Over the limit: ' +
              c +
              ' credits. More than ' +
              D.limit +
              ' in a Fall or Spring term needs approval from your academic dean. Tick off credit you already have, or pick a longer plan.',
          ),
        );
      else if (heavy) card.append(el('div', 'flag', 'Heavy load: ' + c + ' credits'));
      if (low >= 3) card.append(el('div', 'flag', low + ' courses here average below ' + D.low.toFixed(1)));
      if (!heavy && c > 0 && c < 12 && !t.label.includes('Summer') && t.ids.some((id) => !S.done.includes(id)))
        card.append(el('div', 'flag', 'Light term: under 12 credits is usually below full-time'));
      if (!t.ids.length) card.append(el('div', 'mut', 'Nothing planned here.'));
      card.append(list);
      const add = el('button', 'lnk addc', '+ Add a course');
      add.type = 'button';
      add.onclick = () => openAdd(ti, t.label);
      card.append(add);
      card.ondragover = (e) => {
        e.preventDefault();
        card.classList.add('drop');
      };
      card.ondragleave = () => card.classList.remove('drop');
      card.ondrop = (e) => {
        e.preventDefault();
        card.classList.remove('drop');
        const id = e.dataTransfer.getData('text/plain');
        if (D.items[id] && !t.ids.includes(id)) {
          snap();
          put(id, ti);
          save();
          draw();
        }
      };
      yrow.append(card);
      const o = el('a', (heavy ? 'hv' : t.label.includes('Summer') ? 'sm' : '') + (tb ? ' bad' : '')),
        b = el('i');
      o.href = '#t' + ti;
      o.title =
        t.label + ': ' + c + ' credits' + (tb ? ', ' + tb + ' prerequisite conflict' + (tb > 1 ? 's' : '') : '');
      b.style.height = Math.round((c / max) * 52) + 'px';
      o.append(el('span', null, String(c)), b, el('span', null, short(t.label)));
      over.append(o);
    });
    lines = document.createElementNS(NS, 'svg');
    board.append(lines);
    LAST = I;
    const cf = $('conf');
    cf.textContent = bad ? bad + ' prerequisite conflict' + (bad > 1 ? 's' : '') + '. ' : 'No prerequisite conflicts';
    cf.className = bad ? 'flag' : '';
    $('s-conf').className = 'stat ' + (bad ? 'bad' : 'good');
    $('s-conf').firstChild.textContent = bad;
    $('s-load').textContent = Math.max(0, ...ts.map((t) => cr(t.ids)));
    if (firstBad) {
      const go = el('button', 'lnk', 'Show the first one');
      go.type = 'button';
      go.onclick = () => {
        firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstBad.classList.add('pulse');
        setTimeout(() => firstBad.classList.remove('pulse'), 1600);
      };
      cf.append(go);
    }
    const xc = S.extra.reduce((a, e) => a + e.cr, 0),
      all = D.total + xc;
    $('shared').hidden = !shared;
    $('prog').textContent =
      (doneCr >= all && all > 0
        ? 'All ' + all + ' credits done. Congratulations.'
        : doneCr + ' of ' + all + ' credits done') +
      (xc ? ' (' + D.total + ' for the degree, ' + xc + ' you added)' : '');
    $('s-cr').textContent = doneCr + ' / ' + all;
    $('pct').textContent = Math.round(all ? (doneCr / all) * 100 : 0) + '%';
    $('ringfg').style.width = Math.round(Math.min(1, all ? doneCr / all : 0) * 100) + '%';
    [...yearsEl.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.y === S.years)));
    $('note').hidden = S.years === D.base;
    $('summer').hidden = !(+S.years < 4);
    $('fast').hidden = !(+S.years < 3);
    paint();
  }
  // Selecting a course: dim everything unrelated, outline what it needs (accent) and what needs it (teal), draw lines
  // between them, and fill the detail panel. LAST holds the planIssues result of the current drawing.
  function paint() {
    const P2 = $('panel'),
      cards = [...board.querySelectorAll('.it')];
    cards.forEach((e) => e.classList.remove('sel', 'pre', 'post', 'dim'));
    if (lines) lines.textContent = '';
    if (!sel || !D.items[sel] || !LAST[sel]) {
      sel = null;
      P2.hidden = true;
      document.body.classList.remove('haspanel');
      return;
    }
    const v = LAST[sel],
      pre = v.needs.map((x) => x[0]),
      post = Object.keys(LAST).filter((k) => LAST[k].needs.some((x) => x[0] === sel));
    cards.forEach((e) => {
      const id = e.dataset.id;
      e.classList.add(id === sel ? 'sel' : pre.includes(id) ? 'pre' : post.includes(id) ? 'post' : 'dim');
    });
    const br = board.getBoundingClientRect(),
      box = (id) => {
        const e = board.querySelector('[data-id="' + id + '"]');
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return {
          l: r.left - br.left,
          r: r.right - br.left,
          t: r.top - br.top,
          b: r.bottom - br.top,
          x: r.left - br.left + r.width / 2,
          y: r.top - br.top + r.height / 2,
        };
      };
    lines.setAttribute('width', board.offsetWidth);
    lines.setAttribute('height', board.offsetHeight);
    // Side by side (same year): a curve from one card's edge to the other's. Different years: down from the bottom of one to the top of the other.
    const link = (a, b, c) => {
      const A = box(a),
        B = box(b);
      if (!A || !B) return;
      const p = document.createElementNS(NS, 'path');
      let d;
      if (B.t >= A.b || A.t >= B.b) {
        const down = B.t >= A.b,
          y1 = down ? A.b : A.t,
          y2 = down ? B.t : B.b,
          my = (y1 + y2) / 2;
        d = 'M' + A.x + ',' + y1 + ' C' + A.x + ',' + my + ' ' + B.x + ',' + my + ' ' + B.x + ',' + y2;
      } else {
        const fwd = B.l >= A.r,
          x1 = fwd ? A.r : A.l,
          x2 = fwd ? B.l : B.r,
          mx = (x1 + x2) / 2;
        d = 'M' + x1 + ',' + A.y + ' C' + mx + ',' + A.y + ' ' + mx + ',' + B.y + ' ' + x2 + ',' + B.y;
      }
      p.setAttribute('d', d);
      p.setAttribute('class', c);
      lines.append(p);
    };
    pre.forEach((j) => link(j, sel, 'lp'));
    post.forEach((j) => link(sel, j, 'ln'));
    const it = D.items[sel],
      ts = terms(),
      at = (id) => ts.findIndex((t) => t.ids.includes(id)),
      ti = at(sel),
      done = S.done.includes(sel),
      name = (j) => D.items[j].code || S.names[j] || D.items[j].label;
    P2.textContent = '';
    P2.hidden = false;
    document.body.classList.add('haspanel');
    if (it.code) P2.style.setProperty('--c', hue(it.code));
    else P2.style.removeProperty('--c');
    const x = el('button', 'icon x', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close details');
    x.onclick = () => {
      sel = null;
      paint();
    };
    P2.append(x);
    if (it.code) P2.append(el('div', 'code', it.code));
    P2.append(el('h3', null, S.names[sel] || it.label));
    const pills = el('div', 'pills');
    [
      it.cr + ' credits',
      ts[ti].label,
      done ? 'Done' : it.custom ? 'Added by you' : it.code ? 'Required' : 'Your choice',
    ].forEach((t) => pills.append(el('span', null, t)));
    if (!done && v.slack === 0) pills.append(el('span', null, "Can't slip"));
    P2.append(pills);
    const sec = (t) => P2.append(el('h4', null, t));
    if (v.late.length || v.coLate.length) {
      sec('Problem');
      if (v.late.length) P2.append(el('p', 'flag', 'Needs ' + v.late.map(name).join(', ') + ' in an earlier term.'));
      if (v.coLate.length)
        P2.append(el('p', 'flag', 'Take ' + v.coLate.map(name).join(', ') + ' in the same term or earlier.'));
    }
    if (it.code) {
      sec('Catalog prerequisites');
      P2.append(el('p', null, it.pt || 'None listed.'));
      if (it.ct) {
        sec('Corequisites');
        P2.append(el('p', null, it.ct));
      }
    }
    if (it.alt.length || it.ch.length) {
      sec(it.ch.length ? 'Choose one' : 'Can be replaced by');
      P2.append(el('p', null, (it.ch.length ? it.ch : it.alt).join(', ')));
    }
    const rows = (title, ids, cls) => {
      if (!ids.length) return;
      sec(title);
      const ul = el('ul');
      ids.forEach((j) => {
        const li = el('li', cls && cls(j) ? 'late' : '');
        const b = el('button', 'lnk', name(j) + (D.items[j].code ? ' ' + D.items[j].label : ''));
        b.type = 'button';
        b.onclick = () => {
          sel = j;
          paint();
          const c = board.querySelector('[data-id="' + j + '"]');
          if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        li.append(b, el('span', null, S.done.includes(j) ? 'done' : short(ts[at(j)].label)));
        ul.append(li);
      });
      P2.append(ul);
    };
    // A corequisite (gap 0) may sit in the same term, so it is listed apart from what must come first.
    const before = v.needs.filter((x) => x[1] === 1).map((x) => x[0]),
      along = v.needs.filter((x) => x[1] === 0).map((x) => x[0]);
    rows('Needs first, in your plan', before, (j) => v.late.includes(j));
    rows('Take with it, same term or earlier', along, (j) => v.coLate.includes(j));
    rows('Unlocks', post);
    sec('Move');
    const row = el('div', 'row'),
      pick = el('select', 'sel');
    pick.setAttribute('aria-label', 'Move to term');
    ts.forEach((t, k) => {
      const o = new Option(t.label + ' (' + cr(t.ids) + ' cr)', String(k));
      o.selected = k === ti;
      pick.append(o);
    });
    pick.onchange = () => {
      snap();
      put(sel, +pick.value);
      save();
      draw();
    };
    const dn = el('button', 'btn' + (done ? '' : ' pri'), done ? 'Mark not done' : 'Mark done');
    dn.type = 'button';
    dn.onclick = () => {
      snap();
      S.done = done ? S.done.filter((q) => q !== sel) : [...S.done, sel];
      save();
      draw();
    };
    row.append(pick, dn);
    P2.append(row);
    if (it.code) {
      sec('Look it up');
      const L = el('div', 'links');
      [
        ['Catalog description', 'catalog.vt.edu', CAT + it.code.split(' ')[0].toLowerCase() + '/'],
        ['Past grade distributions', 'University data page: pick ' + it.code + ' there', UDC],
        ['Instructor reviews', 'RateMyProfessors: search the instructor', RMP],
      ].forEach(([t, s2, h2]) => {
        const a = el('a');
        a.href = h2;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        const d = el('div', null, t);
        d.append(el('br'), el('small', null, s2));
        a.append(d, el('span', null, '↗'));
        L.append(a);
      });
      P2.append(L);
    }
  }
  addEventListener('resize', () => {
    if (sel) paint();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sel) {
      sel = null;
      paint();
    }
  });
  const say = (b, t) => {
    const o = b.textContent;
    b.textContent = t;
    setTimeout(() => (b.textContent = o), 1600);
  };
  yearsEl.addEventListener('click', (e) => {
    const y = e.target.dataset.y;
    if (y && y !== S.years) {
      snap();
      S.years = y;
      save();
      draw();
      gpTrack('years', y);
    }
  });
  $('undo').onclick = () => {
    if (!U.length) return;
    gpTrack('undo');
    S = clean(JSON.parse(U.pop()));
    $('undo').disabled = !U.length;
    save();
    draw();
  };
  $('balance').onclick = (e) => {
    gpTrack('balance');
    const n = balance();
    say(e.target, n ? 'Moved ' + n + ' elective' + (n > 1 ? 's' : '') : 'Already even: terms are within 3 credits');
  };
  $('copy').onclick = async (e) => {
    const all = terms().flatMap((t) => t.ids),
      total = all.reduce((a, id) => a + D.items[id].cr, 0),
      doneC = all.filter((id) => S.done.includes(id)).reduce((a, id) => a + D.items[id].cr, 0),
      conf = $('conf').textContent.split('.')[0];
    const txt =
      D.name +
      ' plan (' +
      S.years +
      ' years)\\n' +
      total +
      ' credits, ' +
      doneC +
      ' done. ' +
      conf +
      '.\\nOpen it: ' +
      shareUrl() +
      '\\n\\n' +
      terms()
        .map(
          (t) =>
            t.label +
            ' (' +
            cr(t.ids) +
            ' cr to take)\\n' +
            t.ids
              .map(
                (id) =>
                  '  ' +
                  (S.done.includes(id) ? '[x] ' : '[ ] ') +
                  (D.items[id].code ? D.items[id].code + ' ' : '') +
                  (S.names[id] ? S.names[id] + ' [' + D.items[id].label + ']' : D.items[id].label) +
                  ' (' +
                  D.items[id].cr +
                  ')',
              )
              .join('\\n'),
        )
        .join('\\n');
    try {
      await navigator.clipboard.writeText(txt);
      say(e.target, 'Copied');
    } catch {
      say(e.target, 'Copy blocked');
    }
  };
  // The link that holds this whole plan (see the hash reader near the top).
  const shareUrl = () => {
    const p = S.pos[S.years] || {};
    return (
        location.href.split('#')[0] +
        '#y=' +
        S.years +
        '&d=' +
        S.done.map((x) => x.slice(1)).join('.') +
        '&m=' +
        Object.keys(p)
          .map((k) => k.slice(1) + '_' + p[k])
          .join('.') +
        (Object.keys(S.names).length
          ? '&n=' +
            encodeURIComponent(
              Object.keys(S.names)
                .map((k) => k.slice(1) + '~' + S.names[k].replace(/[|]/g, ' '))
                .join('|'),
            )
          : '') +
        (S.extra.length
          ? '&x=' +
            encodeURIComponent(S.extra.map((e) => e.t + '~' + e.cr + '~' + e.label.replace(/[|]/g, ' ')).join('|'))
          : '')
    );
  };
  $('share').onclick = async (e) => {
    const u = shareUrl();
    gpTrack('share');
    try {
      await navigator.clipboard.writeText(u);
      say(e.target, 'Link copied');
    } catch {
      prompt('Copy this link', u);
    }
  };
  $('print').onclick = () => {
    gpTrack('print');
    print();
  };
  $('keep').onclick = () => {
    gpTrack('keep');
    shared = false;
    save();
    history.replaceState(null, '', location.pathname);
    draw();
  };
  $('reset').onclick = () => {
    if (confirm('Clear your moves and checkmarks for this major?')) {
      snap();
      S = clean({ years: S.years });
      save();
      draw();
    }
  };
  // The staggered entrance plays once, on load. Later redraws (every click) must not replay it.
  document.body.classList.add('boot');
  setTimeout(() => document.body.classList.remove('boot'), 1500);
  // A saved or shared plan with added catalog courses needs the catalog to check their prerequisites.
  if (S.extra.some((e) => codeOf(e.label)) || Object.values(S.names).some((n) => codeOf(n)))
    loadCourses().then(() => {
      S = clean(S);
      draw();
    });
  // Opening a share link in a tab that already shows this plan only changes the hash: load it like a fresh visit.
  window.addEventListener('hashchange', () => {
    if (new URLSearchParams(location.hash.slice(1)).has('y')) location.reload();
  });
  draw();
})();
`;

const CATALOG = 'https://catalog.vt.edu/undergraduate/';

export function renderPlan(r: Roadmap, courses: Map<string, CourseInfo>, site?: Site, links?: Links): string {
  // "</" inside JSON would end the script tag early.
  const json = JSON.stringify(planData(r, courses, site, links)).replace(/</g, '\\u003c');
  const ext = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text} ↗</a>`;
  const body = `<div class="app"><aside class="side">
<h1>${esc(r.name)}</h1><p class="sub">${esc(collegeOf(r.catalogPath))} · ${r.total} credits · ${r.draft ? `from the ${ext(`${CATALOG}${esc(r.catalogPath)}`, 'official requirements')}` : ext(`${CATALOG}${esc(r.catalogPath)}#roadmaptext`, 'official roadmap')}</p>
<div class="prog"><span id="prog"></span><b id="pct">0%</b></div><div class="meter"><i id="ringfg" style="width:0"></i></div>
<div class="stats"><div class="stat"><b id="s-cr">0</b><span>credits done</span></div><div class="stat" id="s-conf"><b>0</b><span>conflicts</span></div><div class="stat"><b id="s-load">0</b><span>heaviest term</span></div></div>
<h4>Years to graduate</h4><div class="seg" id="years" role="group" aria-label="Years to graduate">${YEAR_OPTIONS.map((y) => `<button type="button" data-y="${y}" aria-pressed="${y === baseYears(r)}" title="${y} years">${y}</button>`).join('')}</div>
<h4>Prerequisites</h4><p id="conf" role="status"></p>
<details class="tools" id="tools" open><summary>Plan tools: undo, balance, share, print</summary>
<h4>Plan</h4><div class="acts"><button type="button" class="btn" id="undo" disabled title="Undo your last change">Undo</button><button type="button" class="btn" id="balance" title="Move elective slots from the heaviest terms to the lightest">Balance terms</button><button type="button" class="btn" id="share" title="Copy a link that opens this exact plan">Share link</button><button type="button" class="btn" id="print" title="Print this plan or save it as a PDF">Print</button><button type="button" class="btn" id="copy">Copy as text</button><button type="button" class="btn" id="reset">Start over</button></div>
<h4>More</h4><p class="hint"><a href="compare.html#from=${esc(r.slug)}">Switch or double major</a><br><a href="../ask.html">Ask about a course</a></p>
<p class="hint">Click a course for details. Drag it to another term to move it. Tick the box when it's done.</p>
</details>
<div class="over" id="over" hidden></div>
</aside><div class="stage">
${r.draft ? `<p class="note"><b>Suggested order.</b> These are the official requirements, but the catalog gives no term order for this major, so the term-by-term order is a suggestion.</p>` : ''}
<p class="note warn" id="shared" hidden><b>You're viewing a shared plan.</b> Changes you make here are not saved. <button type="button" class="btn" id="keep">Keep as my plan</button></p>
<p class="note warn" id="note" hidden>Rearranged from the ${r.draft ? 'suggested plan' : '4-year roadmap'}. It doesn't know which terms a course is offered.</p>
<p class="note warn" id="fast" hidden>This only works with a lot of AP, IB or transfer credit. Tick what you have.</p>
<p class="note" id="summer" hidden>Under 4 years means summer terms.</p>
<noscript><p class="note warn">The planner needs JavaScript. The official ${r.draft ? 'requirements are' : 'roadmap is'} on catalog.vt.edu.</p></noscript>
<div class="board" id="board"></div>
<details class="help"><summary>How to use this page</summary>
<ul><li><b>Tick</b> a course when it's done. AP, IB and transfer credit count too.</li><li><b>Drag</b> a course to another term, or use the arrows that appear on it. A note appears if the move breaks a prerequisite, and <b>Undo</b> takes it back.</li><li><b>Click</b> a course to see what it needs, what it unlocks, and links to its catalog page, past grades and instructor reviews.</li><li><b>Name it</b> on an elective or Pathways slot records the course you plan to take there.</li><li><b>Add a course</b> at the bottom of a term adds one of your own, such as a minor course.</li><li><b>Balance terms</b> evens out credits by moving elective slots only.</li><li>Your plan is saved in this browser only.</li></ul></details>
</div></div>
<aside class="panel" id="panel" aria-label="Course details" hidden></aside>
<dialog id="addc" aria-labelledby="ac-h"><form id="ac-f" novalidate><h3 id="ac-h">Add a course</h3><p class="mut" id="ac-t"></p>
<label for="ac-q">Course</label><input class="sel" id="ac-q" autocomplete="off" maxlength="60" placeholder="CS 3114, or any name">
<p class="hint">Pick a catalog course and its prerequisites are checked. Or type any name, for a minor course or an elective.</p><div class="chips" id="ac-s"></div>
<label for="ac-c">Credits</label><input class="sel" id="ac-c" type="number" inputmode="numeric" min="0" max="9" step="1" value="3">
<p class="flag" id="ac-m" role="alert" hidden></p>
<div class="row"><button type="button" class="btn" id="ac-x">Cancel</button><button type="submit" class="btn pri">Add to plan</button></div></form></dialog>
<dialog id="namec" aria-labelledby="nc-h"><form id="nc-f" novalidate><h3 id="nc-h">Which course will you take?</h3><p class="mut" id="nc-t"></p>
<label for="nc-q">Course</label><input class="sel" id="nc-q" autocomplete="off" maxlength="60" placeholder="For example PHYS 2305">
<p class="flag" id="nc-m" role="alert" hidden></p>
<div class="row"><button type="button" class="btn" id="nc-x">Cancel</button><button type="submit" class="btn pri">Save</button></div></form></dialog>
<script type="application/json" id="plan-data">${json}</script>`;
  return layout(`${r.name} degree plan · ${brand(site)}`, `Plan a ${r.name} degree term by term from the official ${r.draft ? 'requirements' : 'roadmap'}, with prerequisite checks.`, '../',
    `<a href="index.html">Degree planner</a>`, body, site, 'plan', `<script src="../plan.js" defer></script>`);
}

/** Planner landing page. `home` renders it as the site's front page (planner-only build), so links gain a "plan/" prefix. */
export function renderPlanIndex(roadmaps: Roadmap[], site?: Site, home = false, noRoadmap: Array<{ name: string; catalogPath: string }> = []): string {
  const pre = home ? 'plan/' : '';
  const groups = byCollege(roadmaps);
  const majors = groups.map(([college, rs]) => `<h3 class="col" id="${esc(college.toLowerCase().replace(/[^a-z]+/g, '-'))}">${esc(college)} <span class="mut">${rs.length}</span></h3><div class="majors">${rs.map((r) => `<a href="${pre}${esc(r.slug)}.html"><b>${esc(r.name)}</b><span>${r.total} credits →</span></a>`).join('')}</div>`).join('');
  const drafts = roadmaps.filter((r) => r.draft).length;
  const none = byCollege(noRoadmap).map(([college, xs]) => `<p class="mut"><b>${esc(college)}:</b> ${xs.map((x) => `<a href="${CATALOG}${esc(x.catalogPath)}" target="_blank" rel="noopener noreferrer">${esc(x.name)}</a>`).join(' · ')}</p>`).join('');
  return layout(`${home ? 'Unofficial degree planner' : 'Degree planner'} · ${brand(site)}`, 'Plan your degree from the official roadmap: 2 to 5 years, prerequisite checks, major-switch comparison, shareable link. No login.', home ? '' : '../', '',
    `<div class="intro"><h1>Plan your degree, term by term</h1><p>Pick your major. You get its catalog roadmap laid out by term, and it flags prerequisite problems as you move courses around. No login.</p></div>
<input class="sel filter" id="mf" type="search" placeholder="Find your major: computer science, finance, biology..." aria-label="Filter majors" autocomplete="off"><p class="mut" id="mfnone" hidden>No major matches that. Try part of a name, like "comp" or "bio".</p><p class="mut"><span id="mfn" data-all="${roadmaps.length}">${roadmaps.length} majors and options.</span> Jump to: ${groups.map(([c]) => `<a href="#${esc(c.toLowerCase().replace(/[^a-z]+/g, '-'))}">${esc(c)}</a>`).join(' · ')}</p>${majors}
${none ? `<h2>Not in the planner</h2><p class="mut">These ${noRoadmap.length} catalog programs have no roadmap and could not be turned into a draft. Each link opens its catalog page.</p>${none}` : ''}
<div class="paths"><a href="${pre}compare.html"><b>Thinking of switching?</b><span>Pick two majors and what you've finished. See what carries over and how many credits are left.</span></a>
<a href="${home ? '' : '../'}about.html"><b>How it works</b><span>Where the roadmaps and prerequisites come from, what is checked, and what is not.</span></a></div>`, site, 'plan');
}

/** Shown by nginx for any address that is not a page (deploy/nginx.conf, error_page 404). Links are absolute because the bad address can be at any depth. */
export function renderNotFound(): string {
  return layout(`Page not found · ${brand()}`, 'That page does not exist.', '/', '',
    `<div class="hero"><h1>That page isn't here</h1><p>The link may be old or mistyped. Your saved plans are safe: they live in your browser.</p></div>
<div class="paths"><a href="/index.html"><b>Find your major</b><span>All 213 plans, with a filter box.</span></a><a href="/ask.html"><b>Ask a question</b><span>Prerequisites, what a course unlocks, which majors need it.</span></a></div>`, undefined, 'plan');
}

export function renderPlanAbout(): string {
  return layout(`How it works · ${brand()}`, 'Where the degree planner gets its data and what it checks.', '', '',
    `<h1>How it works</h1><p class="sub">What the planner knows, what it checks, and where it stops.</p>
<h2>Roadmaps</h2><p>Each major's plan is the official 8-semester roadmap from the university's 2026-2027 catalog. The 4-year view is that roadmap unchanged. Every term's credits are checked against the totals the catalog prints.</p>
<h2>Majors without a published roadmap</h2><p>About 85 majors have no term-by-term roadmap in the catalog, only a list of requirements. For those, the courses and credits shown are the official requirements, and the planner suggests an order: courses go by level (1000-level first), a course waits for its prerequisites, and Pathways and elective credits are spread evenly. Where the catalog lists fewer credits than the degree total, the gap is shown as "Pathways, electives and other requirements" slots. Each of these plans says that its order is a suggestion.</p>
<h2>2 to 5 years</h2><p>Other lengths spread the same courses over more or fewer terms. Plans under 4 years use summer terms at half load. A course waits until its prerequisites sit in an earlier term, and corequisites move together. The planner does not know which term a course is offered.</p>
<h2>Prerequisite checks</h2><p>Prerequisites and corequisites are read from each course's catalog description. Move a course ahead of something it needs and a note appears under it. What is checked: every part of a requirement that a course in your plan can meet. If a course needs A and B and only A is in your plan, A is still checked; if it needs A or B and neither is in your plan (a placement test or an honors version may cover it), that part is skipped. Courses you add yourself, or write into an elective slot, are also flagged when they need something that is not in the plan at all. Not checked: a requirement the official roadmap itself does not follow, and a few corequisites the catalog writes in free text.</p>
<h2>"Can't slip"</h2><p>A course gets this tag when later courses chain off it and there is no spare term left: moving it one term later pushes the end of the chain past your last term.</p>
<h2>Switching majors</h2><p>The comparison matches what you've finished against the other major's roadmap: same course first, then elective slots with the same name, then free electives. It is an estimate from the two roadmaps. The department you're moving into decides what really counts.</p>
<h2>Ask</h2><p>The Ask page answers questions like "what do I need before CS 3214?". A search ranking built for this site finds the course or major you mean, and fixed rules assemble the first answer from the catalog facts stored for it, with links to the sources. That part uses no AI. You can also turn on AI answers: a small language model then runs inside your own browser and writes a short answer from the same retrieved facts (retrieval-augmented generation). Turning it on downloads about 2 GB once, straight from the model's public host to your browser; your questions still stay on your device. Either answer can be wrong, so check the catalog link.</p>
<h2>Sharing</h2><p>"Share link" puts the plan in the link itself, so the plan is not uploaded. Opening someone's link never overwrites your own plan unless you choose to keep it.</p>
<h2 id="privacy">Privacy</h2><p>${PRIVACY}</p><p>What is counted: which page was opened, which feature was used (for example "plan length changed to 3 years" or "share link copied"), and the day. To count visitors without knowing who they are, the server turns each request's address into a scrambled code using a secret that is thrown away every day, so the code cannot be turned back into an address or matched from one day to the next. On the Ask page, a question that finds no match is saved as text, with nothing identifying you, so the site can learn to answer it; questions that do get an answer are not saved. Counts are deleted after 180 days. Nothing is sold or shared.</p>
<h2>What this is not</h2><p>It is not a degree audit and it does not know your record. Use the university's own degree audit and your advisor for the official check. For past grades, use ${`<a href="${UDC_URL}" target="_blank" rel="noopener noreferrer">the university's grade distribution page ↗</a>`}.</p>
<h2>Who runs this</h2><p>${DISCLAIMER} The name, the design and the planning logic are ours. Roadmaps, requirements and prerequisites are facts taken from the university's public 2026-2027 catalog, and every plan links back to its catalog page. The site is free and has no ads. See Privacy above for the little it counts.</p>
<h2>Credits and licenses</h2><p>Catalog content (course codes, titles, prerequisites and roadmaps) belongs to the university that publishes the catalog; this site restates it as facts and links each plan to its catalog page. Fonts: Urbanist, Schibsted Grotesk and Martian Mono, under the SIL Open Font License (<a href="fonts/urbanist.LICENSE.txt">1</a>, <a href="fonts/schibsted-grotesk.LICENSE.txt">2</a>, <a href="fonts/martian-mono.LICENSE.txt">3</a>). The optional AI answers run on <a href="vendor/web-llm.LICENSE.txt">WebLLM</a> (Apache-2.0). Built with Llama: the model is Llama 3.2, used under the <a href="https://www.llama.com/llama3_2/license/" target="_blank" rel="noopener noreferrer">Llama 3.2 Community License</a>, Copyright \u00a9 Meta Platforms, Inc.</p>`, undefined, 'about');
}

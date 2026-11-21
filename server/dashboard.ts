// The owner's dashboard: one server-rendered page, no scripts. Everything shown is a count or a short text
// that came from visitors, so every value is escaped before it goes into the page.
import type { Stats } from './db.ts';

const esc = (s: string | number) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Horizontal bar list: label, a bar sized against the largest value, and the numbers. */
function bars(rows: Array<{ label: string; value: number; note?: string }>, empty: string): string {
  if (!rows.length) return `<p class="mut">${esc(empty)}</p>`;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<table>${rows.map((r) => `<tr><th>${esc(r.label)}</th><td class="bar"><i style="width:${Math.round((r.value / max) * 100)}%"></i></td><td class="n">${esc(r.value)}${r.note ? ` <span class="mut">${esc(r.note)}</span>` : ''}</td></tr>`).join('')}</table>`;
}

export function renderDashboard(s: Stats): string {
  const maxDay = Math.max(1, ...s.days.map((d) => d.visitors));
  const chart = s.days.map((d) => `<div class="col" title="${esc(d.day)}: ${d.visitors} visitors, ${d.views} page views"><i style="height:${Math.round((d.visitors / maxDay) * 100)}%"></i><span>${esc(d.day.slice(8))}</span></div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Gobbler Plan dashboard</title>
<style>:root{--paper:#f5f2ea;--sheet:#fffdf8;--ink:#1c2230;--mut:#687083;--rule:#dcd6c8;--acc:#b4470f;--bar:#417784}
@media(prefers-color-scheme:dark){:root{--paper:#13151a;--sheet:#1a1d24;--ink:#e9e6df;--mut:#9aa1b0;--rule:#30343e;--acc:#f0935c;--bar:#5aa3b3}}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:1000px;margin:0 auto;padding:24px 16px 60px}
h1{font:700 2rem/1.1 Georgia,serif;margin:0}h2{font-size:1.1rem;margin:2em 0 .4em;padding-top:.6em;border-top:2px solid var(--ink)}.mut{color:var(--mut);font-size:.88rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:18px 0}.tile{background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:12px 14px}.tile b{display:block;font:700 1.8rem/1.1 Georgia,serif}
.chart{display:flex;align-items:flex-end;gap:3px;height:140px;border-bottom:1px solid var(--ink)}.col{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-size:.62rem;color:var(--mut)}.col i{display:block;width:100%;min-height:1px;background:var(--bar);border-radius:3px 3px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0 32px}table{width:100%;border-collapse:collapse;font-size:.92rem}th{text-align:left;font-weight:500;padding:5px 8px 5px 0;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}td{padding:5px 0}.bar{width:38%}.bar i{display:block;height:10px;background:var(--bar);border-radius:5px;min-width:2px}.n{text-align:right;white-space:nowrap;padding-left:8px}
ul{list-style:none;padding:0;margin:0;font-size:.92rem}li{border-top:1px solid var(--rule);padding:6px 0}</style></head><body><main>
<h1>Gobbler Plan dashboard</h1><p class="mut">${esc(s.since)} to ${esc(s.until)} (UTC). Anonymous counts only: no names, addresses or cookies are stored.</p>
<div class="tiles"><div class="tile"><b>${s.totals.visitorDays}</b>visitor-days</div><div class="tile"><b>${s.totals.views}</b>page views</div><div class="tile"><b>${s.totals.events - s.totals.views}</b>feature uses</div><div class="tile"><b>${s.askMisses.length}</b>unanswered questions</div></div>
<p class="mut">A visitor-day is one browser on one day. The same person on three days counts three times, because visitors cannot be followed from one day to the next.</p>
<h2>Visitors per day</h2><div class="chart">${chart}</div>
<div class="grid">
<section><h2>Most viewed pages</h2>${bars(s.pages.map((p) => ({ label: p.name, value: p.views, note: `${p.visitors} visitors` })), 'No page views yet.')}</section>
<section><h2>Features used</h2>${bars(s.features.map((f) => ({ label: f.name, value: f.uses, note: `${f.visitors} visitors` })), 'No feature use yet.')}</section>
<section><h2>Plan lengths chosen</h2>${bars(s.planLengths.map((f) => ({ label: `${f.name} years`, value: f.uses })), 'Nobody has changed a plan length yet.')}</section>
<section><h2>Ask: kinds of answer</h2>${bars(s.askIntents.map((f) => ({ label: f.name || 'general', value: f.uses })), 'No questions yet.')}</section>
</div>
<h2>Ask: questions with no answer</h2><p class="mut">The most recent 50. These show what to teach the Ask rules next.</p>
${s.askMisses.length ? `<ul>${s.askMisses.map((m) => `<li><span class="mut">${esc(m.day)}</span> ${esc(m.question)}</li>`).join('')}</ul>` : '<p class="mut">None.</p>'}
</main></body></html>`;
}

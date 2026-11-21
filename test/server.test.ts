import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createApp, EVENTS_PER_MINUTE, LOGIN_TRIES_PER_MINUTE, rateLimiter, validateEvent, visitorCode } from '../server/app.ts';
import { openDb, prune, saltFor, stats, insertEvent, RETENTION_DAYS } from '../server/db.ts';
import { renderDashboard } from '../server/dashboard.ts';

// A throwaway password for the in-memory test server only.
const PASSWORD = randomBytes(12).toString('hex');
const auth = (p: string) => ({ Authorization: 'Basic ' + Buffer.from('owner:' + p).toString('base64') });

async function withServer(opts: { password?: string; clock?: { t: number } }, run: (url: string, db: ReturnType<typeof openDb>) => Promise<void>) {
  const db = openDb(':memory:');
  const clock = opts.clock ?? { t: Date.parse('2026-11-21T12:00:00Z') };
  const handle = createApp({ db, adminPassword: opts.password, now: () => new Date(clock.t) });
  const server: Server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  try { await run(`http://127.0.0.1:${port}`, db); } finally { await new Promise((r) => server.close(r)); db.close(); }
}
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url + '/api/event', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'User-Agent': 'test-browser', ...headers } });

test('validateEvent: only known types, safe page names, short cleaned values', () => {
  assert.deepEqual(validateEvent({ t: 'view', p: 'computer-science' }), { type: 'view', page: 'computer-science', value: '' });
  assert.equal(validateEvent({ t: 'ask-miss', p: 'ask', v: '  easy\nmath\u0000 class  ' })!.value, 'easy math class');
  assert.equal(validateEvent({ t: 'ask-miss', p: 'ask', v: 'x'.repeat(500) })!.value.length, 120);
  for (const bad of [null, 'x', [], { t: 'drop table', p: 'a' }, { t: 'view', p: '../etc' }, { t: 'view', p: '' }, { t: 'view', p: 'a', v: 5 }, { t: 'view' }])
    assert.equal(validateEvent(bad), undefined, JSON.stringify(bad));
});

test('visitorCode: same visitor same day matches; a new day or secret does not; the address is not in it', () => {
  const a = visitorCode('salt-1', '203.0.113.9', 'Firefox');
  assert.equal(a, visitorCode('salt-1', '203.0.113.9', 'Firefox'));
  assert.notEqual(a, visitorCode('salt-2', '203.0.113.9', 'Firefox'));
  assert.notEqual(a, visitorCode('salt-1', '203.0.113.10', 'Firefox'));
  assert.ok(!a.includes('203') && a.length === 16);
});

test('saltFor: stable within a day, replaced the next day, old one deleted', () => {
  const db = openDb(':memory:');
  const s1 = saltFor(db, '2026-11-21');
  assert.equal(saltFor(db, '2026-11-21'), s1);
  const s2 = saltFor(db, '2026-11-22');
  assert.notEqual(s2, s1);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM salts').get() as { n: number }).n, 1);
  db.close();
});

test('rateLimiter: allows up to the limit per key per minute, then resets', () => {
  let t = 0;
  const ok = rateLimiter(3, () => t);
  assert.deepEqual([ok('a'), ok('a'), ok('a'), ok('a'), ok('b')], [true, true, true, false, true]);
  t = 60000;
  assert.equal(ok('a'), true);
});

test('POST /api/event: stores valid events, refuses everything else', async () => {
  await withServer({}, async (url, db) => {
    assert.equal((await post(url, { t: 'view', p: 'computer-science' })).status, 204);
    assert.equal((await post(url, { t: 'years', p: 'computer-science', v: '3.5' })).status, 204);
    assert.equal((await post(url, 'not json')).status, 400);
    assert.equal((await post(url, { t: 'nope', p: 'x' })).status, 400);
    assert.equal((await post(url, 'x'.repeat(5000))).status, 413);
    assert.equal((await fetch(url + '/api/event')).status, 405);
    assert.equal((await fetch(url + '/api/healthz')).status, 200);
    assert.equal((await fetch(url + '/nothing')).status, 404);
    const rows = db.prepare('SELECT day, type, page, value, visitor FROM events ORDER BY rowid').all() as Array<Record<string, string>>;
    assert.equal(rows.length, 2);
    assert.deepEqual([rows[0]!.day, rows[0]!.type, rows[0]!.page], ['2026-11-21', 'view', 'computer-science']);
    assert.equal(rows[0]!.visitor, rows[1]!.visitor);
    assert.ok(!JSON.stringify(rows).includes('127.0.0.1') && !JSON.stringify(rows).includes('test-browser'));
  });
});

test('POST /api/event: one visitor is cut off after the per-minute limit; another visitor is not', async () => {
  await withServer({}, async (url) => {
    const codes: number[] = [];
    for (let i = 0; i < EVENTS_PER_MINUTE + 2; i++) codes.push((await post(url, { t: 'view', p: 'index' })).status);
    assert.equal(codes.filter((c) => c === 204).length, EVENTS_PER_MINUTE);
    assert.equal(codes.at(-1), 429);
    assert.equal((await post(url, { t: 'view', p: 'index' }, { 'User-Agent': 'another-browser' })).status, 204);
  });
});

test('dashboard: off without a password, 401 without the right one, numbers with it', async () => {
  await withServer({}, async (url) => assert.equal((await fetch(url + '/admin')).status, 503));
  await withServer({ password: PASSWORD }, async (url) => {
    const none = await fetch(url + '/admin');
    assert.equal(none.status, 401);
    assert.ok(none.headers.get('www-authenticate')!.startsWith('Basic'));
    assert.equal((await fetch(url + '/admin', { headers: auth('wrong') })).status, 401);
    assert.equal((await fetch(url + '/admin', { headers: auth(PASSWORD.slice(0, -1)) })).status, 401);
    await post(url, { t: 'view', p: 'computer-science' });
    await post(url, { t: 'view', p: 'computer-science' }, { 'User-Agent': 'second-browser' });
    await post(url, { t: 'ask-miss', p: 'ask', v: '<script>alert(1)</script> easy class' });
    const page = await fetch(url + '/admin', { headers: auth(PASSWORD) });
    assert.equal(page.status, 200);
    assert.ok(page.headers.get('content-security-policy')!.includes("default-src 'none'"));
    const html = await page.text();
    assert.ok(html.includes('computer-science'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; easy class') && !html.includes('<script'));
    const data = await (await fetch(url + '/admin/data.json', { headers: auth(PASSWORD) })).json() as ReturnType<typeof stats>;
    assert.equal(data.totals.visitorDays, 2);
    assert.equal(data.totals.views, 2);
    assert.deepEqual(data.pages[0], { name: 'computer-science', views: 2, visitors: 2 });
    assert.equal(data.days.length, 30);
    assert.equal(data.askMisses.length, 1);
  });
});

test('dashboard: password guessing is cut off', async () => {
  await withServer({ password: PASSWORD }, async (url) => {
    const codes: number[] = [];
    for (let i = 0; i < LOGIN_TRIES_PER_MINUTE + 1; i++) codes.push((await fetch(url + '/admin', { headers: auth('guess' + i) })).status);
    assert.equal(codes.at(-1), 429);
    assert.equal((await fetch(url + '/admin', { headers: auth(PASSWORD) })).status, 429);
  });
});

test('stats and prune: a returning visitor counts once per day; old events are deleted', () => {
  const db = openDb(':memory:');
  const add = (day: string, visitor: string, type = 'view', page = 'index', value = '') => insertEvent(db, { day, type, page, value, visitor });
  add('2026-11-20', 'aaa'); add('2026-11-20', 'aaa'); add('2026-11-20', 'bbb'); add('2026-11-21', 'ccc'); add('2026-11-21', 'ccc', 'years', 'computer-science', '3');
  add('2026-01-01', 'old');
  const s = stats(db, '2026-11-21');
  assert.equal(s.totals.visitorDays, 3);
  assert.equal(s.totals.views, 4);
  assert.deepEqual(s.planLengths, [{ name: '3', uses: 1, visitors: 0 }]);
  assert.equal(s.days.at(-1)!.day, '2026-11-21');
  assert.ok(RETENTION_DAYS < 325);
  assert.equal(prune(db, '2026-11-21'), 1);
  assert.ok(renderDashboard(s).includes('visitor-days'));
  db.close();
});

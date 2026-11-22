// The API: three jobs. Take anonymous usage events from the site, serve the owner's dashboard behind a
// password, and answer a health check. Plain node:http, no framework, so every step is visible.
//
//   POST /api/event        record one event (validated, rate limited, never identifies anyone)
//   GET  /api/healthz      "ok" for the container health check
//   GET  /admin            the dashboard page            (password)
//   GET  /admin/data.json  the same numbers as JSON      (password)
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { insertEvent, saltFor, stats, type Db } from './db.ts';
import { renderDashboard } from './dashboard.ts';

/** Event types the site may send. Anything else is refused, so the table cannot fill with junk. */
export const EVENT_TYPES = ['view', 'years', 'share', 'print', 'balance', 'undo', 'keep', 'compare', 'double', 'ask', 'ask-miss', 'ai'] as const;
export const MAX_BODY_BYTES = 1024;
export const MAX_VALUE_CHARS = 120;
/** Per visitor, per minute. A real session sends a handful. */
export const EVENTS_PER_MINUTE = 60;
export const LOGIN_TRIES_PER_MINUTE = 10;

export interface AppOptions {
  db: Db;
  /** Dashboard password. Empty or missing turns the dashboard off entirely. */
  adminPassword?: string;
  now?: () => Date;
}

const sha = (s: string) => createHash('sha256').update(s).digest();

/**
 * Who sent this, as a code that is useless for anything but counting: a hash of today's secret, the
 * address and the browser string. The address itself is never stored, and the secret is deleted when the
 * day changes, so yesterday's codes cannot be matched to today's.
 */
export function visitorCode(salt: string, ip: string, userAgent: string): string {
  return sha(`${salt}|${ip}|${userAgent}`).toString('hex').slice(0, 16);
}

/** Fixed window counter: at most `max` hits per key per minute. Old keys are dropped as the minute rolls over. */
export function rateLimiter(max: number, now: () => number) {
  let minute = -1;
  let counts = new Map<string, number>();
  return (key: string): boolean => {
    const m = Math.floor(now() / 60000);
    if (m !== minute) { minute = m; counts = new Map(); }
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    return n <= max;
  };
}

export function validateEvent(body: unknown): { type: string; page: string; value: string } | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const { t, p, v } = body as Record<string, unknown>;
  if (typeof t !== 'string' || !(EVENT_TYPES as readonly string[]).includes(t)) return undefined;
  if (typeof p !== 'string' || !/^[a-z0-9-]{1,80}$/.test(p)) return undefined;
  if (v !== undefined && typeof v !== 'string') return undefined;
  // Control characters out, whitespace collapsed, length capped: the value is shown on the dashboard.
  const value = (v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_VALUE_CHARS);
  return { type: t, page: p, value };
}

function readBody(req: IncomingMessage, limit: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    // Past the limit: stop keeping data and answer 413. The connection is closed once that answer is out (see below).
    req.on('data', (c: Buffer) => { size += c.length; if (size > limit) resolve(undefined); else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(undefined));
  });
}

export function createApp(opts: AppOptions) {
  const now = opts.now ?? (() => new Date());
  const eventLimit = rateLimiter(EVENTS_PER_MINUTE, () => now().getTime());
  const loginLimit = rateLimiter(LOGIN_TRIES_PER_MINUTE, () => now().getTime());
  const send = (res: ServerResponse, status: number, body = '', headers: Record<string, string> = {}) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(body);
  };
  // Behind nginx the caller's address arrives in X-Real-IP. The API port is not published, so only nginx can set it.
  const ipOf = (req: IncomingMessage) => String(req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? '');

  /** Compare hashes in constant time, so response timing does not leak how much of a guess was right. */
  const passwordOk = (req: IncomingMessage): boolean => {
    const m = /^Basic (.+)$/.exec(req.headers.authorization ?? '');
    if (!m || !opts.adminPassword) return false;
    const given = Buffer.from(m[1]!, 'base64').toString('utf8');
    return timingSafeEqual(sha(given.slice(given.indexOf(':') + 1)), sha(opts.adminPassword));
  };

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = (req.url ?? '/').split('?')[0]!;
    const day = now().toISOString().slice(0, 10);

    if (path === '/api/healthz' && req.method === 'GET') return send(res, 200, 'ok\n');

    if (path === '/api/event') {
      if (req.method !== 'POST') return send(res, 405, 'POST only\n', { Allow: 'POST' });
      const raw = await readBody(req, MAX_BODY_BYTES);
      if (raw === undefined) { res.on('finish', () => req.destroy()); return send(res, 413, 'Too large\n', { Connection: 'close' }); }
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { return send(res, 400, 'Not JSON\n'); }
      const event = validateEvent(parsed);
      if (!event) return send(res, 400, 'Not a known event\n');
      const visitor = visitorCode(saltFor(opts.db, day), ipOf(req), String(req.headers['user-agent'] ?? ''));
      if (!eventLimit(visitor)) return send(res, 429, 'Slow down\n');
      insertEvent(opts.db, { day, ...event, visitor });
      return send(res, 204);
    }

    if (path === '/admin' || path === '/admin/' || path === '/admin/data.json') {
      if (req.method !== 'GET') return send(res, 405, 'GET only\n', { Allow: 'GET' });
      if (!opts.adminPassword) return send(res, 503, 'The dashboard is off. Set ADMIN_PASSWORD to turn it on.\n');
      if (!loginLimit(ipOf(req))) return send(res, 429, 'Too many tries. Wait a minute.\n');
      if (!passwordOk(req)) return send(res, 401, 'Password needed\n', { 'WWW-Authenticate': 'Basic realm="Gobbler Plan dashboard", charset="UTF-8"' });
      const s = stats(opts.db, day);
      if (path.endsWith('.json')) return send(res, 200, JSON.stringify(s), { 'Content-Type': 'application/json; charset=utf-8' });
      // The page has no scripts at all; styles are inline. Nothing may be loaded from anywhere else.
      return send(res, 200, renderDashboard(s), { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'", 'X-Robots-Tag': 'noindex' });
    }

    return send(res, 404, 'Not found\n');
  };
}

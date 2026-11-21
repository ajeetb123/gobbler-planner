// Storage for anonymous usage events: one SQLite file, opened with Node's built-in driver (no packages).
// What is stored per event: the day, an event type, a page name, a short value, and a visitor code that
// cannot be turned back into a person and cannot be linked across days (see visitorCode in app.ts).
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

export type Db = DatabaseSync;

export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (day TEXT NOT NULL, type TEXT NOT NULL, page TEXT NOT NULL, value TEXT NOT NULL, visitor TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS events_day ON events (day, type);
    CREATE TABLE IF NOT EXISTS salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL);
  `);
  return db;
}

/**
 * The secret mixed into visitor codes for one day. Kept in the database so a restart does not split a day's
 * count, and every other day's secret is deleted, so older visitor codes can never be recomputed or matched.
 */
export function saltFor(db: Db, day: string): string {
  const row = db.prepare('SELECT salt FROM salts WHERE day = ?').get(day) as { salt: string } | undefined;
  if (row) return row.salt;
  const salt = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM salts').run();
  db.prepare('INSERT INTO salts (day, salt) VALUES (?, ?)').run(day, salt);
  return salt;
}

export function insertEvent(db: Db, e: { day: string; type: string; page: string; value: string; visitor: string }): void {
  db.prepare('INSERT INTO events (day, type, page, value, visitor) VALUES (?, ?, ?, ?, ?)').run(e.day, e.type, e.page, e.value, e.visitor);
}

/** Events are kept this many days, then deleted. */
export const RETENTION_DAYS = 180;
export function prune(db: Db, today: string): number {
  const cutoff = new Date(Date.parse(today) - RETENTION_DAYS * 86400000).toISOString().slice(0, 10);
  return Number(db.prepare('DELETE FROM events WHERE day < ?').run(cutoff).changes);
}

export interface Stats {
  since: string;
  until: string;
  totals: { visitorDays: number; views: number; events: number };
  /** One row per day in the window, including days with nothing. */
  days: Array<{ day: string; visitors: number; views: number }>;
  pages: Array<{ name: string; views: number; visitors: number }>;
  features: Array<{ name: string; uses: number; visitors: number }>;
  planLengths: Array<{ name: string; uses: number }>;
  askIntents: Array<{ name: string; uses: number }>;
  askMisses: Array<{ day: string; question: string }>;
}

type Row = Record<string, string | number>;

export function stats(db: Db, today: string, windowDays = 30): Stats {
  const since = new Date(Date.parse(today) - (windowDays - 1) * 86400000).toISOString().slice(0, 10);
  const all = (sql: string, ...args: string[]) => db.prepare(sql).all(...args) as Row[];
  const byDay = new Map(all(`SELECT day, COUNT(DISTINCT visitor) AS visitors, SUM(type = 'view') AS views FROM events WHERE day >= ? GROUP BY day`, since).map((r) => [String(r.day), r]));
  const days = Array.from({ length: windowDays }, (_, k) => {
    const day = new Date(Date.parse(since) + k * 86400000).toISOString().slice(0, 10);
    return { day, visitors: Number(byDay.get(day)?.visitors ?? 0), views: Number(byDay.get(day)?.views ?? 0) };
  });
  const named = (rows: Row[]) => rows.map((r) => ({ name: String(r.name), uses: Number(r.uses), visitors: Number(r.visitors ?? 0) }));
  return {
    since, until: today,
    totals: {
      // A person visiting on three days counts three times: codes cannot be linked across days, by design.
      visitorDays: days.reduce((a, d) => a + d.visitors, 0),
      views: days.reduce((a, d) => a + d.views, 0),
      events: Number((all('SELECT COUNT(*) AS n FROM events WHERE day >= ?', since)[0] ?? { n: 0 }).n),
    },
    days,
    pages: all(`SELECT page AS name, COUNT(*) AS uses, COUNT(DISTINCT day || visitor) AS visitors FROM events WHERE day >= ? AND type = 'view' GROUP BY page ORDER BY uses DESC, page LIMIT 25`, since)
      .map((r) => ({ name: String(r.name), views: Number(r.uses), visitors: Number(r.visitors) })),
    features: named(all(`SELECT type AS name, COUNT(*) AS uses, COUNT(DISTINCT day || visitor) AS visitors FROM events WHERE day >= ? AND type NOT IN ('view', 'ask-miss') GROUP BY type ORDER BY uses DESC, type`, since)),
    planLengths: named(all(`SELECT value AS name, COUNT(*) AS uses FROM events WHERE day >= ? AND type = 'years' GROUP BY value ORDER BY uses DESC, value`, since)),
    askIntents: named(all(`SELECT value AS name, COUNT(*) AS uses FROM events WHERE day >= ? AND type = 'ask' GROUP BY value ORDER BY uses DESC, value`, since)),
    askMisses: all(`SELECT day, value FROM events WHERE day >= ? AND type = 'ask-miss' ORDER BY rowid DESC LIMIT 50`, since).map((r) => ({ day: String(r.day), question: String(r.value) })),
  };
}

// Starts the API. Settings come from the environment so nothing secret lives in the code or the image:
//   PORT            port to listen on (default 3000)
//   DB_PATH         SQLite file (default /data/gobbler.db; mount a volume there to keep it)
//   ADMIN_PASSWORD  dashboard password; leave unset to turn the dashboard off
import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { openDb, prune } from './db.ts';

const db = openDb(process.env.DB_PATH ?? '/data/gobbler.db');
const today = () => new Date().toISOString().slice(0, 10);
prune(db, today());
setInterval(() => prune(db, today()), 24 * 3600 * 1000).unref();

const handle = createApp({ db, adminPassword: process.env.ADMIN_PASSWORD });
const server = createServer((req, res) => {
  handle(req, res).catch((err) => { console.error(err); if (!res.headersSent) res.writeHead(500); res.end(); });
});
const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`api listening on ${port}; dashboard ${process.env.ADMIN_PASSWORD ? 'on' : 'off (no ADMIN_PASSWORD)'}`));
// Finish in-flight requests and close the database when the container is told to stop.
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));

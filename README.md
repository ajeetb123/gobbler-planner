# Gobbler Plan

An unofficial degree planner built from one university's public catalog. Pick a major, get its full term-by-term plan, rearrange it, and see prerequisite problems as you go. Free, no login.

**Live site:** https://gobbler-plan.fly.dev

Not affiliated with, endorsed by, or sponsored by any university. A planning aid, not a degree audit.

## What it does

- **213 majors and options, already laid out.** 128 come from official catalog roadmaps; 85 are built from requirement lists and shown as a suggested order.
- **2 to 5 year plans.** The 4-year roadmap is rearranged to fit other lengths while keeping prerequisites in order.
- **Prerequisite and corequisite checks** on every move, including courses you add yourself, with a "can't slip" tag on courses that would delay graduation.
- **Switch majors or add a second one:** what carries over, what is left, and which majors cost the fewest extra credits.
- **Share links** that hold the whole plan in the address, so nothing is uploaded.
- **Ask (beta):** questions like "what do I need before CS 3214?" or "I have CS 2114 and CS 2505, can I take CS 3114?", answered from catalog facts with sources.
- **A private dashboard** with anonymous usage counts. No accounts, no stored addresses.

## How it is built

| Part | What it is |
|---|---|
| Prerequisite parser | Recursive descent over the catalog's "A and (B or C)" text (`src/plan/prereq.ts`) |
| Scheduler | Greedy packing, local repair, then branch and bound with a load-balance lower bound (`src/plan/roadmap.ts`, `src/plan/optimize.ts`) |
| Draft plans | Topological ordering by course level for majors with no published roadmap (`src/plan/draft.ts`) |
| Major comparison | Slot matching by course, elective name and general-education category (`src/plan/switch.ts`) |
| Ask | Tokenizer, inverted index and BM25 ranking written from scratch, with rule-based answers (`src/ask/engine.ts`) |
| Site | A static generator in TypeScript, no framework. Tested functions are shipped to the browser as they are, so the code under test is the code that runs (`src/site/`, `scripts/build-site.ts`) |
| API | `node:http` and the built-in `node:sqlite`, no packages (`server/`) |

TypeScript runs directly on Node (type stripping), so there is no compile step.

## Measured, not assumed

- **84 tests** (`npm run check`), including every official roadmap at every plan length.
- **Ask retrieval:** 27 of 40 on a hand-written question set (`npm run eval:ask`). That is why the page is labeled beta.
- **Language model, lookups:** an optional in-browser model (WebLLM, Llama 3.2 3B) rewords single-fact answers. It scored 14 of 15 on first measurement, and 15 of 15 after one fact was reworded on that same set, so read the second number as optimistic (`npm run eval:rag`, needs a local Ollama).
- **Language model, yes/no reasoning:** on "I have these courses, can I take X?" the model alone got 8 of 16. That path was replaced with an exact check of the prerequisite tree, which is 16 of 16 by construction, and the model is never asked those questions.

## Run it

```bash
npm ci
npm run check    # typecheck + tests
npm run build    # static site into dist/
```

With Docker, site and API together at http://localhost:8080:

```bash
docker compose up --build
```

Set `ADMIN_PASSWORD` in a `.env` file to turn the dashboard on at `/admin`.

## Deployment

Two containers: nginx serving the static site (multi-stage build, non-root) and the API with a volume for its SQLite file. The API has no public address; only the web container reaches it.

- **CI** (GitHub Actions): tests, image build, a smoke test of the running container, and an integration test of both containers together. Pushes to `main` publish the images to GitHub Container Registry.
- **Hosting** (Fly.io): `fly.toml` for the site and `fly.api.toml` for the API, connected over Fly's private network.

## Data

Course codes, titles, prerequisites and roadmaps are facts restated from the university's public 2026-2027 catalog; see [data/SOURCE.md](data/SOURCE.md) for how they were collected and what was corrected by hand. The catalog is the authority. Confirm any plan with an advisor.

The repository also contains a grade-estimate engine (`src/grades/`, [REPORT.md](REPORT.md)). It needs grade data that is not in this repository and is not part of the public site.

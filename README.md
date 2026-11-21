# Gobbler Plan

An unofficial degree planner for Virginia Tech students. Not affiliated with, endorsed by, or sponsored by Virginia Tech.

Virginia Tech course and instructor grade pages: expected section GPA with calibrated 80% ranges, name-collision warnings, and a verdict on whether instructor choice matters. Static site, no runtime dependencies.

```bash
npm install
npm run check      # typecheck + tests
npm run backtest   # walk-forward accuracy backtest
npm run build      # public site into dist/: degree planner only, no grade data
npm run build:grades  # private build that adds the grade pages
```

Results, method and open risks: [REPORT.md](REPORT.md). Working notes for contributors: [skills.md](skills.md).

Not affiliated with Virginia Tech.

## What it does

- Term-by-term plans for 213 majors and options (128 official roadmaps, 85 drafts built from requirement lists), 3 to 5 years
- Prerequisite checking with a branch-and-bound scheduler for rearranged plans
- Switch-major and double-major comparison
- Ask: retrieval over catalog facts (BM25, typo handling), no AI model
- A small API with anonymous usage counts and a password-protected dashboard

## Run in Docker

```bash
docker compose up --build   # site and API together at http://localhost:8080
```

The image is built in two stages (Node builds the static pages, nginx serves them as a non-root user) and has a `/healthz` endpoint. Every push runs the tests, builds the image and smoke-tests the running container in GitHub Actions; pushes to `main` publish it to GitHub Container Registry.

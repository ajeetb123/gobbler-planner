# Gobbler Plan

An unofficial degree planner built from one university's public catalog. An independent student project, not affiliated with, endorsed by, or sponsored by any university.

A private build can also add course and instructor grade pages: expected section GPA with calibrated 80% ranges, name-collision warnings, and a verdict on whether instructor choice matters. Static site, no runtime dependencies.

```bash
npm install
npm run check      # typecheck + tests
npm run backtest   # walk-forward accuracy backtest
npm run build      # public site into dist/: degree planner only, no grade data
npm run build:grades  # private build that adds the grade pages
```

Results, method and open risks: [REPORT.md](REPORT.md). Working notes for contributors: [skills.md](skills.md).


## What it does

- Term-by-term plans for 213 majors and options (128 official roadmaps, 85 drafts built from requirement lists), 3 to 5 years
- Prerequisite checking with a branch-and-bound scheduler for rearranged plans
- Switch-major and double-major comparison
- Ask: a hand-built BM25 retriever with rule-based answers, plus optional retrieval-augmented generation with a language model that runs in the visitor's browser (WebLLM, WebGPU)
- A small API with anonymous usage counts and a password-protected dashboard

## Run in Docker

```bash
docker compose up --build   # site and API together at http://localhost:8080
```

The image is built in two stages (Node builds the static pages, nginx serves them as a non-root user) and has a `/healthz` endpoint. Every push runs the tests, builds the image and smoke-tests the running container in GitHub Actions; pushes to `main` publish it to GitHub Container Registry.

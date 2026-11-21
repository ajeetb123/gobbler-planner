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

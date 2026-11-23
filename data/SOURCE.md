# Data provenance

## Catalog data (used by the public planner)
`roadmaps/`, `requirements/`, `prereqs.txt` and `no-roadmap.txt` are facts read from the public 2026-2027 Virginia Tech Academic Catalog on Nov 14 and Nov 21, 2026 (the method is in `scripts/catalog/`). Permission to reuse catalog content was given to me verbally; written confirmation is still pending.

## Grade data (not in this repository)
The grade engine in `src/grades/` was backtested on two University DataCommons (UDC) grade distribution exports that other people had republished in public GitHub repos (github.com/jrudman25/CourseSearch and github.com/gsoni1/GradeDistVis). Nothing was scraped from UDC.

On Nov 20, 2026 UDC told me that course planning is not an authorized purpose for this data and that it would not provide a file or authorize scraping. The two CSV files were removed from the repository on Nov 21, 2026 and `data/*.csv` is git-ignored.
- `npm run build` (the public planner) never used them.
- `npm run build:grades`, `npm run backtest` and the other `bench/` scripts need `data/udc_2019_2022.csv` and `data/udc_2022_2024.csv` and stop without them. Only run them on a private machine, and never publish their output.
- Git history was rewritten on Nov 21, 2026 so that no commit contains the files.

Columns: Academic Year, Term, Subject, Course No., Course Title, Instructor (last name only), GPA,
A (%) ... F (%), Withdraws, Graded Enrollment, CRN, Credits.

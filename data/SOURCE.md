# Data provenance

## Catalog data (used by the public planner)
`roadmaps/`, `requirements/`, `prereqs.txt` and `no-roadmap.txt` are facts read from the public 2026-2027 Virginia Tech Academic Catalog on Nov 14 and Nov 21, 2026 (see `skills.md` for the method). Permission to reuse catalog content was given to the owner verbally; written confirmation is still pending.

## Grade data (PRIVATE, not used by the public planner)
`udc_2019_2022.csv` and `udc_2022_2024.csv` are University DataCommons (UDC) grade distribution exports that other people had republished in public GitHub repos (github.com/jrudman25/CourseSearch and github.com/gsoni1/GradeDistVis). Nothing here was scraped from UDC.

On Nov 20, 2026 UDC told the owner that course planning is not an authorized purpose for this data and that it would not provide a file or authorize scraping. So:
- These files are for offline backtests of the grade engine only.
- `npm run build` never reads them. Only `npm run build:grades` does, and its output must not be published.
- Do not make this repository public while these files are in it or in its git history.

Columns: Academic Year, Term, Subject, Course No., Course Title, Instructor (last name only), GPA,
A (%) ... F (%), Withdraws, Graded Enrollment, CRN, Credits.

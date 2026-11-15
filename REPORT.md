# VT course and professor pages: build, backtest, verdict

**Verdict:** the engine is sound and it measurably beats what every VT grade site shows today. That alone will not pull students off RateMyProfessors. The data says this works as a second tab students open next to RMP, not as a replacement for it. One unverified blocker could cap it further: whether the public timetable still shows instructor names.

## What was built (TypeScript, no runtime dependencies, 32 unit tests)

**#5 Honest grade estimates.** Predicts next-term section GPA for a (course, instructor) pair:
- Small samples are pulled toward the course mean (shrinkage).
- Recent terms count more (decay).
- An instructor's record in other courses helps only when the name is unambiguous.
- Every number has a calibrated 80% range.

**#3 Instructor identity.** Flags last-name keys that probably merge several people and stops pooling them across courses.

**Static site (added Nov 14, 2026).** `npm run build` turns the CSVs in `data/` into a full site in `dist/`:
- Design: original, not modelled on another site. Left rail with search and navigation (bottom tabs on phones), serif headlines, ruled sections.
- Course pages: a one-line verdict headline, four key numbers (course GPA, share with a B or higher, withdraw rate, section size), a grade mix strip, then the lane chart: every instructor on one shared GPA axis with the expected section GPA, its 80% range, the course average and a history-depth marker. Tapping a row opens the detail; tapping the compare button on two rows gives a sentence such as "would average higher about 8 times in 10".
- Instructor pages: the same key numbers and lane chart, one row per course, with term history in each row's detail. Flagged names get a warning and no cross-course total.
- Search palette: opens with "/" or Cmd/Ctrl+K from any page, groups results into courses, instructors and degree plans, and works with arrow keys.
- Subject lists and a method page.
- Degree planner (`plan/`): pick a major, start from its official roadmap in the 2026-2027 VT catalog, choose 3, 3.5, 4, 4.5 or 5 years, move courses between terms, tick off finished ones, rebalance heavy terms with one button, and copy the plan as text. A bar overview shows credits per term. Each course shows its average GPA and an "Instructor matters" tag, and each term shows credits, a typical GPA, and flags for a heavy load or several low-GPA courses together. 15 College of Engineering majors so far. The plan is saved in the visitor's browser.
- Planner limit: plans other than 4 years are a rearrangement of the official roadmap. Prerequisites and term offerings are not checked, and the page says so.
- Every instructor links out to a RateMyProfessors search for that last name at VT, so reviews are one click away. Reviews are never copied.
- `npm run pilot` builds only the 30 most-taken courses (22% of undergrad enrollments).

## Backtest on real data
Data: 45,143 rows of VT UDC exports, Fall 2019 to Spring 2024. Test set: Fall 2022 to Spring 2024, 15,122 undergrad sections, 579,589 graded students. Every test term is predicted only from earlier terms, and parameters are retuned before each term.

**Error vs. raw average (what other sites show):** MAE (lower is better, in GPA points) went from 0.193 to 0.185. Bootstrap over 2,916 courses: 3.7% lower, 95% CI 2.8% to 4.6%.

**Versus the methods other grade sites use** (same test set, MAE in GPA points):
- This engine: 0.185
- All-time instructor average: 0.193
- Most recent term only: 0.211
- Course average only: 0.211

**Ordering two professors correctly** (when their real GPAs differ by 0.15 or more): 76.9% for the raw average, 78.9% for this engine.

**80% ranges:** actual coverage 79.7%, and 78.6% to 81.9% in every history bucket. That means the ranges are honest.

**Where the gain comes from:**
- Long-history pairs (200+ students): 8.0% lower error, from weighting recent terms.
- Small history (<50 students): 3.2% lower, from shrinkage.
- New pairings (18.6% of students): no gain. Nothing beat the course mean, so the page says so and shows a wider range (0.83 GPA wide on average).

## Iterations (problem found, then fix)

1. **Baselines + grid search.** Beat the raw mean, but two parameters landed on the grid edge.
2. **Wider grid + weighting modes.** It overfit: decay 0.4 won on the post-COVID validation terms, then lost on later terms (MAE 0.1909 vs 0.1839). Fix: tune walk-forward, the way the live site would.
3. **Walk-forward.** Honest result: MAE 0.1852. The parameters settle at decay 0.7, kIC 25 to 50.
4. **Ranges.** Split-conformal by history and section size gave 79.7% coverage at an 80% target.
5. **Cross-course record for new pairings.** A wash (±1%), and the cause turned out to be identity.
6. **Name collisions.** Cross-course pooling helps distinctive surnames (−3.9% error) and hurts common ones (+0.7%). Flagged keys now skip it. Accuracy is neutral overall, but pages stop blending two different people.

7. **Instructor as a gap to the course's term average.** Tested as a replacement model. Lost walk-forward (MAE 0.1915 vs 0.1853), so it was dropped.
8. **"Does the instructor matter" verdict.** Label from past terms, then measure the real gap between the same instructors next term (717 course-terms): "barely" courses had a median real gap of 0.19, "modest" 0.31, "matters" 0.52. A real gap of 0.3 or more showed up in 26%, 51% and 72% of them. The label separates courses, but "barely" is not a guarantee, and the page wording reflects that.

## Site build numbers (measured, Apple silicon laptop)
- 3,420 course pages and 4,567 instructor pages in about 15 seconds (12 of them parameter tuning).
- Median page 7 KB of HTML, largest 163 KB, one shared 13 KB stylesheet, and two small shared scripts (search and compare; planner).
- Verdicts across all courses: 226 matters, 224 modest, 379 barely, 2,591 not enough history. In the 30 pilot courses: 14 matters, 8 modest, 3 barely, 5 not enough history.
- Not measured: competitor page weight and load time. No competitor site was fetched for this.

## Findings that change the product
1. **Instructor names may no longer be public.**
   - HokieFlow's saved public timetable pages from Sep 20, 2026 show "N/A" as instructor for all 536 sections they cover.
   - On Nov 14, 2026, the timetable search URL redirected to VT's login page in a real browser.
   - If confirmed, no public tool can say who teaches a section next term. Pages must be course-first ("if you get X"), and students look up their section's instructor in HokieSPA themselves.
2. **Last names collide where your users are.** "CS|Chen" covers CS 4604, 4804, 5804, 5214, 6724, and 4644. "CS|Lee", "ECE|Zhang", and "ECE|Wang" look the same. Professor pages for flagged names have to be per-course panels.
3. **In some big courses the instructor barely matters for grades, in others it clearly does.** CS 2114: every instructor falls between 3.06 and 3.20, and those gaps are smaller than the ranges. MATH 2114 spans 2.15 to 2.87, which is a real difference. Among the 30 most-taken courses, 14 are in the "matters" group and 3 in "barely". Pages should say which case a course is in.
4. **The gain is real but invisible.** A 0.008 GPA improvement in average error is not something a student notices. The visible differences are ranges, the "no history" honesty, and name warnings. Those build trust; they don't create hype.

## Will VT students switch from RateMyProfessors?
**Probably not as a replacement.** RMP has written opinions, years of habit, and coverage of every instructor. Grade data can't replace "is this professor clear and fair."

**Plausibly as a second tab.** What only this offers:
- Official outcomes, not opinions.
- Honest ranges.
- "Instructor choice barely matters in this course."
- Warnings when one name may be two people.

None of the existing free VT grade sites do these.

**Biggest risk:** a weak launch, and maybe no public instructor names. Neither can be fixed with better math.

## Validation plan before building the full site (cheap, real users)
1. **Re-check instructor visibility in a logged-out incognito window** (5 minutes). If names are hidden, keep the course-first design and ask Student Legal Services before showing crowd-reported instructor names.
2. **Pilot:** static pages for the 30 most-taken undergrad courses (22% of all enrollments; the top 100 cover 42%), shared in course GroupMes and r/VirginiaTech during spring add/drop.
3. **Kill criteria:**
   - Fewer than 200 unique visitors in the first add/drop week, or
   - Fewer than 10% of visitors returning within that window, or
   - In 10 student interviews, fewer than 3 say they'd check it before RMP.

   If any of these hits, stop or change the angle.
4. **If the pilot clears those bars,** extend to all 2,916 undergrad courses (the same code generates every page).

## Run it
- `npm install`
- `npm run check`: typecheck + tests
- `npm run backtest`: accuracy backtest (about 35 seconds)
- `npm run backtest:matters`: verdict backtest
- `npm run build`: full site into `dist/`. `npm run pilot`: top 30 courses only.
- View it: `python3 -m http.server 4173 --directory dist`, then open http://localhost:4173

**Data is stale.** The UDC page itself runs to 2026-27, but the two files in this repo end at Spring 2024, so pages say "Fall 2024". UDC shows one course at a time and blocks scripted clients, so ask UDC / Institutional Research for the full file. Then drop the CSVs into `data/`, and rebuild. Overlapping files are fine.

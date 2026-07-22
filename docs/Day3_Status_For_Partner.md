# ColorHunt — Day 1–3 Status: Color-Science Track (Jaswin)

**Date:** July 19, 2026
**For:** My co-founder, ahead of Day 4 joint work
**Purpose:** Honest, complete status of everything on the color-science track through Day 3 — what's done, what's verified, what's still open. Written to be handed to an LLM (or read directly) for full context before Day 4 planning.

**Latest commit:** `bf7ee8f` — `feat: implement confidence scoring, fix Tailwind CSS, reconcile score normalization factor`
**Repo:** https://github.com/Color-Hunt/MVP (branch `main`, pushed and confirmed live)

---

## 1. Where things stand, in one paragraph

The color-science pipeline (k-means extraction, outlier rejection, Lab conversion, CIEDE2000 scoring) has been complete and stable since Day 1–2. Day 3 added the one remaining color-science task — confidence scoring — as a new, isolated, exported function, without touching the existing pipeline's API contract. Separately, a pre-Day-4 audit surfaced and fixed two real bugs that had nothing to do with Day 3 scope but were blocking the app from working at all: a missing Tailwind/PostCSS config (the app was rendering completely unstyled) and an inconsistency where two different parts of the codebase were scoring color matches on two different curves. Both are fixed and verified. **One real, unresolved issue remains**: color extraction from the live webcam is producing colors that are darker and sometimes a different hue than the actual object, especially in dim lighting — root cause is partially diagnosed but not fixed, and needs a decision before or during Day 4.

---

## 2. Day 1 — Core color math (recap, already known to both of us)

- K-means dominant-color extraction (k=3), run in Lab space for perceptual accuracy.
- Outlier rejection (>2 std dev from centroid).
- RGB → Lab conversion (sRGB → XYZ D65 → Lab), independently verified against published reference values.
- CIEDE2000 implementation, verified against 13 published Sharma et al. test cases (12/13 exact match, 1 within noise).
- Two real bugs found and fixed during Day 1 testing: an image-loader channel-count bug (RGBA assumed on 3-channel JPEGs) and an outlier-rejection scope bug (was filtering the whole image instead of just the dominant cluster).

## 3. Day 2 — Browser pipeline (recap, already known to both of us)

- `canvasPixels.ts`, `regionSelection.ts`, `pipeline.ts` (`extractColorFromCanvas`), `browser.ts` (Node-free entry point).
- Playwright-automated browser testing for reproducible timing (216–345ms measured pipeline execution, well under the 500ms target).
- Caught and fixed a circular-validation bug where test target colors had been derived from the same test photos being scored against them — replaced with independent standard CSS colors, scores dropped to an honest 37–71% range as a result.
- Documented, not-yet-fixed limitation: extraction accuracy under poor lighting/specular highlights (explicitly deferred to Day 8 hardening).

---

## 4. Day 3 — What I actually did this session

### 4.1 Confidence scoring (the actual Day 3 deliverable)

Per `ColorHunt_Build_Plan_Split.md`, my Day 3 scope was: *"RGB → Lab conversion, full CIEDE2000 implementation, score calculation (0–100%), confidence score logic (flagging poor lighting)."* The first three were already done Day 1. The only outstanding piece was **confidence score logic** — implemented this session.

- **New file:** `packages/color-science/src/confidence.ts` — `calculateConfidence()`, using variance-based and brightness-based thresholding on the sampled region's pixels, returning `'high' | 'low'` plus diagnostic values and reasons.
- Exported from both `browser.ts` and `index.ts`.
- **Deliberately not wired into any UI.** Per the Build Plan Split, confidence *display* is explicitly a Day 4 (joint) task, not Day 3. The function exists and is ready for you to call from the results screen on Day 4 — the same way `extractColorFromCanvas` was left ready-and-waiting for me at the end of Day 2.
- **Did not touch `extractColorFromCanvas`'s signature or `ExtractionResult`'s shape** — both `HANDOFF.md` and the Day 1/2 summary document that contract as stable until Day 4's joint integration pass, so this was additive only.
- The exact variance (2000) and brightness (30–225) thresholds used are a first pass, not independently validated against real "bad lighting" test photos yet. Worth stress-testing together before leaning on it heavily in the UI.

### 4.2 Tailwind CSS — root cause found and fixed (not Day 3 scope, but was blocking everything)

The app was rendering with **zero CSS applied** — plain unstyled HTML, no layout, no swatches, tap-to-select effectively broken as a side effect (see 4.4). Root cause: there was no `postcss.config.js` anywhere in the repo. Tailwind v3 requires PostCSS wiring to process `@tailwind` directives — without it, Vite passed them through as literal unknown at-rules and generated almost no CSS (build output was ~0.16 kB).

**Fix:** added `postcss.config.js` at the project root with standard `tailwindcss` + `autoprefixer` plugins. Verified: production CSS bundle went from ~0.16 kB to 8.42 kB, Vite no longer warns about unknown at-rules, and the app now visibly renders correctly (dark theme, proper layout, swatches, rounded corners — confirmed by running the app, not just checking build output size).

### 4.3 Score normalization factor — found and fixed a real inconsistency

While auditing, found that two different parts of the codebase were scoring identical Delta-E values differently:
- `packages/color-science/src/ciede2000.ts`'s `deltaEToScore()` default was `normalizationFactor = 10`.
- `packages/color-science/src/testHarness.ts` (the Node regression-test file) hardcoded `deltaEToScore(deltaE, 15)` — and had a comment next to it incorrectly claiming it used factor 10.
- The original `ColorHunt_Merge_Handoff_Partner.md` doc's example code also used factor 15.

So the live browser app was scoring on a harsher curve (deltaE ≥ 10 → 0%) than what the test harness and original docs assumed (deltaE ≥ 15 → 0%). Two independent signals (test harness + original doc) pointed at 15 being the originally intended value, with 10 in `ciede2000.ts` being undocumented drift.

**Decision made and applied:** standardized on **factor 15** everywhere. Changed `ciede2000.ts`'s default from 10 → 15 (both `deltaEToScore` and `calculateColorScore`), updated its doc comment to match, and fixed the stale comment in `testHarness.ts`. `CaptureScreen.tsx` calls `deltaEToScore(deltaE)` with no override, so it now automatically picks up the new default — no app-layer change needed.

**Important caveat:** this does not fix extraction accuracy (see 4.4) — it only changes how harshly a given color-distance is scored. Real test rounds with Delta E in the 28–45 range still score 0% under factor 15 too; only borderline cases near the old 10–15 boundary are affected.

### 4.4 Open issue, not resolved: extraction skews dark/wrong-hue under real lighting

Live testing (webcam, dim indoor room) produced results like: an orange peel photographed as `#5F361D` (dark brown), a red apple as `#7C4E50` (dusty mauve). This isn't noise — the pattern is a consistent skew toward darker, less saturated, and sometimes different-hued extractions than the actual held object.

**Diagnosis so far (partial):**
- Node-based regression check on the existing red/green/blue test images shows **no regression** from Day 3's changes — pipeline still produces correct, expected results on controlled inputs (e.g. real-blue.jpeg → RGB(8,109,229) → ΔE 4.36 vs. RoyalBlue → 70.9% under the new factor-15 curve). The green test image's low score (13%) matches a previously-documented issue from Day 2 (`Day2_Changes.md`'s "Investigation: Low Green Score" — specular highlight on that specific test object), not a new problem.
- Debug logging on live webcam captures shows the k-means dominant-cluster selection (in `kmeans.ts`, which scores clusters by chroma) picking a smaller, high-chroma cluster over a larger, more representative one under dim lighting — e.g. selecting 17% of sampled pixels over the other 83% because that smaller cluster had higher chroma.
- **Not fully resolved:** in at least one debug sample, the selected cluster's RGB (35, 29, 108 — violet) didn't hue-match the actual photographed object (orange) at all, which is more than just "picked a duller version of the right thing." This suggests the region sampling itself, or something beyond the chroma-scoring heuristic, may also be involved. **I have not isolated this further yet.**
- This overlaps with, but isn't identical to, the specular-highlight limitation already documented from Day 2 and explicitly deferred to Day 8 ("harden edge cases: dark/light objects, mixed lighting, reflective surfaces").

**What I have not done:** changed any extraction logic (`kmeans.ts`, `outlierRejection.ts`, `colorConversion.ts`, `regionSelection.ts`, `pipeline.ts`) to address this. Per the audit constraints, this was diagnosis-only — no fixes applied without a decision on scope/timing.

**Decision needed before/during Day 4:** do we (a) treat this as confirmed Day 8 scope and proceed with Day 4 (calibration) as planned, accepting that calibration work might partially mask or might compound this issue, (b) spend some time now isolating the region-sampling-vs-scoring-heuristic question before starting calibration, since white-balance calibration and dominant-color extraction interact, or (c) something else. I don't think this should be silently deferred without us actually deciding together, since it directly affects whether Day 4's calibration work is building on solid ground.

---

## 5. Verification performed this session

- **TypeScript:** pass (`tsc -b` via `npm run build`)
- **Build:** pass — final production bundle: `dist/assets/index-*.css` 8.42 kB, `dist/assets/index-*.js` 207.45 kB
- **Lint:** pass, 1 pre-existing non-blocking warning (React Fast Refresh pattern in `GameStateContext.tsx` — cosmetic, not a bug, not something I introduced)
- **Color-science regression check:** ran the Node test harness against the existing red/green/blue test images — no regression, results consistent with prior documented behavior (see 4.4)
- **Manual smoke test:** ran the app (`npm run dev`), played rounds end-to-end, confirmed styling renders correctly and tap-to-select now works (this was very likely broken before purely as a downstream effect of the Tailwind bug — `PhotoPreview.tsx`'s tap-coordinate math assumes `object-fit: cover` CSS is active, which it wasn't until the Tailwind fix)
- **Git diff review before commit:** manually reviewed every changed file; one file (`pipeline.ts`) showed as "modified" in `git status` but turned out to be a Windows line-ending (CRLF) normalization only, confirmed via empty `git diff` output — no actual code change

## 6. Exactly what was committed and pushed

**Commit `bf7ee8f`**, 14 files changed, 1501 insertions(+), 14 deletions(-):

**New files:**
- `packages/color-science/src/confidence.ts` — Day 3 confidence scoring
- `postcss.config.js` — Tailwind fix
- `AUDIT_REPORT.md`, `Windsurf_Implementation_Plan.md` — this session's working docs
- `ColorHunt_Build_Plan_Split.md`, `ColorHunt_Merge_Handoff_Partner.md`, `Day1_Day2_Summary_For_Partner.md`, `colorhunt_llm_spec_v2.md` — planning docs, added to repo so they're version-controlled going forward instead of living only on my machine

**Modified files:**
- `packages/color-science/src/browser.ts`, `index.ts` — export the new confidence function
- `packages/color-science/src/ciede2000.ts` — normalization factor 10 → 15
- `packages/color-science/src/testHarness.ts` — fixed stale comment, removed unused import
- `packages/color-science/browser-test/automated-test.mjs` — removed unused variables (lint fix)

**Confirmed live on GitHub** at `Color-Hunt/MVP`, `main` branch, pushed cleanly with no merge conflicts (nothing new on `origin` at push time).

---

## 7. What's explicitly NOT done — still Day 4+ scope

Per `ColorHunt_Build_Plan_Split.md`, none of the following were started, per the "don't begin Day 4 work" constraint for this session:

- White-balance calibration (Day 4, mine)
- Calibration UI flow — "photograph a white surface" step (Day 4, yours)
- Wiring confidence scoring into the results screen UI (Day 4, joint)
- Wiring my scoring output into your results screen more generally (Day 4, joint — though note `CaptureScreen.tsx`/`ResultsScreen.tsx` already do this basic wiring as of Day 2/3; Day 4's version of this task is likely more about calibration + confidence display specifically)
- Pass-and-play flow, timer, leaderboard, bonus voting (Day 5)
- Production color palette, Collection Mode, and everything past that (Day 6+)

## 8. Questions for you before/during Day 4

1. Do you agree with standardizing on normalization factor 15? (Already applied — flag now if you'd rather revisit.)
2. How do you want to sequence the dark-extraction issue (§4.4) relative to Day 4's calibration work — investigate further first, or proceed and treat it as Day 8?
3. Worth a quick joint test session with better/more controlled lighting before we build calibration on top of an extraction pipeline we're not 100% sure is behaving correctly in realistic conditions?

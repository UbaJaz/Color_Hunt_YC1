# ColorHunt — Brutal Audit: Day 4 K-Means Fix Claims

**Purpose:** `Day4_Status_For_Partner.md` reports Task 1 (k-means dominant-cluster fix) as done and verified. On review, several claims in that status note don't hold up to scrutiny — the math described doesn't match what the formula should produce, the "passing" test may be passing for the wrong reason, and a real regression risk was never tested. Do not accept the previous status note's self-report at face value. Re-derive everything from the actual code, show your work, and fix whatever doesn't check out.

**Ground rule for this entire audit:** every claim below must be backed by pasted, real output — actual numbers from actual test runs, actual diffs, actual command output. "PASS" with no supporting numbers is not an acceptable answer anywhere in this audit. If a claim in the Day 4 status note turns out to be correct after you verify it, say so and show the verification — don't just take my word for it either.

---

## Audit Item 1 — Verify the size-penalty arithmetic

The status note claims: *"a 17% cluster gets a ~0.43x penalty instead of ~0.41x"* under the new graduated ramp (threshold changed from the planned 0.15 to an implemented 0.20).

**Do this:**
1. Show the actual current `scoreResult()` (or wherever the size-ramp logic now lives) as it exists in the repo right now — paste the real code, not a paraphrase.
2. By hand (in a comment or scratch script), compute `sizeFactor` for `sizeRatio = 0.17` under both:
   - The **old** logic (flat 0.3x below 5%, otherwise just `sqrt(sizeRatio)`)
   - The **new** logic as actually implemented
3. Print both numbers. If they come out close to the ~0.41 vs ~0.43 the status note claims, show the exact arithmetic that gets you there. If they don't (a naive read of a `(ratio/threshold)*0.5` ramp at `ratio=0.17, threshold=0.20` gives roughly a 0.4x multiplier *on top of* `sqrt(0.17)`, i.e. something around 0.17–0.18 total, not 0.43) — then the status note's numbers are wrong, and you need to explain what the real before/after values are and whether that changes how confident we should be that the fix does anything meaningful.

**Expected output:** a short block showing `sizeRatio=0.17`, old `sizeFactor=X`, new `sizeFactor=Y`, and the ratio `Y/X` so it's obvious how much stronger (or not) the new penalty actually is.

---

## Audit Item 2 — Isolate the size-penalty fix from the hue-consistency check

Two independent fixes went into `kmeans.ts` on Day 4. The single synthetic test (orange 83% / violet 17%) has a hue divergence of roughly 107° between the two clusters — well over the 90° hue-check threshold. That means **the hue-consistency check alone could be flipping this test to pass**, regardless of whether the size-penalty change does anything at all. One passing test does not prove two independent fixes both work.

**Do this:**
1. If the size-ramp logic isn't already a separately callable/testable function, refactor it into one (e.g. `calculateSizeFactor(sizeRatio: number): number`) purely so it can be unit tested without going through full k-means clustering. This is a reasonable, small refactor — do it.
2. Add a **pure unit test** for `calculateSizeFactor()` directly: assert the exact numeric output at `sizeRatio = 0.17`, `0.10`, `0.05`, `0.25`. No clustering involved, no hue check involved — just the function.
3. Add a **second synthetic k-means test**, separate from the existing one, where:
   - The large cluster (~83%) and small cluster (~17%) have a **hue divergence you compute and explicitly assert is under 90°** in the test itself (don't eyeball it — calculate `atan2(b,a)` for both centroids and assert the difference).
   - The small cluster still has meaningfully higher chroma than the large one (so, pre-fix, it would have won on chroma advantage alone).
   - Assert that **post-fix, the large cluster now wins** — proving the size penalty alone (not the hue check, which can't fire here) is doing real work.

**Expected output:** the unit test values from step 2, and a pass/fail result from step 3's new test, with the actual hue-divergence number printed so it's provably under 90°.

---

## Audit Item 3 — Regression-test the case this fix could break: a real small colorful object against a large dull background

This is the most important item in this audit. **Read this carefully — there's a real design risk here, not just a testing gap.**

The whole point of the original dominant-cluster heuristic (`chroma * sqrt(sizeRatio)`, biased toward high-chroma clusters) was to correctly favor a colorful *tapped object* over a large, dull *background* — e.g. a small vivid red berry held up against a large muted green leaf/hand/wall behind it. That is the **intended, correct** behavior, not a bug.

The new hue-consistency safeguard says: *if the winning cluster is small (<25%) and its hue diverges >90° from the largest cluster, prefer the largest cluster instead.* But a small, correctly-hued, high-chroma foreground object against a large dull background is going to look **exactly like this pattern** — red berry (~40° hue) vs. green leaf (~130° hue) is a >90° divergence, and the berry is legitimately the minority cluster by pixel count. If the safeguard fires here, it will actively pick the wrong answer (the leaf) in a case that used to work correctly.

**Do this:**
1. Construct a synthetic test: ~80–85% dull, low-chroma green background (e.g. `L=45, a=-20, b=25`), ~15–20% vivid, high-chroma red foreground (e.g. `L=40, a=55, b=35`).
2. Compute and print the actual hue divergence between the two clusters — confirm it's over 90° (it should be, red vs. green are close to hue-opposite).
3. Run this through the current (post-Day-4-fix) `extractDominantColor()` and report which cluster wins.
4. **If the leaf/background wins, this is a real regression introduced by today's fix and must be fixed before this is "done."** Do not report this as a known limitation to defer — the original heuristic handled this case correctly before today's change, so this would be a fix that broke working behavior.
5. If it needs fixing, a plausible correction: only apply the hue-override when the *large* cluster's own chroma is above some minimum threshold (i.e., only override when the large cluster is a plausible "same-object-different-lighting-patch" candidate, not when it's a genuinely dull/neutral background that was never a serious contender for "the object"). Implement, document as a DESIGN DECISION comment matching the file's existing style, and re-test both this case and the original orange/violet case to confirm both now pass together.

**Expected output:** the hue-divergence number from step 2, the winner from step 3, and — if it initially fails — the fix applied and confirmation both this test and the Item 2 test still pass afterward.

---

## Audit Item 4 — Validate against real photos, not just synthetic data

The status note defers real-photo validation to "Question 1 for Day 5." That's not acceptable — the bug that motivated this entire fix was diagnosed from real webcam captures (orange peel → violet, red apple → dusty mauve), documented in `Day3_Status_For_Partner.md` §4.4. A synthetic two-cluster test is a reasonable first check but is not proof the real bug is fixed, because real photos have hundreds of intermediate pixels, gradients, JPEG compression artifacts, and lighting noise that a two-cluster synthetic array doesn't capture.

**Do this:**
1. Check the repo for existing real test image fixtures (`packages/color-science/browser-test/` and anywhere `real-blue.jpeg`-style files live, per the pattern referenced in `Day3_Status_For_Partner.md`). Confirm whether real orange/red test photos from Day 2–3 testing exist anywhere in the repo or were only ever live webcam captures that were never saved.
2. If saved test photos exist: run them through the current pipeline and report the actual extracted RGB/Lab/hue for each, compared against the Day 3-documented bad results (`#5F361D` for orange peel, `#7C4E50` for red apple).
3. If no saved photos exist: say so explicitly, and flag that this task cannot be fully verified until new dim-lighting test photos are captured and added as permanent fixtures — don't silently mark this as done.
4. Whatever the outcome, report exact extracted RGB values, not just "hue family looks right."

**Expected output:** either real before/after RGB values from real photos, or an explicit statement that no real fixtures exist and this is unverified pending new photo capture.

---

## Audit Item 5 — Re-run lint from the repo root, not the package

The status note says: *"Lint: N/A — no lint script configured in this package."* This is very likely wrong. `Day3_Status_For_Partner.md` explicitly reports a clean `npm run lint` pass, and there's a repo-root `.oxlintrc.json`, which strongly suggests lint runs at the monorepo root and covers `packages/color-science` too, not per-package.

**Do this:**
1. From the repo root (not inside `packages/color-science`), run `npm run lint`.
2. Paste the full output.
3. Confirm explicitly whether `packages/color-science/src/kmeans.ts`, `calibration.ts`, `pipeline.ts`, and `testHarness.ts` are actually covered by this lint run (check the oxlint config's include/exclude globs if it's not obvious from the output).
4. If lint genuinely doesn't cover this package, say so explicitly and flag it as a real gap — don't mark it N/A silently.

**Expected output:** full real lint output from repo root, plus an explicit yes/no on whether the color-science files were in scope.

---

## Audit Item 6 — Confirm the undocumented deviations from the original plan were intentional, not accidental

Two things changed from what was originally specified without explanation in the status note:
- Ramp threshold: plan said `0.15`, implementation used `0.20`.
- Hue-consistency check: plan said "if hue diverges >90°, prefer the larger cluster" with no size condition; implementation added an additional `<25% size` gate.

**Do this:**
1. Confirm both changes are intentional, and give the actual reasoning (if there's a good reason — e.g. `0.20` catches more borderline cases, or the `<25%` gate prevents the hue check from firing on legitimately close-to-50/50 splits — say so). If there's no real reason and it was just an arbitrary implementation choice, say that plainly instead of retroactively justifying it.
2. Confirm both constants have "DESIGN DECISION"-style comments in the code, matching the existing documentation convention used elsewhere in `kmeans.ts` (e.g. next to `initializeCentroids` and `scoreResult`). Paste the actual comments.

**Expected output:** the actual code comments, plus a one-line honest statement of why each threshold has the value it has.

---

## Checklist — do not report this as done until every box is real, verified, and backed by pasted output

- [ ] **Item 1:** Actual size-penalty numbers recomputed and printed for `sizeRatio=0.17`, old vs. new, with the real arithmetic shown
- [ ] **Item 2a:** Size-ramp logic extracted into a testable pure function
- [ ] **Item 2b:** Pure unit test added for the size-ramp function at 4 different ratios, values printed
- [ ] **Item 2c:** Second synthetic k-means test added (hue divergence <90°, explicitly computed/asserted), confirms size penalty alone flips the winner
- [ ] **Item 3a:** Red-berry/green-leaf regression test added, hue divergence computed and confirmed >90°
- [ ] **Item 3b:** Test result reported honestly — if it initially failed, say so
- [ ] **Item 3c:** If it failed, fix implemented, documented, and *both* Item 2c and Item 3 tests pass together afterward
- [ ] **Item 4:** Real photo validation performed if fixtures exist, or explicitly flagged as unverified/blocked if they don't — not silently deferred
- [ ] **Item 5:** `npm run lint` actually run from repo root, full output pasted, color-science file coverage confirmed explicitly
- [ ] **Item 6:** Threshold deviations (0.15→0.20, added size gate) confirmed intentional with real reasoning, DESIGN DECISION comments pasted
- [ ] All existing red/green/blue regression tests re-confirmed passing *after* any fixes made during this audit (not just before)
- [ ] A revised status note written that replaces unverified claims with the real, audited numbers — this audit is not "done" until the status note itself is corrected, not just the code

**If any item above surfaces a real bug (especially Item 3), fix it as part of this audit before reporting completion. Do not push a "fixed" claim to your partner a second time unless every item above is actually backed by real, pasted output.**

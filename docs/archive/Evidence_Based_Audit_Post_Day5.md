# ColorHunt — Brutal Audit + Implementation Plan (Evidence-Based, Post Day 5)

This audit is different from the earlier ones: every finding below was produced by actually installing dependencies, running `npm run build`, and executing `node dist/testHarness.js` against the real repo — not by re-reading code or trusting prior status reports. Prior status reports have a track record of unverified/incorrect "PASS" claims; this one is grounded in real command output, quoted below.

**Do this in the exact priority order given.** Item 1 blocks everything else (literally blocks `npm run dev`) — fix it first, confirm the whole app boots, then move down the list.

---

## Priority 0 — Fix the broken build (do this first, before anything else)

**Evidence:**
```
$ npm run build   (inside packages/color-science)
tsconfig.json(12,25): error TS5107: Option 'moduleResolution=node10' is deprecated
  and will stop functioning in TypeScript 7.0. Specify compilerOption
  '"ignoreDeprecations": "6.0"' to silence this error.
Exit code: 2
```

`packages/color-science/tsconfig.json` sets `"moduleResolution": "node"`, which the project's own pinned TypeScript version (5.9.3, per `packages/color-science/package.json`'s `^5.3.0` range) flags as a hard error, not just a warning.

**Why this matters more than it looks:** root `package.json` has:
```json
"dev": "npm run build:color-science && vite",
"build": "npm run build:color-science && tsc -b && vite build",
"build:color-science": "npm install --prefix packages/color-science && npm run build --prefix packages/color-science"
```
All three are `&&`-chained. `build:color-science` exiting with code 2 **stops the chain before `vite`/`tsc -b`/`vite build` ever run.** This means, as of the current repo state, `npm run dev` and `npm run build` at the project root are both broken end-to-end. If you've been running `vite` directly in an editor without going through the npm script, this would be invisible — which is almost certainly why it hasn't been caught yet.

**Fix (one line, safe, no behavior change):** add `"ignoreDeprecations": "6.0"` to `packages/color-science/tsconfig.json`'s `compilerOptions` — this is TypeScript's own officially suggested fix for exactly this warning, and it doesn't change module resolution semantics (unlike switching to `"bundler"` or `"nodenext"`, which could affect how the `.js`-suffixed imports throughout this package resolve — don't do that instead, it's a bigger change than necessary).

**Verify:**
1. `npm run build` inside `packages/color-science` — confirm exit code 0, paste the output.
2. `npm run build` and `npm run dev` from the repo root — confirm both actually reach `vite`, not just `build:color-science`.
3. Commit this fix by itself, separately from everything else below, so there's a clean rollback point.

---

## Priority 1 — Investigate the real-photo accuracy finding (don't just accept or dismiss it)

**Evidence — actual output from running the existing `REAL IMAGE TEST` section of `testHarness.ts` against `test-images/real-red.jpeg`:**
```
Dominant RGB: (237, 76, 77)
| Target Color | Target RGB      | Delta E | Score |
| Crimson      | (220,20,60)     | 9.33    | 37.8  |
```
Per `ciede2000.ts`'s own documented scoring bands (`7.5–15: score 0–50 (poor match)`), this real photographed red object lands in the "poor match" tier against the closest available target color. This is the first time any of Day 4/5's fixes have been checked against an actual photograph rather than synthetic Lab data — every "PASS" in prior status reports was synthetic-only.

**These fixtures were sitting in the repo the whole time** (`test-images/real-red.jpeg`, `real-green.jpeg`, `real-blue.jpeg`, all dated Jul 17 — Day 2) and already wired into `testHarness.ts`. Two prior status reports claimed real-photo validation was "not actionable — no fixtures exist." That claim was false; the fixtures existed, the test code already existed and ran every time `testHarness.ts` was run, and nobody looked critically at its output.

**Do this — figure out whether this is a real problem or an artifact of the test conditions:**
1. Check whether this test applies calibration. (It doesn't — confirm this yourself by reading the real-image test code path in `testHarness.ts`.) A 9.33 Delta E on an *uncalibrated* real photo under unknown lighting may be expected and not actually indicate a pipeline bug — real cameras have color casts that calibration exists specifically to fix. Re-run the same real photo through the pipeline **with** a reasonable synthetic calibration matrix applied (e.g. assume a mild warm-light correction) and see whether the score improves meaningfully. If it does, this isn't a k-means/hue-check bug, it's expected behavior for an uncalibrated shot, and should be documented as such rather than flagged as broken.
2. Independently of calibration, sanity-check the extraction itself: is `(237, 76, 77)` actually a reasonable "dominant color" for what's likely a red object in that photo, or does it look washed out / shifted in a way that suggests the k-means or outlier-rejection logic is doing something wrong on real (noisy, JPEG-compressed, non-uniform-lighting) pixel data that it doesn't do on clean synthetic Lab arrays? You have the actual image file — look at it.
3. Report the honest conclusion either way: "uncalibrated real photos score in the 30-50s and that's expected, calibration is the fix" is a legitimate, fine conclusion. "The pipeline is extracting a visibly wrong color even accounting for lighting" is a real bug that needs fixing before Day 6. Don't default to the comfortable answer without checking.
4. Do NOT spend more than one focused pass on this — if it's inconclusive, document what you found and move on to Priority 2. This is flagged for investigation, not for open-ended debugging.

---

## Priority 2 — Fix the meaningless "real green object" test

**Evidence:**
```
| Target Color | Target RGB      | Delta E | Score |
| Crimson      | (220,20,60)     | 66.71   | 0.0   |
| CadetBlue    | (95,158,160)    | 13.04   | 13.1  |
| RoyalBlue    | (65,105,225)    | 41.17   | 0.0   |
... (all others also 0.0)
```
The target color list used in this test (`Crimson, CadetBlue, RoyalBlue, Bright Orange, Purple, Yellow, White, Black`) **contains no green color at all.** A real green object is guaranteed to score near-zero against every one of these regardless of whether the extraction is accurate, because there's nothing for it to correctly match. This test has been producing a wall of misleading 0.0 scores that look like a failure but actually measure nothing.

**Fix:** add at least one green-family target color to the test's comparison list (e.g. `ForestGreen (34, 139, 34)` or similar) so the green real-photo test can actually validate something. Re-run and report the real score against a color it could plausibly match.

---

## Priority 3 — Fix the k-means determinism bug

**Evidence:** `recalculateCentroids()` in `kmeans.ts` contains:
```ts
} else {
  const randomIndex = Math.floor(Math.random() * pixels.length);
  newCentroids.push({ ...pixels[randomIndex] });
}
```
This fires when a cluster ends up with zero assigned pixels mid-iteration. It uses **unseeded `Math.random()`**, despite `initializeCentroids()` elsewhere in the same file going out of its way to be deterministically seeded (`seedOffset` parameter, documented specifically so the 5-run comparison in `extractDominantColor()` is reproducible).

**I observed this directly:** running the "dim-lighting" synthetic test twice (identical input each time) produced different exact output — `L=36.30, cluster sizes 170/394/436` on one run vs. the previously-documented `L=34.24, cluster sizes 170/463/367` on another. Both happened to still pick the correct winning cluster, so no test *failed* — but this means every "PASS" claim in every prior status report that relied on exact-number reproducibility is only accidentally reproducible, and there's no guarantee a future run won't tip a close call the wrong way. For a game that needs consistent scoring during a live demo, this is worth fixing now rather than discovering it live.

**Fix:** replace the random fallback with a deterministic choice — the simplest correct option is to reuse the same logic already used in `initializeCentroids()`'s k-means++ step: pick the pixel with the maximum minimum-distance to all current (non-empty) centroids. This keeps the fallback meaningful (picks a genuinely underrepresented pixel, not an arbitrary one) while making it reproducible.

**Verify:** run the full `testHarness.ts` suite twice in a row, diff the two outputs, confirm they're now byte-for-byte identical. Paste both runs' relevant numbers to prove it.

---

## Priority 4 — Correct the historical record

Both `Day4_Status_For_Partner.md` and the earlier `Day5_Status_For_Partner.md` draft contain the claim that real-photo validation is "not actionable" / "no fixtures exist." This is factually wrong and should be corrected — not deleted, corrected, so the record is honest about what was actually known when. Add a short dated addendum to `Day5_Status_For_Partner.md` (don't rewrite history, append a correction) noting: fixtures existed since Day 2, the real-image test was already present in the harness, and it was not critically examined until this audit.

---

## Priority 5 — Note the integration surface for when Friend catches up (informational, not actionable yet)

Friend's side (`src/`) is still at Day 3 per current repo state — confirmed by grep: nothing in `CaptureScreen.tsx`, `ResultsScreen.tsx`, or `GameStateContext.tsx` currently imports `calibration.ts`, `confidence.ts`, or `bonusVoting.ts`. This is expected, not a bug. Nothing to fix here today. One thing worth deciding now rather than later, since it's cheap to decide and easy to forget: **when `calculateBonusMultiplier()` gets wired into an actual displayed score, the combined `baseScore * multiplier` needs an explicit clamp to 100** (a 2.0x multiplier on an 80+ base score will exceed 100 otherwise). Leave a one-line comment in `bonusVoting.ts` noting this so it isn't lost when Friend/joint-work wires it in on Day 5's joint task or later.

---

## Checklist

- [ ] Priority 0: build fix applied, `npm run build` and `npm run dev` both verified to actually reach Vite, committed separately
- [ ] Priority 1: real-photo accuracy finding investigated with calibration applied, honest conclusion documented either way
- [ ] Priority 2: green target color added to real-image test, re-run, real score reported
- [ ] Priority 3: `Math.random()` fallback replaced with deterministic logic, full suite run twice and diffed to prove reproducibility
- [ ] Priority 4: status doc addendum added correcting the "no fixtures" claim
- [ ] Priority 5: one-line clamp reminder comment added to `bonusVoting.ts`, no other action needed today
- [ ] Full regression suite run one final time after all fixes, pasted in full, not summarized
- [ ] Everything committed locally with clear messages; do not push without explicit go-ahead

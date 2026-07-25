# Day 8 — Color Science & Signal Processing (Jaswin's Track)
> Status: COMPLETE with 1 known, ticketed, non-blocking failure (CS-001, scheduled Day 9)
> Scope: `packages/color-science/src/` only. Zero changes to Friend's UI code (`src/screens/*`, components, game state).
> Public API (`extractColorFromCanvas`, `calculateConfidence`, `getRarityTier`, `isSuccessfulUnlock`) unchanged — no breaking changes.

---

## 1. Objective

Harden edge cases in the color-extraction pipeline for real-world camera conditions:
- Very dark objects (L < 25) and very light/overexposed objects (L > 85)
- Mixed lighting causing an object to split into shadow/highlight sub-clusters
- Specular highlights (glossy glare) distorting extracted color
- Confidence diagnostics distinguishing bad photo conditions from valid dark/light colors

---

## 2. Changes Made

### `kmeans.ts`

**a. Lightness significance for low-chroma dark/light objects** (`scoreCluster()`)
```
if (centroid.L > 85 || centroid.L < 25) {
  lightnessSignificance = Math.min(25, Math.abs(centroid.L - 50) * 0.5);
}
significance = Math.max(chroma, lightnessSignificance);
```
Ensures a black, white, pastel, or beige object isn't discarded just because its chroma is low — it gets scored on lightness contrast instead.

**b. Mixed-lighting hue-cluster merging** (Δh ≤ 30°)
When two clusters are both ≥15% of the sampled region, comparably sized (within 25% of each other), and within 30° hue of each other, their effective size is summed. This lets a single object that got split across shadow/highlight regions accumulate its true footprint instead of losing to background noise as two separate small clusters. Includes correct hue wrap-around handling (`Math.min(diff, 360 - diff)`).

**c. Specular highlight penalty**
```
if (centroid.L > 90 && chroma < 15 && sizeRatio < 0.08) {
  significance *= 0.1;
}
```
Suppresses small (<8%), near-white, low-chroma glare clusters so gloss reflections don't win over the true object color.

**d. Perceptual non-linear weighting** (not in original plan — added during implementation)
```
perceptualWeight = Math.pow(significance, 1.2)
```
Gives vivid target colors a natural edge over dull background clutter. Verified via real-image and regression tests that this does not reintroduce bias against low-chroma dark/light objects (the (a) fix still protects them).

**e. K-means seeding fix** (root-cause fix, Day 8 session 2)
Added `SeedStrategy` enum + `pickFirstCentroid()`. Previously k-means++ always seeded its first centroid on the highest-chroma pixel, which meant a low-chroma dark object could never become its own isolated cluster — it got absorbed into background clusters before `scoreCluster()` ever saw it. Now the `numRuns` seed strategies rotate through `HighestChroma`, `DarkestPixel`, `LightestPixel`, `MaxSpread`, giving dark/light objects a fair chance to form a clean cluster.

**f. `calculateSizeFactor` boundary fix**: `> 0.80` → `>= 0.80`
A hue-merged background pair summing to *exactly* 80.0% was escaping the "overly dominant cluster" penalty by a rounding hair. Changed to inclusive `>=`. Verified via full boundary sweep across every test with a cluster near 80% (see Section 4) — confirms no previously-passing test is negatively affected; only the exact-80% edge case (the dark-object test) changes behavior.

### `confidence.ts`
- Added file-level documentation clarifying that `calculateConfidence()` operates in **sRGB brightness space (0–255 mean)**, thresholds 30 (underexposed) / 225 (overexposed) — **not** the Lab L* space (25/85/90) used in `kmeans.ts`. These are intentionally different concerns (photo-quality diagnostic vs. cluster color-significance scoring) but were previously undocumented, which would have caused confusion when Friend's branch merges against this code.
- **Known gap (not fixed, deferred):** `confidence.ts` does not yet distinguish "valid dark/light object" from "underexposed/overexposed photo" — a black object and a genuinely dark photo both currently return `diagnostic = 'underexposed'` with the same messaging. No `specular_highlight` diagnostic code exists yet. This was in the original Day 8 plan but was not completed. Candidate for Day 9/10.

### `testHarness.ts`
- Added/strengthened test scenarios:
  - `testLowChromaDarkObject` — asserts a 20%-size, low-chroma, L=18 cluster wins over an 80%-size mid-tone background.
  - Lighting Stress-Test Scenarios 1–5 (very dark, overexposed, mixed lighting/hue-merge, low-saturation beige, specular glare).
  - **Scenario 2 assertion strengthened**: now checks `dominantIndex === highestLClusterIndex` (winner identity) instead of the old `dominantLab.L > 85` check, which could pass trivially even if the wrong cluster won.
  - **Scenario 3 assertion strengthened**: now checks `hasSameHueNeighbour && mergeFired` using the closest-ratio neighbor (fixed a loop bug where the last-seen neighbor overwrote a valid closer match), instead of the old `chroma > 10` check, which passed regardless of whether the hue-merge logic actually fired.
  - `calculateSizeFactor` unit tests, including the new `>= 0.80` boundary case.

---

## 3. Test Results (Full Raw Suite — final run)

| Suite | Tests | PASS | FAIL |
|---|---|---|---|
| calculateSizeFactor unit | 4 | 4 | 0 |
| White-balance calibration | 4 | 4 | 0 |
| Bonus voting multiplier | 5 | 5 | 0 |
| Low-chroma dark object | 1 | 1 | 0 |
| Dim-lighting k-means | 1 | 1 | 0 |
| **Same-hue k-means** | 1 | 0 | **1 — see Section 5 (CS-001)** |
| Red-berry / green-leaf regression | 1 | 1 | 0 |
| Lighting stress-test (Scenarios 1–5) | 5 | 5 | 0 |
| Real image pipeline (Red/Green/Blue) | 3 | 3 | 0 |
| **TOTAL** | **25** | **24** | **1** |

- `npm run build` (TypeScript): exit 0, no errors
- `npx oxlint packages/color-science/src`: 0 warnings, 0 errors (103 rules, 17 files)
- Real image accuracy: Red ΔE=5.89 (score 60.7), Green ΔE=9.30 (score 38.0), Blue ΔE=4.36 (score 70.9)
  - **Note:** Green's ΔE=9.30 is a clearly-perceptible color difference (ΔE > ~2.3 is noticeable to the human eye) and currently still counts as a pass. This is not a regression, but is a flagged accuracy concern to revisit in Day 9/10 — not yet actioned.

---

## 4. `>= 0.80` Boundary Change — Verified Safe

Checked every cluster across all tests that comes near the 80% threshold:

| Test | Largest merge-eligible ratio | Affected by `>=` change? |
|---|---|---|
| Dim-lighting k-means | 43% | No |
| Same-hue k-means | 83% (already > 80 under old rule) | No — unaffected, still fails for unrelated reason (CS-001) |
| Red-berry/green-leaf | 80% (green pair, same hue) | No — red berry still wins 58.6 vs 22.2 |
| **Low-chroma dark object** | **exactly 80%** | **Yes — this is the fix target** |
| Scenario 2 (overexposed) | 80% (mid-tone pair, same hue) | No — overexposed cluster still wins 16.0 vs 4.9 |
| Scenario 3 (mixed lighting) | 50% | No |
| Scenario 5 (specular) | ~95% | No — already penalized both before and after |
| Real Red / Green / Blue | 49–83% (case-by-case) | No — verified no winner changes |

**Conclusion:** the boundary change from `> 0.80` to `>= 0.80` affects exactly one case (a cluster at exactly 80.0%) and does not change the outcome of any other currently-passing test.

---

## 5. Known Failure — CS-001 (Ticketed, Not Yet Fixed)

**Test:** `testSameHueKMeans` — 83% dull orange vs. 17% saturated orange, same hue (k=3)
**Symptom:** The 17% saturated cluster wins when the 83% dull-orange (merged) cluster should win.
**Status of root-cause investigation:** Traced but **not conclusively resolved**. The scoring math on paper suggests dull orange should win after the hue-merge and `>=0.80` penalty are applied, but it doesn't in practice. Leading hypothesis is that the small cluster's centroid chroma at k-means convergence is higher than the synthetic input value, or the merge/scoring interaction has an unaccounted-for edge case — this was **not confirmed**, only inferred.
**Proposed fix (Option A, preferred, not yet applied):** In `calculateSizeFactor`, reduce the small-cluster ramp scale factor from `0.5` to `0.35` (line ~76, `* 0.5` → `* 0.35`). This increases the penalty on small vivid clusters below the 20% ramp threshold.
**Required regression gate before this fix is merged:** `testSameHueKMeans` PASS + `testRedBerryGreenLeaf` PASS + `testDimLightingKMeans` PASS + real image outputs unchanged.
**Recommended before applying the fix:** Log actual post-convergence centroid chroma values and final `effectiveSizeRatio` for all 3 clusters in this test — the root cause was never definitively confirmed, so the fix should not be treated as understood, only as a scoped, gated experiment.
**Owner:** Jaswin
**Target:** Day 9, before merging with Friend's Day 7/8 UI branch

---

## 6. Deferred / Not Yet Done

- `confidence.ts` granular diagnostics distinguishing valid dark/light objects from bad-exposure photos (no `specular_highlight` code, no chroma-awareness in confidence module).
- Real Green ΔE=9.30 accuracy — currently passes but is a borderline/weak pass worth revisiting.
- CS-001 fix (Section 5) — proposed but not applied or verified.

## 7. Verified Non-Regressions

- Public API surface unchanged (`extractColorFromCanvas`, `calculateConfidence`, `getRarityTier`, `isSuccessfulUnlock`).
- No files under `src/screens/*` or Friend's component/game-state code touched.
- Red-berry/green-leaf, white-balance, bonus-voting, and real-image tests all pass unchanged after every fix applied this session.

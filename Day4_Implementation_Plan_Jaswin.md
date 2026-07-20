# ColorHunt — Day 4 Implementation Plan (Jaswin's Track: Color Science)

**Date:** July 20, 2026 (Day 4 of the 12-day build)
**Audience:** This doc is written to be pasted directly into Windsurf, which will have the full repo attached. It gives Windsurf the context, the decision that's been made, and the exact task list for today.

---

## 0. Project context (read this first)

ColorHunt is a pass-and-play party game (YC application, deadline July 27, 2026, 8pm PT). Players photograph real objects and try to match a target color. A phone camera → k-means color extraction → CIEDE2000 scoring pipeline turns that into a 0–100% match score.

Two tracks are running in parallel:
- **Jaswin (me) — Color Science track:** `packages/color-science/src/*` — everything that turns pixels into a trustworthy score.
- **Partner — App/Product track:** `src/screens/*`, `src/state/*`, `src/hooks/*` — the React UI, game flow, state management.

**Do not modify partner's files today** (`src/screens/CaptureScreen.tsx`, `src/screens/ResultsScreen.tsx`, `src/state/GameStateContext.tsx`, anything else under `src/`) except where explicitly noted below as joint wiring. Stay inside `packages/color-science/src/`.

### Current state of `packages/color-science/src/` (as of Day 3, commit `bf7ee8f`)
- `types.ts` — `RGB`, `Lab`, `XYZ`, `KMeansResult`. **Contract is stable — do not change existing field shapes.**
- `colorConversion.ts` — `rgbToLab`, `labToRgb`. Verified against reference values. Don't touch.
- `kmeans.ts` — `extractDominantColor(pixels: Lab[], k=3, maxIterations=100, numRuns=5)`. Picks the best of 5 k-means runs via `scoreResult()`, which favors high-chroma clusters. **This is today's first fix target — see §1.**
- `outlierRejection.ts` — `rejectOutliers(pixels, centroid, numStdDevs=2)`. Stable, don't touch.
- `ciede2000.ts` — `deltaE2000`, `deltaEToScore`, `calculateColorScore`. Normalization factor is standardized on **15** (fixed Day 3). Don't touch.
- `confidence.ts` — `calculateConfidence(extractedRgb, sampledPixels, varianceThreshold=2000, minBrightness=30, maxBrightness=225)`. Built Day 3, not yet wired into UI. Exported, ready to use.
- `pipeline.ts` — `extractColorFromCanvas(canvas, tapX, tapY, k=3, outlierStdDevs=2, regionProportion=0.20)` returns `ExtractionResult { extractedRgb, extractedLab, dominantClusterSize, totalPixelsSampled, region }`. **This is today's second fix target — see §2.**
- `regionSelection.ts` — `selectRegion()`. Stable, don't touch.
- `canvasPixels.ts` — `getPixelsFromImageData`, `getPixelsFromRegion`. Stable, don't touch.
- `browser.ts` / `index.ts` — re-export everything above for browser/Node consumption respectively. Update both when adding new exports.
- `testHarness.ts` — Node regression test file, run manually (not automated in CI). Has existing red/green/blue test fixtures.

### The open issue that determines today's sequencing
Day 3 testing (see `Day3_Status_For_Partner.md`, §4.4) found that live webcam extraction skews dark and sometimes picks the **wrong hue entirely** under dim lighting — e.g. an orange object extracted as violet (35, 29, 108). Debug logging shows `kmeans.ts`'s dominant-cluster selection (`scoreResult()`) picking a small, high-chroma cluster (17% of pixels) over the larger, representative one (83%), and in at least one case the winning cluster didn't hue-match the actual object at all.

**Decision for today:** fix this *before* building calibration on top of it. White-balance calibration estimates a correction from a single reference photo and then applies it to every subsequent submission — if the underlying extraction is unstable (picking noise clusters, wrong hue), calibration will be calibrating against garbage and Day 8's hardening work will inherit a much bigger problem. This is a ~1–2 hour investment that de-risks everything downstream, including calibration itself.

---

## 1. Task: Fix k-means dominant-cluster selection under low light

**Files:** `packages/color-science/src/kmeans.ts` (edit), `packages/color-science/src/testHarness.ts` (add regression tests)

### 1.1 Diagnose properly first
Before changing `scoreResult()`, reproduce the bug with a controlled input, not just live webcam guessing:
- Add a Node-side debug script (or extend `testHarness.ts`) that constructs a synthetic `Lab[]` pixel array simulating the reported case: ~83% pixels clustered near a dull orange (e.g. L≈35, a≈15, b≈25 — "dark brown" territory) and ~17% pixels clustered near a saturated violet (L≈15, a≈40, b≈-45), mimicking a small chromatic-noise/specular patch.
- Confirm `extractDominantColor()` currently picks the violet cluster on this synthetic input. This proves the bug is in `scoreResult()`'s weighting, not something webcam-specific (e.g. white balance, JPEG compression) that would need a different fix.

### 1.2 Fix `scoreResult()`
Current logic in `kmeans.ts`:
```ts
function scoreResult(result: KMeansResult): number {
  // ...
  const chromaAdvantage = dominantChroma - maxOtherChroma;
  let sizeFactor = Math.sqrt(sizeRatio);
  if (sizeRatio < 0.05) sizeFactor *= 0.3;
  if (sizeRatio > 0.80) sizeFactor *= 0.5;
  return chromaAdvantage * sizeFactor;
}
```
The `sizeRatio < 0.05` penalty is too lenient — a 17% cluster still passes through with `sqrt(0.17) ≈ 0.41` as its size factor, and a large-enough chroma advantage from a small saturated patch can still win. Two changes, both conservative (don't rewrite the whole heuristic, adjust the specific failure mode):

1. **Steepen the small-cluster penalty.** Change the penalty band from `< 0.05` to a graduated curve, e.g.:
   ```ts
   let sizeFactor = Math.sqrt(sizeRatio);
   if (sizeRatio < 0.15) sizeFactor *= (sizeRatio / 0.15) * 0.5; // linear ramp-down below 15%
   if (sizeRatio > 0.80) sizeFactor *= 0.5;
   ```
   This makes a 17% cluster barely clear the ramp instead of getting a flat 0.3 floor, and anything under ~10% gets penalized hard.

2. **Add a hue-consistency sanity check** as a second safeguard, since the size penalty alone might not be enough if the violet cluster is *very* saturated. After picking the best-scoring result across the 5 runs, compare the chosen dominant cluster's hue angle (`atan2(b, a)`) against the hue of the single largest cluster by pixel count. If they diverge by more than ~90°, prefer the larger cluster instead — a real object rarely produces two totally different hues in one tap region; a >90° divergence is a strong signal one of them is noise (specular highlight, sensor noise, background bleed), and defaulting to "more pixels agree with the surface" is the safer bet than "punchiest color wins."

   Implement this as a small adjustment inside `extractDominantColor()`, after selecting `bestResult`, not inside `scoreResult()` itself (keeps the two concerns — per-run scoring vs. cross-run sanity check — separate and easier to test independently).

3. Keep both changes behind clearly named, documented constants (`SMALL_CLUSTER_RAMP_THRESHOLD = 0.15`, `HUE_DIVERGENCE_THRESHOLD_DEG = 90`) at the top of the file, matching the existing style of documented "DESIGN DECISION" comments elsewhere in this package.

### 1.3 Regression-test the fix
- Add the synthetic dim-lighting case from 1.2 as a permanent test in `testHarness.ts`, asserting the dominant cluster now matches the large orange-ish cluster, not the violet one.
- Re-run the **existing** red/green/blue test images through `testHarness.ts` and confirm **no regression** — this is the same check Day 3 did after the normalization-factor change, and it's the fastest way to catch an over-correction (e.g. now failing to pick genuinely small-but-correct objects, like a small red berry against a large green leaf background).
- If you have access to real test photos from Day 2/3 testing, re-run the orange-peel and red-apple cases mentioned in the Day 3 status doc and confirm the extracted hue is now at least in the right family (orange/red), even if not perfectly calibrated yet — full brightness/saturation accuracy is still Day 8 scope, today is specifically about not picking the *wrong hue entirely*.

### 1.4 What "done" looks like for this task
- Synthetic dim-lighting regression test passes and is committed.
- Existing red/green/blue regression tests still pass unchanged.
- No changes to `scoreResult()`'s public signature or `KMeansResult`'s shape — this stays an internal algorithm tweak, not a contract change.

---

## 2. Task: White-balance calibration (the actual Day 4 scope from the build plan)

**Files:** new `packages/color-science/src/calibration.ts`, edit `packages/color-science/src/pipeline.ts`, edit `browser.ts` and `index.ts` for exports, add tests to `testHarness.ts`

### 2.1 Build `calibration.ts`
Two pure, browser-portable functions:

```ts
import { RGB } from './types.js';

export interface CalibrationMatrix {
  rScale: number;
  gScale: number;
  bScale: number;
}

/**
 * Estimate a white-balance correction from a photographed white/grey card.
 * Assumes the card should read as pure white (255, 255, 255) under neutral light;
 * any deviation is attributed to a lighting color cast and corrected for.
 *
 * Scale factors are clamped to [1/3, 3] to avoid extreme corrections on a
 * badly-lit or badly-tapped calibration photo (e.g. if the "white card" region
 * accidentally sampled a shadow, don't let that produce a wild overcorrection).
 * Each channel is also floored at 1 before dividing, to avoid divide-by-zero
 * on a pure-black sampled pixel.
 */
export function estimateWhiteBalance(whiteCardRgb: RGB): CalibrationMatrix {
  const clamp = (scale: number) => Math.max(1 / 3, Math.min(3, scale));
  return {
    rScale: clamp(255 / Math.max(1, whiteCardRgb.r)),
    gScale: clamp(255 / Math.max(1, whiteCardRgb.g)),
    bScale: clamp(255 / Math.max(1, whiteCardRgb.b)),
  };
}

/**
 * Apply a calibration matrix to a single RGB pixel. Per-channel scale,
 * clamped to valid 0-255 range after correction.
 */
export function applyCalibration(rgb: RGB, matrix: CalibrationMatrix): RGB {
  const clampChannel = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return {
    r: clampChannel(rgb.r * matrix.rScale),
    g: clampChannel(rgb.g * matrix.gScale),
    b: clampChannel(rgb.b * matrix.bScale),
  };
}
```

**Design note to keep in mind while implementing:** this mirrors the spec in `colorhunt_llm_spec_v2.md` §3.5 exactly, with two additions beyond the spec's sketch — the clamp range (prevents a bad calibration photo from wrecking every subsequent submission for the rest of the session) and the divide-by-zero floor. Both are small, defensible, and worth keeping even though the original spec pseudocode doesn't have them.

### 2.2 Wire calibration into the pipeline — additively, not as a breaking change
Per the Day 3 handoff pattern (confidence.ts was added without touching `extractColorFromCanvas`'s signature), do the same thing here: add calibration as an **optional parameter with a default of `undefined`**, so existing calls from the app (and existing tests) keep working unchanged if calibration hasn't run yet in a session.

In `pipeline.ts`, extend the signature:
```ts
export function extractColorFromCanvas(
  canvas: HTMLCanvasElement,
  tapX: number,
  tapY: number,
  k: number = 3,
  outlierStdDevs: number = 2,
  regionProportion: number = 0.20,
  calibration?: CalibrationMatrix
): ExtractionResult {
  // ... existing steps 1-3 unchanged ...

  // 4. Extract RGB pixels
  let rgbPixels = getPixelsFromRegion(imageData, 0, 0, region.width, region.height);

  // 4.5 Apply calibration BEFORE converting to Lab, if provided
  if (calibration) {
    rgbPixels = rgbPixels.map(rgb => applyCalibration(rgb, calibration));
  }

  // 5. Convert to Lab (unchanged from here)
  const labPixels = rgbPixels.map(rgb => rgbToLab(rgb));
  // ... rest unchanged ...
}
```

**Why apply calibration to raw pixels before Lab conversion, not to the final extracted color after clustering:** white balance is a physical property of the lighting affecting every pixel in the photo, not just the final averaged result. Correcting before clustering means k-means and outlier rejection are working on already-corrected data, which is more consistent with how the calibration is meant to model reality. Applying it only to the final RGB output would be cheaper but would let miscalibrated raw pixels still influence *which* cluster gets picked as dominant.

Also add `calibration?: CalibrationMatrix` handling consistently if you expose a lower-level "extract from a set of pixels" entry point elsewhere — check whether one exists before assuming `extractColorFromCanvas` is the only call site.

### 2.3 Export the new module
Add to both `browser.ts` and `index.ts`:
```ts
export { estimateWhiteBalance, applyCalibration } from './calibration.js';
export type { CalibrationMatrix } from './calibration.js';
```
(`calibration.ts` has no Node-only dependencies, so it belongs in both entry points, same as `confidence.ts`.)

### 2.4 Test calibration
Add to `testHarness.ts`:
- A case with a warm-tinted "white card" reading (e.g. `{r: 255, g: 230, b: 200}`, simulating indoor tungsten lighting) — verify `estimateWhiteBalance` produces `gScale`/`bScale` > 1 and `rScale` ≈ 1, and that applying it to a neutral gray test pixel pulls it back toward neutral.
- A pathological case (e.g. `{r: 10, g: 10, b: 10}`, a badly-lit or mistapped calibration photo) — verify the clamp keeps scale factors at the 3x ceiling rather than exploding.
- A regression check: run the existing red/green/blue test images through `extractColorFromCanvas` **without** passing a `calibration` argument, confirm results are byte-for-byte identical to Day 3's baseline. This is the concrete proof that today's change is additive and hasn't silently altered default behavior.

### 2.5 What "done" looks like for this task
- `calibration.ts` exists, exported from both entry points.
- `extractColorFromCanvas` accepts optional calibration, defaults to today's behavior when omitted.
- New tests pass; old tests are unaffected.
- `ExtractionResult`'s shape is unchanged (calibration doesn't need to appear in the return value — the caller already has the matrix, since they passed it in).

---

## 3. Joint task: coordinate the contract for your partner's calibration UI and results screen

You are **not** building the "photograph a white surface" screen or the results-screen calibration display today — that's your partner's Day 4 scope. Your job here is just to make sure the contract between your code and theirs is unambiguous, since this is the first day the two tracks merge on this specific feature.

Give your partner (or leave as a comment/doc note in the repo) this exact usage pattern so their UI code calls your functions correctly:

```ts
// Once, at the start of a session, after the user photographs a white/grey card:
const whiteCardRegion = extractColorFromCanvas(calibrationCanvas, tapX, tapY); // no calibration arg — this IS the calibration source
const calibrationMatrix = estimateWhiteBalance(whiteCardRegion.extractedRgb);
// Store calibrationMatrix in game state (GameStateContext) for the rest of the session.

// On every subsequent submission:
const result = extractColorFromCanvas(canvas, tapX, tapY, 3, 2, 0.20, calibrationMatrix);
```

Also flag explicitly: **confidence scoring (`calculateConfidence`) is separate from calibration and doesn't need the calibration matrix** — it should be called on `result.extractedRgb` and the sampled pixels regardless of whether calibration ran. Your partner's results screen needs both pieces of data (extraction result + confidence result), but they're independent function calls, not chained.

If your partner's results screen needs a combined convenience function (extraction + confidence in one call) to keep their component code simpler, that's a reasonable addition — but treat it as *their* file to add (e.g. a small wrapper in `src/lib/` or inline in `ResultsScreen.tsx`), not something to add to `packages/color-science/`, which should stay UI-agnostic.

---

## 4. End-of-day checklist

- [ ] Synthetic dim-lighting k-means regression test added and passing (§1.3)
- [ ] Existing red/green/blue regression tests still pass, confirmed by rerunning `testHarness.ts` (§1.3, §2.4)
- [ ] `calibration.ts` created, exported from `browser.ts` and `index.ts` (§2.1, §2.3)
- [ ] `extractColorFromCanvas` accepts optional `calibration` param, default behavior unchanged when omitted (§2.2, §2.4)
- [ ] `npm run build` — TypeScript compiles clean
- [ ] `npm run lint` — no new warnings introduced
- [ ] If real test photos are available, spot-check the orange-peel/red-apple cases from Day 3 to confirm the hue-family fix helps in practice, not just on synthetic data
- [ ] Write a short end-of-day status note (same format as `Day3_Status_For_Partner.md`) covering: what changed, what's still open (e.g. calibration is estimation-only — it hasn't been tested against real varied lighting yet, that's implicitly Day 8 territory too), and any new decision your partner needs to weigh in on before Day 5

**Do not start on Day 5 scope** (bonus voting logic, stress-testing against real photos in varied lighting) unless everything above is done with time to spare — per the build plan, Day 5 is the pass-and-play milestone checkpoint and needs both tracks arriving with working code.

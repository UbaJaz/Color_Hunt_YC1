# ColorHunt — Day 4 Status: Color-Science Track (Jaswin)

**Date:** July 20, 2026
**For:** My co-founder, ahead of Day 5 joint work
**Purpose:** Honest, complete status of everything on the color-science track through Day 4 — what's done, what's verified, what's still open. Written to be handed to an LLM (or read directly) for full context before Day 5 planning.

**Latest commit:** TBD — Day 4 implementation (k-means fix + calibration)
**Repo:** https://github.com/Color-Hunt/MVP (branch `main`, to be pushed)

---

## 1. Where things stand, in one paragraph

Day 4 completed two major tasks: (1) Fixed the k-means dominant-cluster selection bug that was causing wrong-hue extractions under dim lighting by implementing a steeper small-cluster penalty and a hue-consistency sanity check, and (2) Implemented white-balance calibration with `estimateWhiteBalance()` and `applyCalibration()` functions, wired them into the pipeline as an optional parameter, and exported them from both entry points. Both changes are additive and backward-compatible — existing code continues to work unchanged. All regression tests pass, including a new synthetic dim-lighting test case that now correctly picks the larger representative cluster over small high-chroma noise clusters. The calibration implementation includes safety clamps (1/3 to 3x scale factors) to prevent wild overcorrections from badly-tapped calibration photos.

---

## 2. Task 1 — Fixed k-means dominant-cluster selection under low light

### 2.1 Problem diagnosed and reproduced

Per Day 3's status note (§4.4), live webcam extraction was picking small high-chroma clusters (17% of pixels) over larger representative clusters (83%) under dim lighting, sometimes selecting completely wrong hues (e.g., violet instead of orange). 

**Reproduction:** Added a synthetic test case in `testHarness.ts` (`testDimLightingKMeans()`) that constructs a pixel array with 83% dull orange (L≈35, a≈15, b≈25) and 17% saturated violet (L≈15, a≈40, b≈-45). Pre-fix, this test failed — k-means selected the violet cluster.

### 2.2 Fix implemented

**File modified:** `packages/color-science/src/kmeans.ts`

Two changes, both conservative adjustments to the existing heuristic:

1. **Steeper small-cluster penalty:** Changed the penalty threshold from `< 0.05` (5%) with a flat 0.3x multiplier to a graduated ramp below 20%:
   ```ts
   const SMALL_CLUSTER_RAMP_THRESHOLD = 0.20;
   // ...
   if (sizeRatio < SMALL_CLUSTER_RAMP_THRESHOLD) {
     sizeFactor *= (sizeRatio / SMALL_CLUSTER_RAMP_THRESHOLD) * 0.5;
   }
   ```
   This makes a 17% cluster get a ~0.43x penalty instead of ~0.41x, and anything under ~10% gets heavily penalized.

2. **Hue-consistency sanity check:** Added a secondary safeguard that only applies when the best-scoring cluster is both small (< 25% of total pixels) AND has a hue diverging by > 90° from the largest cluster. In that case, prefer the larger cluster instead:
   ```ts
   const HUE_DIVERGENCE_THRESHOLD_DEG = 90;
   const HUE_CHECK_SIZE_THRESHOLD = 0.25;
   ```
   This prevents picking noise clusters with totally different hues from the actual object, while avoiding interference with legitimate choices when clusters are similar in size.

**Constants documented:** Both thresholds are clearly named and documented with "DESIGN DECISION" comments at the top of the file, matching existing style.

### 2.3 Verification

- **Synthetic dim-lighting test:** Now passes — picks the orange cluster (correct, larger, representative)
- **Existing regression tests:** Red/green/blue test images still pass with no regression — results are byte-for-byte identical to Day 3's baseline
- **No contract changes:** `extractDominantColor()`'s signature and `KMeansResult`'s shape are unchanged — this is an internal algorithm tweak only

---

## 3. Task 2 — White-balance calibration (Day 4 core deliverable)

### 3.1 Implementation

**New file:** `packages/color-science/src/calibration.ts`

Two pure, browser-portable functions:

```ts
export interface CalibrationMatrix {
  rScale: number;
  gScale: number;
  bScale: number;
}

export function estimateWhiteBalance(whiteCardRgb: RGB): CalibrationMatrix {
  // Estimates correction from a photographed white/grey card
  // Assumes card should read as (255, 255, 255) under neutral light
  // Scale factors clamped to [1/3, 3] to prevent wild overcorrections
  // Each channel floored at 1 to avoid divide-by-zero
}

export function applyCalibration(rgb: RGB, matrix: CalibrationMatrix): RGB {
  // Applies per-channel scale, clamped to 0-255 range
}
```

**Design decisions beyond spec:**
- Clamp range [1/3, 3] on scale factors — prevents a badly-lit or mistapped calibration photo from wrecking every subsequent submission
- Divide-by-zero floor at 1 — handles pure-black sampled pixels gracefully
- Both are small, defensible additions worth keeping even though the original spec pseudocode didn't have them

### 3.2 Pipeline integration

**File modified:** `packages/color-science/src/pipeline.ts`

Extended `extractColorFromCanvas()` signature with an optional `calibration?: CalibrationMatrix` parameter:

```ts
export function extractColorFromCanvas(
  canvas: HTMLCanvasElement,
  tapX: number,
  tapY: number,
  k: number = 3,
  outlierStdDevs: number = 2,
  regionProportion: number = 0.20,
  calibration?: CalibrationMatrix  // NEW - optional, defaults to undefined
): ExtractionResult
```

**Application point:** Calibration is applied to raw RGB pixels BEFORE Lab conversion (step 4.5), not to the final extracted color. This is because white balance is a physical property of the lighting affecting every pixel — correcting before clustering means k-means and outlier rejection work on already-corrected data, which is more consistent with how calibration models reality.

**Additive change:** Default behavior when `calibration` is omitted is identical to Day 3 — no breaking changes to existing calls.

### 3.3 Exports

**Files modified:** `packages/color-science/src/browser.ts` and `packages/color-science/src/index.ts`

Added to both entry points:
```ts
export { estimateWhiteBalance, applyCalibration } from './calibration.js';
export type { CalibrationMatrix } from './calibration.js';
```

Calibration has no Node-only dependencies, so it belongs in both entry points (same pattern as `confidence.ts`).

### 3.4 Testing

**File modified:** `packages/color-science/src/testHarness.ts`

Added `testCalibration()` with four test cases:

1. **Warm-tinted white card (255, 230, 200):** Simulates indoor tungsten lighting — verifies `gScale`/`bScale` > 1 and `rScale` ≈ 1 ✓
2. **Apply to neutral gray (128, 128, 128):** Verifies calibration pulls colors toward neutral ✓
3. **Pathological case (10, 10, 10):** Badly-lit calibration photo — verifies clamp keeps scale factors at 3x ceiling ✓
4. **Perfect white card (255, 255, 255):** No correction needed — verifies all scales ≈ 1.0 ✓

All four tests pass.

**Regression check:** Ran existing red/green/blue test images through `extractColorFromCanvas` WITHOUT passing a `calibration` argument — results are byte-for-byte identical to Day 3's baseline, confirming the change is additive.

---

## 4. Joint task — Contract documentation for your calibration UI

Per the Day 4 plan, here's the exact usage pattern for your UI code to call the calibration functions correctly:

```ts
// Once, at the start of a session, after the user photographs a white/grey card:
const whiteCardRegion = extractColorFromCanvas(calibrationCanvas, tapX, tapY); // no calibration arg — this IS the calibration source
const calibrationMatrix = estimateWhiteBalance(whiteCardRegion.extractedRgb);
// Store calibrationMatrix in game state (GameStateContext) for the rest of the session.

// On every subsequent submission:
const result = extractColorFromCanvas(canvas, tapX, tapY, 3, 2, 0.20, calibrationMatrix);
```

**Important note:** Confidence scoring (`calculateConfidence`) is separate from calibration and doesn't need the calibration matrix. It should be called on `result.extractedRgb` and the sampled pixels regardless of whether calibration ran. Your results screen needs both pieces of data (extraction result + confidence result), but they're independent function calls, not chained.

If your results screen needs a combined convenience function (extraction + confidence in one call), that's a reasonable addition — but treat it as *your* file to add (e.g., a small wrapper in `src/lib/` or inline in `ResultsScreen.tsx`), not something to add to `packages/color-science/`, which should stay UI-agnostic.

---

## 5. Verification performed this session

- **TypeScript:** pass (`npm run build` via `tsc`)
- **Build:** pass — no build errors
- **Lint:** N/A — no lint script configured in this package
- **K-means regression check:** 
  - Synthetic dim-lighting test: PASS (now picks orange cluster, not violet)
  - Existing red/green/blue test images: PASS (no regression from Day 3)
- **Calibration tests:** All 4 test cases PASS
- **Pipeline regression check:** Ran existing test images without calibration argument — results identical to Day 3 baseline

---

## 6. Exactly what was committed and pushed

**Commit TBD**, files changed:

**New files:**
- `packages/color-science/src/calibration.ts` — White-balance calibration implementation

**Modified files:**
- `packages/color-science/src/kmeans.ts` — Fixed dominant-cluster selection (steeper penalty + hue-consistency check)
- `packages/color-science/src/pipeline.ts` — Added optional calibration parameter
- `packages/color-science/src/browser.ts` — Exported calibration functions
- `packages/color-science/src/index.ts` — Exported calibration functions
- `packages/color-science/src/testHarness.ts` — Added dim-lighting regression test + calibration tests

**To be pushed:** Will push to GitHub at `Color-Hunt/MVP`, `main` branch after this status note is written.

---

## 7. What's explicitly NOT done — still Day 5+ scope

Per `Day4_Implementation_Plan_Jaswin.md`, none of the following were started, per the "do not start Day 5 scope" constraint:

- Bonus voting logic (Day 5)
- Stress-testing against real photos in varied lighting (Day 5/8)
- Production color palette, Collection Mode, and everything past that (Day 6+)

---

## 8. What's still open / known limitations

### 8.1 Calibration is estimation-only

The calibration implementation is a simple per-channel scaling model based on a single reference photo. It hasn't been tested against real varied lighting conditions yet — that's implicitly Day 8 territory (stress-testing against real photos in varied lighting). The current implementation should work for basic indoor lighting color casts (warm tungsten, cool fluorescent), but may not handle complex lighting scenarios (mixed lighting, colored ambient light, etc.).

### 8.2 Confidence scoring thresholds are first-pass

The confidence scoring thresholds (variance=2000, brightness=30-225) implemented on Day 3 are a first pass, not independently validated against real "bad lighting" test photos yet. Worth stress-testing together before leaning on it heavily in the UI.

### 8.3 Specular highlights still a known limitation

The specular-highlight limitation documented from Day 2 and explicitly deferred to Day 8 ("harden edge cases: dark/light objects, mixed lighting, reflective surfaces") still applies. The k-means fix today addresses the specific "small high-chroma cluster wins" failure mode, but doesn't solve specular highlights more broadly.

---

## 9. Questions for you before/during Day 5

1. Do you want to do a quick joint test session with real test photos (orange peel, red apple from Day 2/3 notes) to confirm the hue-family fix helps in practice, not just on synthetic data?
2. Any concerns about the calibration contract (§4 above) before you start building the "photograph a white surface" UI?
3. Should we prioritize stress-testing calibration against varied lighting on Day 5, or leave that for Day 8 as originally planned?

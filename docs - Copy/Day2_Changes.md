# Day 2 Changes - ColorHunt

## New Files Created

### Core Modules
1. **src/canvasPixels.ts** - Browser pixel extraction from Canvas ImageData
   - `getPixelsFromImageData(imageData: ImageData): RGB[]` - Extract all RGB pixels
   - `getPixelsFromRegion(imageData, x, y, width, height): RGB[]` - Extract region pixels
   - Pure functions, browser portable

2. **src/regionSelection.ts** - Tap-to-region selection logic
   - `Region` interface: `{ x, y, width, height }`
   - `selectRegion(tapX, tapY, imgWidth, imgHeight, proportion = 0.20): Region`
   - Proportional region size (20% of min dimension)
   - Edge clipping to prevent out-of-bounds

3. **src/pipeline.ts** - High-level pipeline function
   - `ExtractionResult` interface
   - `extractColorFromCanvas(canvas, tapX, tapY, k, outlierStdDevs, regionProportion): ExtractionResult`
   - Full pipeline: region → pixels → Lab → k-means → outliers → RGB

4. **src/browser.ts** - Browser-only entry point
   - Thin re-export/entrypoint only
   - Excludes Node-specific dependencies (e.g., `sharp`)
   - **Audit Result:** Verified as re-export only, no duplicated logic.

### Browser Test
5. **browser-test/index.html** - Standalone browser test page
   - No build step, no bundler, no React
   - Canvas display with click-to-extract
   - Results display with swatch, RGB/Lab values, scores
   - Performance timing via console.time

6. **browser-test/automated-test.mjs** - Playwright automated test
   - Reproducible browser pipeline validation
   - Measures wall-clock vs. pipeline execution time

7. **browser-test/test-images/** - Test images folder
   - real-red.jpeg (278,495 bytes)
   - real-green.jpeg (239,639 bytes)
   - real-blue.jpeg (125,901 bytes)

## Files Modified

### Configuration
1. **tsconfig.json**
   - Added "DOM" to lib array for canvas API support
   - Line 5: `"lib": ["ES2020", "DOM"]`

2. **src/index.ts**
   - Added Day 2 exports (maintained for Node compatibility)

## Design Decisions

### Authoritative Source of Truth: Tap-Region/Browser Pipeline
- **AUTHORITATIVE:** The **tap-region/browser pipeline** is the source of truth for accuracy and scoring, as it reflects the actual game mechanic.
- **REGRESSION ONLY:** The whole-image Node test (`testHarness.ts`) is a math/regression sanity check only and is not a realistic accuracy benchmark for the final app.

### Region Proportion: 20%
- Chosen to balance cluster stability vs object containment
- ~200-400px regions on typical phone photos
- Parameterized for tuning

### Outlier Rejection on Dominant Cluster Only
- Critical fix from Day 1 audit
- Only pass dominant cluster pixels to `rejectOutliers()`
- Implemented in both testHarness.ts and pipeline.ts

## Performance & Timing

### Timing Distinction (CRITICAL)
- **Pipeline Execution Time:** **216.7ms – 345.5ms** (Measured via `console.time('pipeline')` in browser).
- **Wall-clock Time:** ~2200ms – 2400ms (Includes Playwright overhead: page navigation, click event dispatch, DOM update waiting).
- **Status:** **PASS** (Under 500ms requirement).

## Investigation: Low Green Score (11.7/100)
- **Finding:** Clicking the center of `real-green.jpeg` consistently yields a low score.
- **Analysis:** The green pouch has a strong specular highlight (sheen) and gradient. Center clicks land on a desaturated highlight area (`L=61.69, a=-35.92, b=2.99`), whereas the target SeaGreen is more saturated.
- **Offset Tests:** Clicking slightly off-center (offsets) often missed the object or hit even more extreme highlights (`L=89.83, a=-27.97, b=77.79`), yielding 0/100 scores.
- **Conclusion:** This is a **lighting/highlight problem** and a **target-match discrepancy** (the pouch is not a perfect SeaGreen). This is flagged for Day 8 "harden edge cases" work to handle specular highlights.

## Summary

**Day 2 Status:** **COMPLETE & VERIFIED**
- Circular validation fixed (Targets: Crimson, SeaGreen, RoyalBlue).
- Pipeline timing verified under 500ms.
- Browser portability resolved via `src/browser.ts`.
- Source of truth and timing distinctions explicitly documented.

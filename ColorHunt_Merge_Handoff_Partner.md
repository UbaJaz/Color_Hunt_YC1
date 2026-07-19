# ColorHunt — Day 1-2 Merge Handoff (Jaswin → Partner)

**Date:** July 18, 2026
**Repo:** https://github.com/Color-Hunt/MVP
**Commit:** `49cb7a9` — `feat: add color-science module (Day 1-2)`

---

## What changed

Your React app structure is **completely untouched**. All your files (`src/`, `public/`, `index.html`, `vite.config.ts`, etc.) remain exactly as you left them.

The color science module lives in a **new sub-package** at `packages/color-science/` — a self-contained Node/TypeScript project that builds independently.

---

## New repo structure

```
Color-Hunt/MVP/
├── public/                  ← your static assets (untouched)
├── src/                     ← your React components (untouched)
│   ├── components/
│   ├── screens/
│   ├── hooks/
│   └── ...
├── index.html               ← your Vite entry point (untouched)
├── vite.config.ts           ← your Vite config (untouched)
├── package.json             ← your app deps (untouched)
├── tsconfig.json            ← your tsconfig (untouched)
│
├── packages/color-science/  ← NEW: Jaswin's color science module
│   ├── src/
│   │   ├── kmeans.ts              # K-means dominant color extraction (Lab space, chroma-based, stabilized)
│   │   ├── outlierRejection.ts    # 2-std-dev outlier filter in Lab space
│   │   ├── colorConversion.ts     # RGB ↔ Lab (sRGB → XYZ D65 → Lab)
│   │   ├── ciede2000.ts          # CIEDE2000 color difference + score normalization (factor 15)
│   │   ├── canvasPixels.ts        # Browser pixel extraction from Canvas ImageData
│   │   ├── regionSelection.ts     # Tap-to-region math (proportional, edge-clipped)
│   │   ├── pipeline.ts            # Composed: extractColorFromCanvas() ← your main entry point
│   │   ├── browser.ts             # Browser-specific helpers
│   │   ├── imageLoader.ts         # Node-only sharp-based loading (test harness only)
│   │   ├── testHarness.ts         # Node test runner (not used in app)
│   │   ├── types.ts               # RGB, Lab, XYZ, KMeansResult, Region, ExtractionResult
│   │   └── index.ts               # Public exports
│   ├── dist/                        # Compiled JS output (run `npm run build` to regenerate)
│   ├── browser-test/                # Standalone HTML test page (no React, no bundler)
│   ├── test-images/                 # Day 1 test photos (red bag, green wallet, blue stapler)
│   ├── package.json               # Module name: `@color-hunt/color-science`
│   └── tsconfig.json              # Independent TS config
│
├── Day2_Changes.md          ← NEW: detailed changelog of Day 2 work
├── HANDOFF.md               ← NEW: one-page API reference for you
└── .gitignore                 ← MODIFIED: ignores `packages/color-science/dist/` and `*.onetoc2`
```

---

## How to import the color science module in your React app

### Option 1: Relative path (works now, no config changes)

```typescript
// In any of your React components, e.g., src/screens/CameraScreen.tsx
import { 
  extractColorFromCanvas,
  selectRegion,
  rgbToLab,
  deltaE2000,
  deltaEToScore,
  type ExtractionResult,
  type Region
} from '../../packages/color-science/dist/index.js';
```

### Option 2: Path alias (cleaner, recommended)

Add to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@color-science': path.resolve(__dirname, './packages/color-science/dist/index.js'),
    },
  },
});
```

Then import anywhere:
```typescript
import { extractColorFromCanvas } from '@color-science';
```

**Note:** The module is pre-built to `packages/color-science/dist/`. If Jaswin changes the source, he must run `npm run build` inside `packages/color-science/` to regenerate `dist/` before your app sees the changes.

---

## Key API: `extractColorFromCanvas()`

This is the single function you call from your React UI when the user taps a photo.

```typescript
function extractColorFromCanvas(
  canvas: HTMLCanvasElement,   // the canvas displaying the captured photo
  tapX: number,                // click/tap X coordinate (canvas pixel space)
  tapY: number,                // click/tap Y coordinate (canvas pixel space)
  k?: number,                  // k-means clusters (default: 3)
  outlierStdDevs?: number,     // std dev threshold (default: 2)
  regionProportion?: number    // sampling region as % of min dimension (default: 0.20)
): ExtractionResult

interface ExtractionResult {
  extractedRgb: RGB;           // { r, g, b } — the final color
  extractedLab: Lab;           // { L, a, b } — for debugging/scoring
  dominantClusterSize: number; // how many pixels were in the dominant cluster
  totalPixelsSampled: number;  // total pixels in the sampled region
  region: Region;              // { x, y, width, height } — draw this rectangle on canvas
}
```

### Usage example in your React component

```typescript
import { useRef, useCallback } from 'react';
import { extractColorFromCanvas, rgbToLab, deltaE2000, deltaEToScore } from '@color-science';

function CameraScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetColor = { r: 237, g: 76, b: 77 }; // example: Crimson Red

  const handleTap = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const tapX = (e.clientX - rect.left) * scaleX;
    const tapY = (e.clientY - rect.top) * scaleY;

    // Run the pipeline
    const result = extractColorFromCanvas(canvas, tapX, tapY);

    // Draw selection rectangle (using result.region)
    const ctx = canvas.getContext('2d');
    ctx?.strokeRect(result.region.x, result.region.y, result.region.width, result.region.height);

    // Score against target
    const targetLab = rgbToLab(targetColor);
    const deltaE = deltaE2000(result.extractedLab, targetLab);
    const score = deltaEToScore(deltaE, 15); // 0-100

    console.log('Extracted:', result.extractedRgb);
    console.log('Delta E:', deltaE.toFixed(2));
    console.log('Score:', score.toFixed(1));
  }, []);

  return <canvas ref={canvasRef} onClick={handleTap} />;
}
```

---

## What works now

- **Node pipeline:** `cd packages/color-science && npm test` — runs synthetic + real image tests
- **Browser test page:** `cd packages/color-science && npx serve browser-test/` — click image, see extracted color + score
- **Deterministic extraction:** Same photo → same color every time (no randomness)
- **Scoring normalization:** Factor 15 (Delta E 0 = 100pts, Delta E 15 = 0pts)

## Known limitations (Day 3/4 scope)

- **No confidence scoring** — can't yet detect poor lighting / blurry photos
- **No white-balance correction** — assumes D65 daylight; indoor lighting shifts colors
- **No pixel downsampling** — k-means on full-res regions may be slow on old phones (benchmark: ~200-400ms on laptop)
- **Color taxonomy is basic** — target palette needs expansion beyond the 3 test colors

---

## If you need to rebuild the module

```bash
cd packages/color-science
npm run build   # compiles src/ → dist/
```

## If the import path breaks

The compiled output is at `packages/color-science/dist/index.js`. If Vite can't resolve the alias, fall back to the relative path:
```typescript
import { extractColorFromCanvas } from '../../packages/color-science/dist/index.js';
```

---

## Questions?

Ping Jaswin. The `HANDOFF.md` at repo root has the one-page API reference. The `Day2_Changes.md` has detailed technical notes on design decisions, performance timing, and the green wallet color investigation.

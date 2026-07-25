# ColorHunt Color Science Handoff

This document provides the necessary information for integrating the color science core into the React UI.

## Integration Point

The primary function for the browser-based color extraction is `extractColorFromCanvas`.

### Function Signature
```typescript
extractColorFromCanvas(
  canvas: HTMLCanvasElement,
  tapX: number,
  tapY: number,
  k: number = 3,
  outlierStdDevs: number = 2,
  regionProportion: number = 0.20
): ExtractionResult
```

### Return Shape (`ExtractionResult`)
```typescript
{
  extractedRgb: { r: number, g: number, b: number };
  extractedLab: { L: number, a: number, b: number };
  dominantClusterSize: number;
  totalPixelsSampled: number;
  region: { x: number, y: number, width: number, height: number };
}
```

### Usage Example
```typescript
import { extractColorFromCanvas } from './dist/browser.js';

const result = extractColorFromCanvas(canvasElement, tapX, tapY);

// Use result.region to draw the selection rectangle on your UI
// Use result.extractedRgb for color matching/scoring
```

## Import Path (Browser)
**Use `dist/browser.js`** instead of `dist/index.js`.
*Reason:* `dist/browser.js` excludes the Node-only `sharp` dependency used for server-side image loading, preventing module resolution errors in the browser.

## Current Status & Scope
*   **Authoritative Truth:** The tap-region/browser pipeline is the source of truth for accuracy.
*   **Out of Scope (Day 3+):** White-balance calibration, lighting-quality scoring, and the final production color palette are not yet implemented.
*   **Known Limitation:** Extraction accuracy depends on tap location and lighting; this hasn't been hardened yet (Day 8), so expect inconsistent scores on photos with strong highlights or shadows during early UI testing.

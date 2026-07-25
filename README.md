# ColorHunt

ColorHunt is a real-time color-matching game for groups of friends playing on a single device (pass-and-play). Players take turns pointing their phone camera at a real-world object and trying to match a randomly chosen target color. The game scores each attempt using perceptually accurate color science (CIELAB + CIEDE2000), assigns rarity tiers to extracted colors, and tracks results across rounds.

---

## Current verified state

Verified on 2026-07-25 against the `packages/color-science` track.

**Phase A — Static analysis:** `tsc --noEmit` and `oxlint` both exit zero. 0 type errors, 0 lint warnings across 17 source files.

**Phase D — Test suite:** All sections pass (fresh `tsc` build followed by `node dist/testHarness.js`). The harness has no single aggregate counter — each section reports its own count: `bonusVoting` 5/5, `rarityTierClassification` 16/16, `unlockLogic` 8/8, `confidenceDiagnostics` 6/6 (includes the new specular-highlight regression test). All other listed checks below also pass per raw harness output.

Test coverage includes:
- Synthetic CIEDE2000 color matching (5 objects × 10 targets)
- Dim-lighting k-means bug regression (83% dull / 17% saturated)
- Same-hue size-penalty isolation
- Red-berry / green-leaf foreground isolation regression
- `calculateSizeFactor` unit test with graduated ramp verification
- White-balance calibration (4 cases)
- Bonus voting multiplier (5 cases)
- Low-chroma dark object extraction (lightness significance)
- Lighting stress scenarios (5 scenarios)
- Rarity tier classification (16 reference colors)
- Successful unlock gate logic (8 cases)
- Confidence diagnostics with object-aware dark/light detection — **including specular highlight overwrite guard** (6 cases)
- Real-image pipeline: 3 × 1920 × 1000 px JPEG inputs (real-red, real-green, real-blue)

**Phase E — Perf sanity:** Full harness (including 3 real 1920 × 1000 px images) completes in **226 ms** on a dev machine. Acceptable for development; real mid-range device benchmarking is deferred (see Deferred Work below).

---

## Architecture split

### `packages/color-science/` — Jaswin's track

Isolated TypeScript sub-package. Pure functions, no React, no DOM, browser-portable (the browser entry point excludes the Node-only `sharp` dependency used in tests).

Key modules:
| File | Responsibility |
|---|---|
| `kmeans.ts` | CIELAB k-means (k=3), size-weighted scoring, hue-merge, specular penalty |
| `ciede2000.ts` | CIEDE2000 ΔE and score conversion |
| `confidence.ts` | sRGB-space lighting quality assessment with dark/light object disambiguation |
| `rarity.ts` | Lab-space rarity tier classification + unlock gate |
| `calibration.ts` | White-balance estimation and application |
| `bonusVoting.ts` | Community voting score multiplier |
| `colorConversion.ts` | sRGB ↔ CIELAB |
| `outlierRejection.ts` | 2-σ outlier removal within dominant cluster |
| `imageLoader.ts` | Node-side sharp loader (test/dev only) |
| `browser.ts` | Browser entry — re-exports all public API except `imageLoader` |
| `types.ts` | Shared `RGB`, `Lab`, `Region` types |

See `packages/color-science/HANDOFF.md` for the full public API.

### `src/` — Partner's track (UI / game-flow)

```
src/
├── App.tsx                    — top-level shell, screen state machine
├── screens/
│   ├── CaptureScreen.tsx      — camera → capture → tap-to-select → confirm, owns the canvas ref
│   └── ResultsScreen.tsx      — swatch comparison, score, Delta E
├── components/
│   ├── camera/
│   │   ├── CameraView.tsx         — live feed + permission states
│   │   ├── CaptureButton.tsx      — dumb capture trigger
│   │   ├── PhotoPreview.tsx       — captured photo, tap-to-select, retake/confirm
│   │   ├── TapRegionOverlay.tsx   — crosshair + sample-region rectangle
│   │   └── TargetColorBanner.tsx  — round's target color, overlaid on the camera view
│   └── ui/
│       └── ColorSwatch.tsx    — colored square + label
├── hooks/
│   ├── useCamera.ts           — getUserMedia lifecycle + permission state machine
│   └── useTapSelection.ts     — tap → region selection (delegates sizing to @color-science)
├── state/
│   └── GameStateContext.tsx   — players, rounds, target colors (local React state)
├── data/
│   └── targetColors.ts        — placeholder 20-color target library (real palette is Day 6 scope)
├── types/                     — RGB/Region re-exported from @color-science, plus app-only types
└── utils/
    └── imageCoordinates.ts    — click-to-natural-pixel mapping for object-fit: cover
```

### How the app talks to `@color-science`

`vite.config.ts` aliases `@color-science` to `packages/color-science/dist/browser.js`. `tsconfig.app.json` mirrors that with a matching `paths` entry so type-checking resolves the same way. `CaptureScreen.tsx` calls `extractColorFromCanvas()`, `rgbToLab()`, `deltaE2000()`, and `deltaEToScore()` directly from that import — the app does not reimplement any of this math.

---

## Known limitations

### Rarity classification (chroma-only gap)
Lab chroma alone cannot separate "vivid primary" (spec: Common) from "fluorescent/metallic" (spec: Rare). A pure sRGB red has C\*≈105 and blue has C\*≈134 — both higher than Fluorescent Pink (C\*≈85) or Metallic Gold (C\*≈63). The current `chroma >= 65` rare threshold therefore tags ordinary saturated primaries as Rare rather than Common. Fixing this requires a named-hue / gamut-distance check or real capture calibration — flagged for Day 9/10 work, not guessed at here.

### Rarity thresholds unverified against player data
The Day 8 threshold pass updated 5 boundary values without a cross-test sweep against the old thresholds. The Metallic Gold reference color flips from `rare` (old) to `common` (new). These values need A/B testing against real player captures before they are locked.

### specular_highlight → valid_light_object overwrite (fixed Day 9)
Previously, a glossy specular highlight (high brightness, low chroma, high pixel variance) was correctly detected as `specular_highlight` but then silently overwritten to `valid_light_object` by an unchained `if (brightness > maxBrightness)` block. Fixed in Day 9 by guarding both brightness blocks with `diagnostic === 'good'`. Test added: `Specular highlight (overwrite guard)` in `testConfidenceDiagnostics`. Now 26/26 PASS.

### iOS Safari camera — real-device walkthrough not yet done
`getUserMedia` camera permission + capture flow has been coded defensively (see iOS Safari notes below) but has NOT been manually tested on a physical iPhone in Safari. This is the single biggest unverified risk on the platform.

---

## Setup and run

```bash
# Install all workspace dependencies (root + packages/color-science)
npm install

# Start dev server (also builds packages/color-science first)
npm run dev

# Run color science tests only
npm test --prefix packages/color-science

# Build for production
npm run build
```

`npm run dev` and `npm run build` both build `packages/color-science` first (via the `build:color-science` script), so a fresh clone works with no extra manual steps. If you edit anything under `packages/color-science/src`, re-run `npm run build:color-science` (or just `npm run dev`/`npm run build` again) to pick up the change — the app imports the package's compiled output, not its TypeScript source.

---

## Deferred / future work

The following items were intentionally deferred and are not silently dropped:

- **Real mid-range phone perf testing** — full harness runs in 226 ms on a dev machine; the same pipeline running in-browser on a mid-range Android or iPhone has not been benchmarked. Camera frames are smaller than the 1920 × 1000 px test images, so this is expected to be fast, but unverified.
- **Cross-device / cross-lighting condition testing** — synthetic and 3-JPEG test data only. No testing across different ambient light conditions, phone cameras, or capture distances yet.
- **5+ person friend testing session** — no live player testing done. The rarity and scoring thresholds are calibrated from lab data only.
- **White-balance calibration UI (Day 6, never shipped)** — `estimateWhiteBalance()` and `applyCalibration()` are implemented and tested in isolation but the UI to trigger calibration was deferred and is not wired up in `CaptureScreen.tsx`.
- **Audio feedback** — not implemented.
- **iOS `navigator.vibrate()` non-functional workaround** — vibrate is not supported in Safari/iOS. No fallback currently implemented.
- **Rarity chroma-only separation** — see Known Limitations above.

---

## iOS Safari notes

- `playsInline`, `muted`, `autoPlay` are set on the `<video>` element, and `.play()` is also called explicitly in `useCamera` — iOS Safari does not reliably autoplay a live stream from attributes alone.
- Rear camera is requested via `facingMode: { ideal: "environment" }` (not a hard constraint) so devices without an exact match don't throw `OverconstrainedError`.
- `getUserMedia` requires HTTPS in production (Vercel provides this by default) or `localhost` for local dev.
- Test both Safari-in-browser and "Added to Home Screen" PWA mode — permission behavior can differ between the two. **This real-device walkthrough has not yet been completed.**

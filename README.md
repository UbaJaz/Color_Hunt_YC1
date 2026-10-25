# ColorHunt

ColorHunt is a real-time color-matching game for groups of friends playing on a single device (pass-and-play). Players take turns pointing their phone camera at a real-world object and trying to match a randomly chosen target color. The game scores each attempt using perceptually accurate color science (CIELAB + CIEDE2000), assigns rarity tiers to extracted colors, and tracks results across rounds.

---

## How to play

1. **Lobby:** add the players on one phone.
2. **Calibration:** a quick white-balance step for the room's lighting.
3. **Capture:** each round has a random target colour. On your turn, point the camera at a real object you think matches and capture it (you can retake).
4. **Results:** the game extracts the object's colour, scores the match with CIEDE2000 and assigns a rarity tier. Pass the phone on.
5. **Voting:** once everyone has played, players vote for bonus points.
6. **Leaderboard:** scores add up across rounds.

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

### Color extraction under glare
Color extraction on glossy/reflective real-world objects can be skewed by specular highlights covering a large portion of the tapped region — confirmed via debug telemetry showing raw sampled average diverging sharply from the extracted color when the dominant k-means cluster is itself a highlight rather than the object's base color. Mitigated for now by capturing on matte surfaces / avoiding direct glare on the tapped spot. Proper fix (e.g. highlight-aware region re-sampling) is out of scope before submission.

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

---

The full test and verification log is in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## License

MIT, see [LICENSE](LICENSE).

# ColorHunt

Pass-and-play color-matching party game. React + Vite PWA, no backend.

The color science (k-means dominant-color extraction, outlier rejection,
Lab conversion, CIEDE2000 scoring) lives in an isolated sub-package at
`packages/color-science/` — see that folder's `HANDOFF.md` for its API.

## Run locally

```
npm install
npm run dev
```

`npm run dev` and `npm run build` both build `packages/color-science` first
(via the `build:color-science` script), so a fresh clone works with no
extra manual steps. If you edit anything under `packages/color-science/src`,
re-run `npm run build:color-science` (or just `npm run dev`/`npm run build`
again) to pick up the change — the app imports the package's compiled
output, not its TypeScript source.

## Structure

```
src/
├── App.tsx                    — top-level shell, screen state machine
├── screens/
│   ├── CaptureScreen.tsx      — camera -> capture -> tap-to-select -> confirm, owns the canvas ref
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
│   └── useTapSelection.ts     — tap -> region selection (delegates sizing to @color-science)
├── state/
│   └── GameStateContext.tsx   — players, rounds, target colors (local React state)
├── data/
│   └── targetColors.ts        — placeholder 20-color target library (real palette is Day 6 scope)
├── types/                     — RGB/Region re-exported from @color-science, plus app-only types
└── utils/
    └── imageCoordinates.ts    — click-to-natural-pixel mapping for object-fit: cover

packages/color-science/        — Jaswin's color science core (see its own HANDOFF.md)
```

## How the app talks to `@color-science`

`vite.config.ts` aliases `@color-science` to
`packages/color-science/dist/browser.js` (the package's browser-only entry
point, which excludes the Node-only `sharp` dependency). `tsconfig.app.json`
mirrors that with a matching `paths` entry so type-checking resolves the
same way. `CaptureScreen.tsx` calls `extractColorFromCanvas()`, `rgbToLab()`,
`deltaE2000()`, and `deltaEToScore()` directly from that import — the app
does not reimplement any of this math.

## Current scope

Playable single-device pass-and-play: camera capture, tap-to-select a color,
real k-means/CIEDE2000 scoring, results screen. Not yet built: multi-round
leaderboard/score accumulation, bonus voting, Collection Mode, calibration —
see `ColorHunt_Build_Plan_Split.md` for what's Day 4+ scope.

## iOS Safari notes

- `playsInline`, `muted`, `autoPlay` are set on the `<video>` element, and
  `.play()` is also called explicitly in `useCamera` — iOS Safari does not
  reliably autoplay a live stream from attributes alone.
- Rear camera is requested via `facingMode: { ideal: "environment" }` (not a
  hard constraint) so devices without an exact match don't throw
  `OverconstrainedError`.
- `getUserMedia` requires HTTPS in production (Vercel provides this by
  default) or `localhost` for local dev.
- Test both Safari-in-browser and "Added to Home Screen" PWA mode —
  permission behavior can differ between the two. Document any difference
  found here.

# ColorHunt

Pass-and-play color-matching party game. React + Vite PWA, no backend.

## Run locally

```
npm install
npm run dev
```

## Structure (Day 1)

```
src/
├── App.tsx              — top-level shell, currentScreen state machine
├── screens/
│   └── CaptureScreen.tsx — camera -> capture -> preview -> retake, owns the canvas ref
├── components/
│   ├── camera/
│   │   ├── CameraView.tsx    — live feed + permission states
│   │   ├── CaptureButton.tsx — dumb capture trigger
│   │   └── PhotoPreview.tsx  — captured photo + retake
│   └── ui/               — empty, shared primitives land here from Day 3+
├── hooks/
│   └── useCamera.ts      — getUserMedia lifecycle + permission state machine
├── lib/                  — empty, color-science module (k-means, CIEDE2000) lands here Day 2+
├── types/
│   └── capture.ts
└── utils/                — empty, small pure helpers as needed
```

## Day 1 scope

Camera access, capture, retake, PWA manifest, mobile-safe layout. No color
science, no game state beyond the single `capture` screen.

## Seam for Day 2

- `CaptureScreen.tsx`'s `canvasRef` holds the raw captured frame. Pixel
  extraction should call `canvasRef.current.getContext('2d').getImageData(...)`
  directly — the canvas is never converted to a data URL except for the
  `<img>` preview shown to the user.
- `PhotoPreview.tsx`'s image wrapper is `position: relative`, ready for a
  tap-to-select crosshair overlay to be absolutely positioned on top.

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

<!-- Add on-device test notes below after Step 13 -->

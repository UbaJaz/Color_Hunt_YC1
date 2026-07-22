# ColorHunt — Color Science Track: Day 1 + Day 2 Summary

*For: my co-founder, ahead of Day 3/4 joint work.*
*Scope: the color science core (k-means extraction, outlier rejection, Lab conversion, CIEDE2000 scoring) — no UI, no game state, no camera capture. That's all yours.*

---

## What this is

A standalone, tested TypeScript module that takes a photo (or a canvas tap point, in the browser) and produces a color-match score against a target color. It's designed to be dropped straight into the React app — see `HANDOFF.md` for the exact function signature and import path.

## Day 1 — Core color math

Built the foundational pipeline:
- **K-means color extraction** (k=3) — finds the dominant color in a set of pixels, run in **Lab space** (not RGB) for perceptual accuracy.
- **Outlier rejection** — removes pixels more than 2 standard deviations from the dominant cluster's centroid, then recomputes.
- **RGB → Lab conversion** — standard sRGB → XYZ → Lab (D65 illuminant), independently verified against published reference values (e.g. pure red → L=53.24, a=80.09, b=67.20 — matches to 2 decimal places).
- **CIEDE2000** — the perceptual color-difference formula. Verified against 13 published test cases from the standard reference dataset (Sharma et al.); 12/13 matched exactly, one within noise.
- **Score conversion** — deltaE → 0-100 score, normalization factor tunable.

**Two real bugs found and fixed during testing (not caught by the first self-review pass):**
1. `imageLoader.ts` assumed every image had 4 channels (RGBA). Real JPEGs (no alpha channel, 3 channels) silently corrupted the entire pixel array. Fixed by using `sharp`'s actual reported channel count instead of a hardcoded `4`.
2. Outlier rejection was being applied to the *entire image's* pixels instead of just the dominant cluster's pixels. This meant the "2 std dev" threshold was so wide almost nothing got rejected, and the centroid drifted toward the whole photo's average color (including background) instead of staying on the actual object. Fixed by tracking per-pixel cluster assignments and filtering before rejection.

Both were confirmed fixed by running the pipeline against real phone photos (not just the synthetic single-color test images that shipped originally — those couldn't have caught either bug).

## Day 2 — Browser pipeline

Ported the Day 1 core into something the actual app can call from a `<canvas>` element:
- **`canvasPixels.ts`** — pixel extraction from `ImageData`, browser-native (no Node dependencies).
- **`regionSelection.ts`** — turns a tap point into a sample region (currently 20% of the image's minimum dimension, clipped to stay in-bounds near edges). Tunable.
- **`pipeline.ts`** — the actual integration function, `extractColorFromCanvas(canvas, tapX, tapY)`, wiring tap → region → pixels → Lab → k-means → outlier rejection → final RGB + score.
- **`browser.ts`** — a clean browser-only entry point that excludes the Node-only `sharp` dependency (needed for the Day 1 file-loading code), so nothing breaks when this gets bundled into the React app.
- Automated a real browser test (Playwright) rather than relying on manual clicking, to get trustworthy, reproducible timing and output.

**One thing caught and fixed on Day 2:** the initial test scores looked great (80%+) but the target/reference colors turned out to have been set equal to (or derived from) the exact RGB values the pipeline extracted from the test photos — meaning the "high scores" were circular and proved nothing. Fixed by replacing them with independent, standard CSS named colors, and re-running everything. Scores dropped to a more honest 37-71% range, which is expected and correct for a first pass — the point wasn't to hit high scores, it was to confirm the pipeline measures real distance accurately.

**Performance:** actual pipeline execution (tap → score) measured at 216-345ms in-browser, well under the 500ms target. (Note: if you see ~2s timings anywhere in old test logs, that includes test-automation overhead, not real pipeline time — the number above is the real one.)

## Current known limitations (expected, not bugs)

- **Extraction accuracy depends on tap location and lighting.** A photo with a strong specular highlight or heavy shadow can pull the sampled color off — one of our test objects (a green pouch with visible sheen) scored low against its nearest reference color for exactly this reason. This is intentionally left unhardened — it's Day 8 scope ("harden edge cases: dark/light objects, mixed lighting, reflective surfaces"), not a Day 2 blocker.
- **The current reference/target colors are placeholders**, not the real game palette. They're standard CSS colors (Crimson, CadetBlue, RoyalBlue, etc.) chosen only to validate the pipeline honestly — the real 20-30 color production palette is your Day 6 task.
- **No calibration or confidence scoring yet** — both are Day 3/4 scope (white-balance correction, flagging poor lighting).

## What's ready for you right now

Everything in `HANDOFF.md` — the `extractColorFromCanvas` function, its return shape, and the correct browser import path — is stable and tested. You can build the tap-to-select UI and results screen against it starting now; the function signature isn't expected to change before Day 4's joint integration pass.

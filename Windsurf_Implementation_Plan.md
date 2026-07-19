# ColorHunt — Day 3 Completion + Pre-Day-4 Audit: Implementation Plan for Windsurf

## 0. Role

Act as a senior engineer performing a pull request review before a merge, while also finishing the remaining Day 3 work owned by the color-science track (Jaswin). Do not begin Day 4 work. Be skeptical — do not assume anything is correct just because it builds or runs.

---

## 1. Required reading before making any changes

Open and read these files in full, in this order, before touching any code:

**Planning/spec docs (attached alongside this plan — source of truth for scope):**
1. `ColorHunt_Build_Plan_Split.md` — **primary/authoritative for day-boundary decisions.** This is the actual operational day-by-day split the two founders are following; code comments throughout the repo cite this doc by name.
2. `colorhunt_llm_spec_v2.md` — broader design spec. Use this for algorithmic/implementation *detail* (e.g. the confidence-scoring heuristic in §3.3) where Build Plan Split doesn't go deep enough. Where the two docs conflict on scope/timing, **Build Plan Split wins** (see §1a below for a known conflict and how to resolve it).
3. `Day1_Day2_Summary_For_Partner.md` — Jaswin's own account of what Day 1–2 shipped, including two real bugs found and fixed, and what's explicitly *not* done yet.
4. `ColorHunt_Merge_Handoff_Partner.md` — the original Day 1–2 merge doc. **Note: this doc is now partially stale** — see §1a for specifics. Don't treat its code examples as current truth without cross-checking against the live repo.
5. `HANDOFF.md` (repo root) — the current, in-repo API contract for `@color-science`. This supersedes `ColorHunt_Merge_Handoff_Partner.md` wherever they disagree (it's newer and lives with the actual shipped code).
6. `Day2_Changes.md` (repo root) — detailed Day 2 changelog.
7. `README.md` (repo root) — current architecture and file structure.

All seven of these are provided (four attached directly, three already in the repo). Read all of them before making changes — do not skip any on the assumption they're redundant.

---

## 1a. Two doc/code discrepancies to resolve as part of the audit (don't silently pick one without flagging it)

1. **Import path:** `ColorHunt_Merge_Handoff_Partner.md` documents importing from `packages/color-science/dist/index.js`. The current repo's `HANDOFF.md`, `README.md`, and `vite.config.ts` all use `packages/color-science/dist/browser.js` instead — with a documented reason (excludes the Node-only `sharp` dependency). This looks like a deliberate, later correction, not a mistake — confirm this is the case and note it in the audit as "resolved, superseded doc," not as a live bug. Do not change the current `browser.js` usage back to `index.js`.
2. **Score normalization factor:** `ColorHunt_Merge_Handoff_Partner.md`'s example code calls `deltaEToScore(deltaE, 15)` (factor 15). The actual shipped `ciede2000.ts` defines the default as `normalizationFactor: number = 10`, and `CaptureScreen.tsx` calls `deltaEToScore(deltaE)` with no override — so the live app is scoring on a factor-10 curve, not factor-15. Factor 10 is more punishing (deltaE ≥ 10 scores 0, vs. deltaE ≥ 15 under the old example). This may be an intentional refinement from Day 1 testing (the Day 1/2 summary mentions scores "dropped to a more honest 37–71% range" after the team removed circular test data) or a leftover from prototyping that was never reconciled with the doc. **Flag this explicitly in the audit as something to confirm with Jaswin** — do not change the value either way yourself.

**Source files — app layer:**
- `src/App.tsx`
- `src/screens/CaptureScreen.tsx`
- `src/screens/ResultsScreen.tsx`
- `src/hooks/useCamera.ts`
- `src/hooks/useTapSelection.ts`
- `src/utils/imageCoordinates.ts`
- `src/state/GameStateContext.tsx`
- `src/data/targetColors.ts`
- `src/types/capture.ts`, `src/types/color.ts`, `src/types/game.ts`
- `src/components/camera/CameraView.tsx`
- `src/components/camera/CaptureButton.tsx`
- `src/components/camera/PhotoPreview.tsx`
- `src/components/camera/TapRegionOverlay.tsx`
- `src/components/camera/TargetColorBanner.tsx`
- `src/components/ui/ColorSwatch.tsx`

**Source files — color-science package (Jaswin's, treat as authored-by-you for audit purposes):**
- `packages/color-science/src/pipeline.ts`
- `packages/color-science/src/regionSelection.ts`
- `packages/color-science/src/canvasPixels.ts`
- `packages/color-science/src/kmeans.ts`
- `packages/color-science/src/outlierRejection.ts`
- `packages/color-science/src/colorConversion.ts`
- `packages/color-science/src/ciede2000.ts`
- `packages/color-science/src/browser.ts`
- `packages/color-science/src/index.ts`
- `packages/color-science/src/types.ts`

**Config:**
- `package.json` (root)
- `vite.config.ts`
- `tailwind.config.js`
- `tsconfig.app.json`, `tsconfig.json` (root + package)
- `src/index.css`
- Confirm whether `postcss.config.js` / `postcss.config.cjs` exists anywhere in the repo (it does not appear to, in the current export — verify this first-hand).

---

## 2. Part 1 — Complete remaining Day 3 work

### 2a. What Day 3 actually covers, per `ColorHunt_Build_Plan_Split.md`

> **Day 3 (July 18) — Jaswin:** RGB → Lab conversion, full CIEDE2000 implementation, score calculation (0–100%), confidence score logic (flagging poor lighting).
> **Day 3 (July 18) — Friend:** Results screen skeleton — layout for swatch comparison, score display, Delta E readout. Wire up the target-color data structure (hex + friendly name library, even if placeholder).

### 2b. Cross-referenced against the repo — here's what's already done and what's not

Cross-referencing this against `Day1_Day2_Summary_For_Partner.md` and the actual `packages/color-science/src/` contents:

- **RGB → Lab conversion** — done. Shipped Day 1 (`colorConversion.ts`), independently verified against published reference values per the summary doc.
- **Full CIEDE2000 implementation** — done. Shipped Day 1 (`ciede2000.ts`), verified against 13 published Sharma et al. test cases (12/13 exact, 1 within noise).
- **Score calculation (0–100%)** — done. Shipped Day 1 (`deltaEToScore` in `ciede2000.ts`).
- **Confidence score logic (flagging poor lighting)** — **NOT DONE.** There is no confidence-scoring code anywhere in `packages/color-science/src/` (confirmed: no file, no function, no export resembling this). This is the one remaining Day 3 task on the color-science track, and it's the task to complete in this session.
- **Friend's Day 3 (results screen + target-color data structure)** — done. `ResultsScreen.tsx` implements the swatch/score/Delta-E layout (its own comment tags it `Day 3 — Friend track / Day 4 JOINT`), and `src/data/targetColors.ts` implements the placeholder target-color library (tagged `Day 3 — Friend track` in its own comment). Verify both are genuinely complete and correct as part of the Part 2 audit — but they do not need new work.

**Conclusion: the only remaining Day 3 implementation task is confidence-score logic in `packages/color-science`.** Verify this conclusion yourself against the docs before proceeding (don't take it purely on faith) but this should not require extensive re-discovery — it's a direct, three-way cross-reference of the docs above.

### 2c. Implementing confidence scoring

Use `colorhunt_llm_spec_v2.md` §3.3 as the implementation reference for the heuristic itself:

```javascript
function calculateConfidence(extractedRGB, imageData) {
  const variance = calculatePixelVariance(imageData);
  const brightness = (extractedRGB.r + extractedRGB.g + extractedRGB.b) / 3;
  if (variance > threshold || brightness < 30 || brightness > 225) {
    return 'low'; // Suggest retake
  }
  return 'high';
}
```

This is illustrative pseudocode, not production code — port the *concept* (variance-based + brightness-based thresholding → `'high' | 'low'` confidence) into a properly typed, tested function consistent with the rest of `packages/color-science`'s style (pure functions, Lab-space where it makes sense, JSDoc comments explaining design decisions the way `regionSelection.ts` and `ciede2000.ts` do).

**Constraints specific to this task:**
- **Do not change `extractColorFromCanvas`'s signature or `ExtractionResult`'s shape.** `HANDOFF.md` and `Day1_Day2_Summary_For_Partner.md` both explicitly document this API as stable: *"the function signature isn't expected to change before Day 4's joint integration pass."* Add confidence scoring as a **new, separate exported function** (e.g. in a new `confidence.ts`, exported from both `browser.ts` and `index.ts`), not as a breaking change to the existing pipeline's return type.
- **Do not implement white-balance calibration.** This is explicitly Day 4 scope (`ColorHunt_Build_Plan_Split.md` Day 4: *"Jaswin: White-balance calibration step..."*), separate from confidence scoring, and out of bounds for this session.
- **Do not wire the new confidence function into any UI component.** Per `ColorHunt_Build_Plan_Split.md`, confidence *display* ("target vs. extracted swatch side-by-side... Delta E + confidence displayed transparently") is explicitly **Day 4, Friend's line item**, not Day 3. Implement and export the function only. It should be ready for Friend to call on Day 4, the same way `extractColorFromCanvas` was ready-and-waiting per the Day 1/2 summary — but do not add a "Retake" button, confidence badge, or any other UI surface for it in this session. That would be starting Day 4 work, which the constraints explicitly prohibit.
- Decide what pixel data the function should operate on (e.g. the sampled region's pixels, available inside `pipeline.ts`'s existing flow) and document that choice with the same kind of design-decision comment style used elsewhere in this package (see `regionSelection.ts`'s comment block on region-proportion reasoning as a model).
- If you add a browser-test or unit-test check for this (the package already has a `browser-test/` harness and test images for red/green/blue), keep it consistent with the existing test approach rather than introducing a new testing pattern.

### 2d. Explicitly out of scope for this session

Do **not** implement, even partially: white-balance calibration (Day 4), confidence *display*/UI wiring (Day 4), production 20–30 color palette (Day 6), multi-round scoring/leaderboard/timer/bonus voting (Day 5), Collection Mode (Day 7+), calibration UI flow (Day 4). These are all explicitly out-of-scope per `HANDOFF.md`'s "Current Status & Scope" section, `README.md`'s "Current scope" section, and the day-by-day breakdown in `ColorHunt_Build_Plan_Split.md`.

---

## 3. Part 2 — Audit (pre-merge PR review)

Review everything implemented for Day 2 and Day 3 across both tracks. For each area below, form an opinion and justify it — don't just confirm the code "looks reasonable."

Review dimensions:
- Architecture
- Correctness
- Integration quality
- API usage
- State management
- React best practices
- TypeScript quality
- Maintainability
- Edge cases
- Unnecessary complexity
- Duplicated logic

### 3a. Color-science integration audit (specific checks required)

Verify correct consumption of:
- `extractColorFromCanvas` — called in `CaptureScreen.tsx`'s `handleConfirmSelection`. Confirm the canvas passed in is the same element used for capture (it is, per current code — verify this claim rather than trusting it), and that `tapX`/`tapY` arguments are in the same coordinate space `extractColorFromCanvas` expects (natural/canvas pixel space, not display/CSS pixel space).
- `selectRegion` — called twice in `useTapSelection.ts`: once for `naturalRegion` (natural pixel space, matches what `extractColorFromCanvas` will sample) and once for `displayRegion` (CSS pixel space, purely for drawing the overlay). Confirm this dual-call pattern is intentional and not a sign that the overlay could visually diverge from the actual sampled region — check whether display-space region dimensions are proportionally equivalent to natural-space region dimensions given `mapClientPointToImagePixel`'s scale factor, or whether there's drift.
- `rgbToLab` — called in `CaptureScreen.tsx` on `currentRound.targetColor.rgb` to get `targetLab`. Confirm this is necessary (there's no cached/precomputed Lab value on `TargetColor`) and not redundant per render.
- `deltaE2000` — confirm argument order and units match `packages/color-science/src/ciede2000.ts`'s signature (`lab1`, `lab2`), and that both inputs are genuinely Lab, not RGB accidentally passed through.
- `deltaEToScore` — confirm the default `normalizationFactor` (10) is being used, not silently overridden, and understand its behavior: **`deltaE >= 10` always scores 0**, and `deltaE 0–2.3` scores roughly 77–100 (per the documented design comment in `ciede2000.ts`). If testing shows consistent 0% scores on deltaE values in the 40s–50s range, this is very likely **mathematically correct given the current normalization curve**, not a bug — flag it as a **Suggestion** (curve may feel harsh for a casual party game) rather than a **Critical/Major** bug, unless the build plan doc specifies a different intended curve.

Also confirm:
- The UI does not duplicate any algorithm logic (e.g. no manual RGB↔Lab math, no reimplemented distance/scoring formulas anywhere under `src/`).
- All placeholder implementations have been removed (check especially `ResultsScreen.tsx` and `CaptureScreen.tsx`, which have comments claiming "real" extraction is wired up — verify this is actually true and not a stale comment over a stub).
- Separation of concerns is intact: `src/types/color.ts` re-exports `RGB`/`Region` from `@color-science` rather than redeclaring them — confirm no other file redeclares these types independently.
- The app imports from `@color-science`, which `vite.config.ts` aliases to `packages/color-science/dist/browser.js` (not `dist/index.js`), and `tsconfig.app.json` has a matching `paths` entry. Confirm both are actually consistent (mismatched alias vs. paths config is a common source of "works at runtime, red squiggles in editor" bugs).
- No Node-only code leaks into the app: `packages/color-science/src/index.ts` exports `loadPixels`/`loadFullImage` from `imageLoader.ts` (Node-only, uses `sharp`), while `browser.ts` deliberately excludes them. Confirm nothing under `src/` imports from `@color-science`'s `index.ts` path or otherwise reaches `imageLoader.ts`/`sharp` transitively.

### 3b. Known risk area — tap-to-select coordinate mapping

`src/utils/imageCoordinates.ts`'s `mapClientPointToImagePixel` explicitly assumes `object-fit: cover` scaling behavior to convert a click position into natural image pixel coordinates. `PhotoPreview.tsx`'s `<img>` has `className="h-full w-full object-cover"` — a Tailwind utility class. If Tailwind CSS is not actually being applied in the running app (see Section 4), `object-cover` will not take effect, the image will render at a different effective size/position than the math assumes, and tap coordinates will map incorrectly — which would explain the "can't tap to select a region" symptom described below, without there being any bug in the mapping logic itself. **Fix Tailwind first (Section 4), then re-verify tap-to-select behavior before concluding whether `imageCoordinates.ts` or `useTapSelection.ts` need any changes.** Do not modify the coordinate-mapping math speculatively.

---

## 4. Tailwind CSS investigation and fix

**Symptom (confirmed via user testing + screenshots):** build succeeds, Vite warns about unknown `@tailwind` at-rules, production CSS bundle is ~0.16 kB, and the running app renders with no styling at all (default browser serif font, unstyled buttons, no layout/positioning, no color swatches visible) — consistent with Tailwind not being processed at all, not a partial/purge issue.

**Diagnosis to verify (not to take on faith — confirm it yourself):**
- `tailwindcss@^3.4.19` and `autoprefixer@^10.5.4` are both present in `package.json` devDependencies.
- `src/index.css` correctly uses v3-syntax `@tailwind base; @tailwind components; @tailwind utilities;` (this is correct for the installed version — do not "upgrade" this to `@import "tailwindcss"` v4 syntax, that would be the wrong fix for this dependency version).
- `tailwind.config.js` exists and has a plausible `content` glob (`./index.html`, `./src/**/*.{js,ts,jsx,tsx}`).
- No `postcss.config.js`, `postcss.config.cjs`, or `postcss.config.mjs` exists anywhere in the project root, and `vite.config.ts` has no inline `css.postcss` configuration either.

If confirmed, **this is the root cause**: without a PostCSS config, Vite's built-in CSS pipeline has no plugin wired up to actually process `@tailwind` directives — it passes them through as literal (unknown) at-rules, which is exactly the warning being seen, and Tailwind never generates any utility CSS.

**Fix:** Create a standard `postcss.config.js` (or `.cjs`, matching whatever module format the rest of the config files in this project use — check `package.json`'s `"type"` field first) at the project root:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

Do not suppress the Vite warning some other way (e.g. by disabling CSS warnings, or by hand-writing the utility classes actually in use). Do not switch to `@tailwindcss/vite` (the v4 plugin) — that would require upgrading `tailwindcss` to v4 and changing `index.css` syntax, which is a larger, unnecessary change given v3 is already installed and otherwise correctly configured.

**Verify after the fix:**
- Run the production build and confirm the generated CSS bundle size is no longer ~0.16 kB — it should be on the order of tens of KB given Tailwind's base+components+utilities output for the classes actually used across `src/`.
- Confirm the Vite build no longer warns about unknown `@tailwind` at-rules.
- Run the app and visually confirm styling is applied (rounded corners, dark theme backgrounds, proper button styling, flex layout, `object-cover` on the captured photo, etc. — compare against what the Tailwind classes in the JSX imply).
- Re-test tap-to-select on `PhotoPreview` now that `object-cover` should be active, and confirm the overlay rectangle (`TapRegionOverlay.tsx`) renders at the correct position relative to the tapped point.

---

## 5. General cleanup

Only within files you've already touched or closely reviewed — do not go hunting for unrelated cleanup elsewhere:
- Dead code
- Stale comments (especially any claiming something is a "placeholder" or "not yet wired up" that's actually already real, or vice versa — several comments in this codebase make specific claims about what's real vs. stubbed; verify each one you rely on)
- Duplicate utilities
- Obsolete files
- Incorrect imports
- Unnecessary abstractions

Keep changes minimal. Do not perform unnecessary refactors.

---

## 6. Constraints

- Preserve existing architecture.
- Do not rewrite working code.
- Do not redesign the application.
- Keep `packages/color-science` isolated — it should remain consumable as a standalone package with no app-specific logic leaking into it.
- Do not introduce new features outside Day 3 scope unless strictly required to fix a bug you find.
- Do not change `deltaEToScore`'s normalization curve, the k-means parameters, or any other tuned constant in `packages/color-science` without calling it out explicitly and explaining why — these were deliberate, documented design decisions (see comments in `ciede2000.ts` and `kmeans.ts`), not defaults to casually adjust.

---

## 7. Deliverables (produce all of the following at the end)

1. **Audit summary** — overall assessment of the project.
2. **Issues found** — categorized as Critical / Major / Minor / Suggestion.
3. **Files modified** — for every modified file, explain why it changed.
4. **Color Science audit** — explicitly state whether `packages/color-science` is integrated exactly as intended per `HANDOFF.md`, and call out any incorrect API usage found.
5. **Tailwind report** — root cause, fix applied, and how it was verified.
6. **Verification** — confirm all of:
   - TypeScript passes (`tsc -b` or equivalent)
   - Build passes (`npm run build`)
   - Lint passes (`npm run lint` — uses `oxlint`)
   - Production CSS builds correctly (report actual bundle size before/after)
   - Color-science pipeline still produces correct results on the existing browser-test images (`packages/color-science/browser-test/test-images/` — real-red/green/blue) if a test harness exists to check this
   - No regressions introduced
7. **Remaining work** — only work that genuinely belongs to Day 4+ according to the build plan doc. Do not scope-creep this list.
8. **Suggested commit message** — one concise Conventional Commit message.

---

## 8. Context for triage (from live testing on this build, before the Tailwind fix)

- Camera capture, retake, and "Use This Color" all functioned end-to-end; a score and Delta E value were computed and displayed.
- The running app had visibly **zero CSS applied** — plain black serif text on white background, default HTML button styling, no swatches, no visible tap-region overlay. This is strong corroborating evidence for the Tailwind diagnosis in Section 4, and should be treated as the probable root cause of the "can't tap to select a region" symptom too (Section 3b), rather than as two unrelated bugs.
- Observed scores were 0% at Delta E values of 47.54 and 53.33 against Goldenrod and Coral targets respectively, for picks that were dark slate/navy tones (`#484651`, `#494C5D`) — genuinely far from either target in color space. Given `deltaEToScore`'s documented normalization (anything ≥10 Delta E scores 0), **this is very likely correct scoring behavior, not a bug** — but confirm this conclusion during the audit rather than assuming it, and check whether the extracted colors themselves are plausible given what was likely in frame (a dark sock, per the capture) — i.e. verify the *extraction* is accurate even if the *score* is correctly reported as low.

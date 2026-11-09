# Day 9/10 — Extraction Bug Debug, Partner Bug Triage, Full src/ Audit

Scope note: you're now fixing both tracks since your partner is blocked. Keep commits separate per track (`fix(color-science): ...` vs `fix(ui): ...`) so history stays traceable even though one person is authoring both.

---

## PART 1 — Extraction wrong on real object (no Mac, on-screen debug panel)

Root-cause candidates, cheapest-to-check first:
1. Tap-to-select region is sampling the wrong pixels entirely (mapping bug in `imageCoordinates.ts`'s object-fit:cover math) — would explain consistently "wrong" colors regardless of pipeline correctness.
2. k-means picks the wrong dominant cluster (background instead of object).
3. Calibration/confidence math genuinely wrong.

Don't guess — add a temporary on-screen debug overlay so you can see raw values without a Mac.

**Instruction for Antigravity:**
```
Find where extractColorFromCanvas() (or equivalent @color-science call) is invoked in CaptureScreen.tsx.
Capture its FULL return value plus these additional values into a debug state object:
  - tap coordinates in natural pixel space (from useTapSelection/imageCoordinates)
  - sampled region bounds (x, y, width, height in natural pixels)
  - raw average RGB of the sampled region BEFORE any Lab conversion or k-means
  - dominant cluster Lab + RGB + cluster sizes (from kmeans.ts's return)
  - final extracted RGB after outlier rejection
  - confidence diagnostic + level

Render this as a small monospace text block at the bottom of ResultsScreen.tsx, visible only when
a debug flag is true (e.g. `?debug=1` in the URL, or a hardcoded `const DEBUG = true` you remove later).
Do not change any pipeline logic — this is read-only instrumentation.
```

**Then:** photograph the same real object again with the debug URL/flag on, screenshot the overlay, and bring it here. Specifically check: does the sampled region bounds visually match where you tapped? If the raw average RGB (before k-means) already looks wrong, the bug is upstream in tap mapping, not in color-science. If raw average is correct but final extracted RGB is wrong, the bug is in k-means/calibration — then I'll need the exact numbers to pinpoint it.

**Cleanup:** once fixed, remove the debug flag/overlay code — don't ship it.

---

## PART 2 — Partner's bugs: phantom 3rd turn + frozen Retake/Use-This-Color

This likely reproduces on desktop via `npm run dev` — no phone needed, use browser devtools directly.

1. Reproduce: start a 2-player game, play both turns, watch for the 3rd blank-name turn.
2. Open browser devtools console BEFORE reproducing, keep it open through the whole flow. When buttons freeze, an uncaught error is almost certainly logged there — frozen click handlers with no visible error is the classic symptom of an exception thrown inside the handler (e.g. `player.name` on `undefined`).
3. Locate the turn-increment logic:
```
Select-String -Path src/state/GameStateContext.tsx -Pattern "currentPlayer|turnIndex|players\.length"
```
Check whether the turn index increments correctly against `players.length` (off-by-one or missing modulo would create a phantom extra turn).
4. Locate the capture confirm handler:
```
Select-String -Path src/screens/CaptureScreen.tsx -Pattern "onConfirm|handleConfirm|currentPlayer"
```
Check whether it assumes a player object exists without a guard — if `currentPlayer` is `undefined` on the phantom turn, any `currentPlayer.something` access throws and silently breaks both buttons (both call into the same broken state update).

**Fix should be:** correct the turn-increment boundary condition so no phantom turn is created, AND add a defensive guard in the confirm handler in case an undefined player ever reaches it. Paste the actual diff and the console error text before/after fixing — don't mark this done from a "looks right" read.

---

## PART 3 — Brutal audit of `src/` (partner's track)

Same standard as the color-science audit: real tool output only, no prose summaries.

**Phase A — Static analysis**
```
npx tsc --noEmit -p tsconfig.app.json
npx eslint src --ext .ts,.tsx
```
(confirm actual lint tool/config for `src/` first — it may not be oxlint like color-science)

**Phase B — Dead code / duplication / debug leftovers**
```
npx ts-prune -p tsconfig.app.json
Select-String -Path src -Pattern "console.log" -Recurse
Select-String -Path src -Pattern "TODO|FIXME|XXX" -Recurse
```
Triage each: fix trivial, otherwise list in README as known limitation — don't leave scattered.

**Phase C — File/folder inventory for cleanup**
```
Get-ChildItem -Recurse src -Include *.md,*.txt
```
Classify KEEP/ARCHIVE/DELETE, same as color-science cleanup. Also re-check root for any remaining stray duplicate files (e.g. leftover `test_output_v*` variants) not caught last time.

**Phase D — Structural review (manual read, not tool-generated)**
Read `hooks/useCamera.ts`, `hooks/useTapSelection.ts`, `state/GameStateContext.tsx`, `screens/CaptureScreen.tsx`, `screens/ResultsScreen.tsx` end to end. Flag, don't fix unless trivial:
- duplicated logic that should be a shared hook/util
- components doing more than their name implies (e.g. a "dumb" button component with business logic in it)
- any other unguarded `undefined` access patterns like the Part 2 bug — this is the kind of bug that tends to repeat in a codebase, worth scanning for after fixing one instance

**Do NOT touch:** anything in `packages/color-science/` during this pass — that audit already happened. Do NOT restructure component folders or rename files — audit surfaces issues, it doesn't redesign.

---

## Sign-off
- [ ] Part 1: debug overlay added, real-object test rerun, root cause identified with real numbers, fix applied, overlay removed
- [ ] Part 2: reproduced with console open, actual error captured, turn-increment + confirm-handler diffs pasted, retested full 2-player flow through to scoreboard
- [ ] Part 3: Phases A–D output pasted, findings classified (fixed / flagged for later / deleted), nothing in color-science touched

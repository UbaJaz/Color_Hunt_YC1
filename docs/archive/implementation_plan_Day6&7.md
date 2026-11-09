# ColorHunt — Day 6 & 7 Implementation Plan (Jaswin's Track)

## Background

Partner has completed Days 4–6 on the **App & Product Track** (screens, routing, state, voting). Build and lint are passing. This plan covers:
1. **3 Bug Fixes** identified in the audit
2. **Day 6 Jaswin tasks** — "Random color" generator wiring + calibration tuning (already coded but unwired)
3. **Day 7 Jaswin tasks** — Rarity unlock logic, confetti/sound trigger conditions, pipeline accuracy testing

Per the Build Plan, Jaswin owns the color-science track. Friend owns Collection Mode v0.1 (photo → unlock → gallery) and Instagram Story share template — **those are explicitly excluded here so they don't get blocked on friend's Day 7 work.**

---

## Bug Fixes (pre-Day 6)

### Fix 1 — Timer expiry stuck on preview
**File:** `src/screens/CaptureScreen.tsx`
- When timer fires, `handleCapture()` is called which transitions to `PhotoPreview`, but nothing auto-confirms the selection.
- Add an `autoConfirm` flag to `CaptureScreen`. When the timer fires and a photo is now captured, synthesize a center-pixel `TapSelection` and call `handleConfirmSelection` directly, bypassing `PhotoPreview`.

### Fix 2 — Unvoted default penalty
**File:** `src/screens/VotingScreen.tsx`
- `votes[result.playerId] || 'down'` penalizes players whose item wasn't voted on.
- Change default to `{ thumbsUp: 0, thumbsDown: 0 }` → multiplier returns `1.0` (neutral). Matches `calculateBonusMultiplier` contract (total=0 → 1.0).

### Fix 3 — Procedural colors not wired
**File:** `src/data/targetColors.ts`
- `getRandomTargetColor()` only picks from the static 20-color list.
- Add an overloaded export `getDynamicTargetColor(difficulty?: Difficulty)` that calls `generateRandomTargetColor()` from `@color-science` and constructs a `TargetColor` shape (generates a name from hex). The existing `getRandomTargetColor` stays unchanged (Friend's screens depend on it). `GameStateContext` stays unchanged.

---

## Day 6 — Jaswin Track

Per Build Plan Day 6: *"Random color generator with a difficulty filter, tied into confidence/accuracy work. Continue calibration tuning."*

### 6a. Difficulty mode selection in Lobby
**File (NEW):** `src/hooks/useGameSettings.ts`
- A simple context-free hook wrapping `useState` for `{ difficulty: 'easy' | 'medium' | 'hard', useRandomColor: boolean, roundCount: number }`.

**File (MODIFY):** `src/screens/LobbyScreen.tsx`
- Add a "Game Settings" panel at the bottom of the lobby: Round count selector (3/5/7), Difficulty toggle (Easy/Medium/Hard), Random Color mode toggle. Pass settings to context via new `START_GAME` action.

**File (MODIFY):** `src/types/game.ts`
- Add `settings: GameSettings` to `GameState`.

**File (MODIFY):** `src/state/GameStateContext.tsx`
- Add `START_GAME` action that stores settings. Add `settings` to initial state. Expose `startGame(settings)`.

**File (MODIFY):** `src/data/targetColors.ts`
- Add `getDynamicTargetColor(difficulty)` that calls `generateRandomTargetColor` and wraps it into `TargetColor`.

**File (MODIFY):** `src/state/GameStateContext.tsx`
- `createRound()` reads `state.settings` and calls either `getRandomTargetColor()` or `getDynamicTargetColor(difficulty)`.

### 6b. Difficulty badge on Target Color Banner
**File (MODIFY):** `src/components/camera/TargetColorBanner.tsx`
- Show a small difficulty badge (e.g., 🟢 Easy / 🟡 Medium / 🔴 Hard) next to the color name. Uses the `difficulty` field already on `TargetColor`.

---

## Day 7 — Jaswin Track

Per Build Plan Day 7: *"Rarity unlock logic, confetti/sound trigger conditions, keep testing pipeline accuracy."*

Friend owns the Collection Mode UI shell (photo → unlock → gallery page). Jaswin provides:

### 7a. Rarity scoring utility
**File (NEW):** `packages/color-science/src/rarity.ts`
- `getRarityTier(rgb: RGB): RarityTier` — maps an extracted color to `'common' | 'uncommon' | 'rare' | 'ultra-rare'` based on chroma (C*) and lightness (L*) in Lab space.
- `isSuccessfulUnlock(score: number, confidence: ConfidenceLevel): boolean` — returns true if score ≥ 75 and confidence is not 'low'.
- Export from `packages/color-science/src/index.ts`.

### 7b. Confetti + sound trigger hook
**File (NEW):** `src/hooks/useCelebration.ts`
- `useCelebration()` — watches a score and fires:
  - Confetti animation (CSS keyframe burst, no library) if `finalScore >= 90` or `rarityTier === 'rare' | 'ultra-rare'`.
  - Haptic feedback via `navigator.vibrate()` (250ms).
- Returns `{ celebrate, CelebrationOverlay }` so it's easy for Friend to drop into ResultsScreen or a future Collection unlock screen.

### 7c. Score transparency upgrade on Results screen
**File (MODIFY):** `src/screens/ResultsScreen.tsx`
- Add rarity badge to the extracted color swatch (calls `getRarityTier`).
- Show a "🎉 Bonus unlock eligible!" banner when `isSuccessfulUnlock(score, confidence.level)`.
- Wire up `useCelebration` on mount when score ≥ 90.

### 7d. Retake button for poor lighting on Results screen
**File (MODIFY):** `src/screens/ResultsScreen.tsx`
- Spec §3.2 explicitly requires a retake flow for poor-lighting confidence. Currently only shown as a warning. Add a "↩ Retake" button that calls `onRetake` callback to go back to Capture screen for this same player (reset `nextTurn`).

**File (MODIFY):** `src/App.tsx`
- Add `onRetake` handler to `ResultsScreen` that calls `setScreen('capture')` without advancing turn.

---

## Files NOT Changed (Friend's territory)

- `src/screens/CalibrationScreen.tsx` — stable, no changes
- `src/screens/VotingScreen.tsx` — bug fix only (1 line)
- `src/screens/LeaderboardScreen.tsx` — untouched
- `src/screens/LobbyScreen.tsx` — additive only (settings panel)
- Collection Mode screens (Day 7 Friend work — will be new files)

---

## Verification Plan

1. `npm run build` — TypeScript + Vite must pass with 0 errors.
2. `npx oxlint` — 0 errors (Fast Refresh warning is pre-existing, acceptable).
3. Manual walkthrough checklist:
   - Lobby: set Round count, Difficulty, Random Color toggle → players added → Start.
   - Calibration skipped if already done (existing logic, unchanged).
   - Timer countdown → at 0, auto-confirms center pixel, goes straight to Results.
   - Results: rarity badge visible, retake button works for low confidence.
   - Voting: unvoted items score 1.0× (neutral), not penalized.
   - Leaderboard: correct cumulative scores.

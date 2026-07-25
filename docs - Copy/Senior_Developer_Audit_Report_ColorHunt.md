# Senior Developer Audit Report: ColorHunt MVP (Days 4–6)

**Audit Subject:** `ColorHunt_MVP_Partner_Day6_Report.md`  
**Cross-Referenced Documents:** `colorhunt_llm_spec_v2.md` and `ColorHunt_Build_Plan_Split.md`  

---

## Executive Summary & Verdict

> **VERDICT: EXCELLENT PROGRESS — APPROVED TO PROCEED TO DAY 6/7 WORK**

The core pass-and-play game loop (`Lobby` → `Calibration` → `Capture` → `Results` → `Voting` → `Leaderboard`) is fully functional on a single device with zero external dependencies. Build checks, TypeScript compilation, `oxlint`, and `color-science` test suites pass cleanly.

---

## Empirical Verification Checklist

| Check | Command / Scope | Result | Details |
| :--- | :--- | :---: | :--- |
| **Color Science Unit Tests** | `node packages/color-science/dist/testHarness.js` | **PASS** | All 5 lighting scenarios & real-world image tests pass. |
| **TypeScript & App Build** | `npm run build` | **PASS** | `tsc` + `vite build` completed in 9.06s with 0 errors. |
| **Linter** | `npx oxlint` | **PASS** | 0 errors, 1 minor Fast Refresh warning (documented by partner). |

---

## Audit Findings & Breakdown

### 1. What Was Done Correctly & Well

* **Routing Infrastructure (`App.tsx`):**
  * Clean state-driven screen switching without pulling in heavy router dependencies like `react-router`.
  * Turn-by-turn indexing correctly cycles through players per round before routing to voting.
* **Color Pipeline Wiring (`CaptureScreen.tsx`):**
  * Correctly passes `calibrationMatrix` to `extractColorFromCanvas`.
  * Computes `deltaE2000`, `deltaEToScore`, and transparent lighting `calculateConfidence` scores on user tap.
* **White-Balance Calibration (`CalibrationScreen.tsx`):**
  * Enables players to sample a white paper/surface prior to game start to adjust for room lighting.
* **Data Models (`game.ts` & `GameStateContext.tsx`):**
  * Context reducer safely handles `ADD_PLAYER`, `NEXT_TURN`, `RECORD_RESULT`, and `RECORD_VOTES`.

---

### 2. Minor Edge-Case Bug Audit (Fix before starting Day 7)

While the implementation is solid, 3 minor code edge-cases were identified that should be polished:

#### 🚨 1. Timer Expiration Flow (`CaptureScreen.tsx`)
* **Issue:** When the 60s timer expires, `handleTimeExpire` calls `handleCapture()`, which captures the frame and transitions to `PhotoPreview`. However, `PhotoPreview` waits for a manual screen tap. If a player is AFK when time expires, the app remains stuck on preview indefinitely.
* **Fix:** If the timer expires, auto-select the center of the frame (`width/2`, `height/2`) and confirm the selection automatically.

#### 🚨 2. Unvoted Default Penalty (`VotingScreen.tsx`)
* **Issue:** `const vote = votes[result.playerId] || 'down'` defaults any unclicked item to `'down'`, applying a negative multiplier penalty even if the group forgot to click a vote button.
* **Fix:** Default unvoted items to a neutral **1.0x** multiplier (`thumbsUp: 0`, `thumbsDown: 0`).

#### 🚨 3. Wiring Procedural Colors (`targetColors.ts`)
* **Issue:** `randomColor.ts` was created with easy/medium/hard difficulty filters, but `targetColors.ts` still picks exclusively from the 20 pre-set static colors.
* **Fix:** Update `getRandomTargetColor` to optionally invoke `generateRandomTargetColor()` when dynamic mode is selected.

---

## Recommended Next Steps for Day 6 / Day 7

Now that Phase 1 (Pass-and-Play Core Loop) is 100% verified, you can proceed with Day 6 polish and Day 7 Collection Mode v0.1:

1. **Quick Fixes:** Apply the timer auto-select and voting default tweaks (~15 mins).
2. **Collection Mode v0.1** (from `ColorHunt_Build_Plan_Split.md`):
   * Implement photo unlock → local gallery persistence (`localStorage`).
   * Create Instagram Story export canvas template (target swatch + captured photo + match score).
   * Add confetti / sound triggers for high scores (>90%) or rare unlocks.

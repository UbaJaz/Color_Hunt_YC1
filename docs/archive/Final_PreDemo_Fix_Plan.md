# Final Pre-Demo Fix Plan

Time-boxed. Fix what's fixable, document what isn't. This is likely the last code change before filming.

---

## 1. Round limit not respected

Evidence needed before fixing — locate the actual check:
```
Select-String -Path src/state/GameStateContext.tsx -Pattern "roundLimit|maxRounds|settings\."
Select-String -Path src/App.tsx -Pattern "roundLimit|maxRounds|rounds\.length"
```
Find where the selected round count (3 or 5) is stored and where the game decides "start next round" vs "game over." This is almost certainly the same class of bug as the phantom-turn issue: either the check is missing entirely, or it compares against the wrong value (e.g. checking `players.length` instead of the selected round limit, or missing the check altogether after voting).

**Fix:** after voting/leaderboard, compare `state.rounds.length` (or equivalent) against the stored round limit. If reached, route to a final end-screen instead of "Start Next Round." Paste the diff.

**Verify:** play a full game with "3 rounds" selected. Confirm it stops after exactly 3 and shows a final screen, not "Start Next Round" again.

---

## 2. Scoring returns 0 for most rounds

Evidence gathered already confirms this: scores of 17 and 0 seen across different players/rounds, all total scores showing 0 in one 4-player game. Root cause is a harsh score curve (ΔE ~28 already floors to 0%), not a total-aggregation bug — most real captures won't hit the low ΔE needed for any nonzero score.

**Do NOT touch `deltaEToScore()` in `packages/color-science`** — it's tested and audited; changing it now risks the verified pipeline with no time to re-verify.

**Fix at the game layer instead.** Find where the round's displayed/stored score is set (likely in `CaptureScreen.tsx` or the reducer, wherever `finalScore`/`result.score` is assigned):
```
Select-String -Path src/screens/CaptureScreen.tsx,src/state/GameStateContext.tsx -Pattern "finalScore|\.score"
```
Replace that value's computation with a more forgiving formula based on the same ΔE already computed, e.g.:
```typescript
const gameScore = Math.max(0, Math.round(100 - deltaE));
```
This keeps "higher is better" (so existing leaderboard sort logic doesn't need to change) and keeps ΔE as the actual basis, per your intent — it just stops cliff-ing to 0 for anything above ΔE ~35.

**Verify:** replay the same 4-player round type that previously showed all zeros. Confirm scores now show meaningful variation and the total leaderboard sums correctly.

---

## 3. Color extraction under glare — document, don't chase

Add to README "Known Limitations":
> Color extraction on glossy/reflective real-world objects can be skewed by specular highlights covering a large portion of the tapped region — confirmed via debug telemetry showing raw sampled average diverging sharply from the extracted color when the dominant k-means cluster is itself a highlight rather than the object's base color. Mitigated for now by capturing on matte surfaces / avoiding direct glare on the tapped spot. Proper fix (e.g. highlight-aware region re-sampling) is out of scope before submission.

**For filming:** brief your friend and anyone in the demo to tap on the least shiny part of objects, avoid direct flash reflection.

---

## 4. Final full verification before filming

Play one complete game end-to-end with 3+ players and the "3 rounds" option selected:
- [ ] No phantom extra turns (already fixed, recheck once more with 3 players)
- [ ] Game stops after exactly 3 rounds, shows final screen
- [ ] Scores show real variation, not all zero
- [ ] Leaderboard sorts correctly (highest score on top)
- [ ] No console errors across the full flow

Only once all four pass, you're ready to film.

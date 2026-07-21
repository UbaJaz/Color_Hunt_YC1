# ColorHunt — Finish Day 4 + Day 5, Quota-Efficient Plan

You already have full repo context from prior sessions. Do not re-read/re-summarize files you've already reviewed unless you're actually changing them. This doc is deliberately terse — execute, don't narrate.

**Operating rule for this whole session: momentum over polish.** Quota is limited and there's more work below than probably fits. Work strictly in the priority order given. If any single task is taking more than ~2-3 real attempts to resolve, **stop, log it under "SKIPPED — return if time" in a scratch section at the top of the relevant file (a comment block is fine), and move to the next task.** Only circle back to skipped items after everything else in this doc is attempted at least once. A working Day 5 with 2 known, documented bugs beats a perfect Day 4 and no Day 5.

Do not push to GitHub at any point in this session. Local commits only, after each numbered section below completes (or is skipped). Do not produce long audit-style verification output (no need to paste exhaustive before/after arithmetic anymore) — a one-line pass/fail per test plus the final numbers is enough. Confirm things work; don't perform the confirmation.

---

## Section 0 — Housekeeping (2 min, do first)

```bash
git add -A
git commit -m "WIP checkpoint before Day 4 finish + Day 5 start"
```

---

## Section 1 — Finish Day 4 (time-box this — see rule above)

Two known open issues from the last session:

**1a. Red-berry/green-leaf regression test** — synthetic pixel population didn't separate into distinct clusters (k-means merged red+green into one cluster, hue divergence came out 0.0°). Fix: tighten the per-pixel jitter around the two centroids (`L=45,a=-20,b=25` leaf / `L=40,a=55,b=35` berry) so k-means reliably separates them — try ±3 jitter first. Print the resulting cluster centroids once to confirm real separation before trusting the pass/fail. Then:
- If it **fails** (picks leaf over berry): this is a real regression from today's hue-check. Fix by gating the hue-override to only fire when the *larger* cluster also has non-trivial chroma (pick a reasonable floor, e.g. chroma > 15, so a genuinely neutral/dull background never overrides a legitimate colorful object). Re-test.
- If it **passes**: good, move on.
- **If you can't get clean cluster separation in 2 attempts:** skip it, log it, move to 1b. This test is important but not worth burning the whole session on synthetic data wrangling.

**1b. Size-penalty isolation test** — confirmed the size penalty alone doesn't flip the winner (hue-check is doing all the real work). Try one escalation: steepen the ramp further (`sizeRatio ** 2` instead of `sqrt`, or drop the multiplier to `* 0.25`). Re-run the isolation test once.
- If it now passes: good.
- **If not, stop trying.** Update the DESIGN DECISION comment in `kmeans.ts` to say plainly that the hue-consistency check is the actual fix for the dim-lighting bug and the size penalty is a secondary refinement — don't leave the comment overclaiming. This is a legitimate, honest engineering conclusion. Move on.

**1c.** Re-run the full existing regression suite in `testHarness.ts` once (red/green/blue, dim-lighting, both new tests, size-ramp unit tests). Report pass/fail counts only.

**1d.** Skip real-photo validation (Item 4 from the earlier audit) entirely for now — no photo fixtures exist and capturing them isn't something you can do. Note it as unverified in the status file (Section 4 below) and move on; it'll get covered by Day 5's stress-testing work anyway (Section 3 below).

Commit locally when this section is done or time-boxed out.

---

## Section 2 — Day 5, Task A: Bonus voting logic

**New file:** `packages/color-science/src/bonusVoting.ts`. This is a small, pure, easily-tested module — don't overthink it, implement the following spec directly:

```ts
export interface VoteTally {
  thumbsUp: number;
  thumbsDown: number;
}

/**
 * Converts a "most unlikely item" vote tally into a score multiplier.
 * No votes = neutral (1.0x). At or below 50% approval = no bonus (1.0x floor —
 * an unpopular-but-valid find isn't penalized, just not rewarded).
 * Above 50% approval scales linearly up to 2.0x at 100% approval.
 */
export function calculateBonusMultiplier(votes: VoteTally): number {
  const total = votes.thumbsUp + votes.thumbsDown;
  if (total === 0) return 1.0;

  const approvalRatio = votes.thumbsUp / total;
  if (approvalRatio <= 0.5) return 1.0;

  return 1.0 + (approvalRatio - 0.5) * 2;
}
```

Apply the multiplier to the existing color-match score (multiply, then clamp final displayed score to 100 if your score is a 0-100 percentage — check `ciede2000.ts`'s `deltaEToScore`/`calculateColorScore` output range and clamp consistently with however over-100 is already handled elsewhere, or clamp at 100 if nothing exists yet).

**Test cases to add to `testHarness.ts`** (quick, table-driven, don't over-engineer):
- 0 votes → 1.0
- 5 up, 5 down (50%) → 1.0
- 10 up, 0 down (100%) → 2.0
- 7 up, 3 down (70%) → 1.4
- 2 up, 8 down (20%) → 1.0 (floor, not negative/penalized)

Export from `browser.ts` and `index.ts` (same pattern as `calibration.ts`/`confidence.ts`).

This is UI-agnostic — your partner's UI will call `calculateBonusMultiplier()` with vote counts from their game state. No joint wiring needed from your side today beyond making sure it's exported.

---

## Section 3 — Day 5, Task B: Stress-test the pipeline against varied lighting (start, don't finish)

Per the build plan, this is explicitly a **"start, catch problems early"** task — Day 8 is reserved for actually hardening these edge cases. Your job today is to build the test suite and produce a findings list, **not** to fix everything you find. Don't fall into fixing rabbit holes here — log and move on, same rule as Section 1.

You can't take real photos, so build a **systematic synthetic scenario suite** in `testHarness.ts` (new function, e.g. `testLightingScenarios()`), covering:

1. **Very dark object** — low L (e.g. L=15-20), moderate chroma, on a slightly-less-dark background.
2. **Very bright/overexposed object** — high L (e.g. L=90-95), low chroma (colors wash out near white), on a mid-tone background.
3. **Mixed lighting / color cast** — same object hue split across two sub-clusters with a shifted L or slight hue shift between them (simulates half the object being in shadow, half in light).
4. **Low-saturation object** — small chroma difference from its background (e.g. a beige object on a tan background) — check whether extraction still produces a usable confidence score or whether `confidence.ts` correctly flags it as low-confidence rather than silently returning a misleading result.
5. **Specular highlight simulation** — mostly one color population, plus a very small (~3-5%), very bright, low-chroma cluster (simulates a glare/reflection spot) — confirm outlier rejection or the size penalty correctly ignores it.

For each scenario: run it through the pipeline, print the extracted color and confidence score, and note pass/fail against what you'd expect a human to consider "close enough." **Compile results into a short findings list** (bullet points, not essays) in the status file (Section 4) — e.g. "Scenario 3 (mixed lighting) extracts a color between the two lighting conditions rather than picking one — flag for Day 8" — rather than trying to fix each one now.

If Section 1 items got skipped and there's clearly not enough quota left to do all 5 scenarios, do scenarios 1, 2, and 5 first (most likely to actually occur with a phone camera) and skip 3/4 if needed — log them as not-yet-tested.

---

## Section 4 — Status note (concise — 10 min max)

Write one status file (`Day5_Status_For_Partner.md`, new file — don't keep editing the Day 4 one) covering, briefly:
- Day 4 final state: what got fixed (1a/1b), what got honestly downgraded instead of "fixed" (if size-penalty ended up in that bucket), what's still skipped/open.
- Day 5: bonus voting logic done + exported, test results.
- Day 5: stress-test findings list from Section 3 — this becomes the Day 8 to-do list, so make sure it's a real list, not vague.
- One line at the top: total quota/time used, and what's left undone if the session ends here, so whoever picks this up next (you, in a fresh session, or your partner) knows exactly where to restart without re-deriving it.

Commit locally. Do not push.

---

## If you run out of quota mid-section

Whatever section you're in, stop cleanly: commit what's there, add one line to the top of the status note saying exactly which section/subtask you were on, and stop. Don't leave a half-written function uncommitted — a committed, clearly-marked-incomplete function is recoverable; uncommitted work in a dead session isn't.

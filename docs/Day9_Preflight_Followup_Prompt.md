# Day 9 Pre-Flight — Follow-Up Verification (Round 2)

## Context
The Round 1 report claimed Day 9 was unblocked. Reviewing the actual diffs for `confidence.ts` and `rarity.ts` (not the prose summary) surfaced two unverified issues that must be closed before that verdict stands. Do not re-summarize what was already reported — only report what is asked for below, with real pasted output. If something is broken, say so; do not soften or reframe a failing result as a "known limitation" to make the checklist pass.

---

## Item 1 — confidence.ts: possible specular_highlight overwrite bug

The `specular_highlight` check and the `brightness > maxBrightness` check are separate, unchained `if` statements. Both conditions can be true simultaneously (a specular highlight is by definition `brightness > maxBrightness`), and the second block runs after the first with no `else`, so it can silently overwrite `diagnostic` from `specular_highlight` to `valid_light_object` or `overexposed`.

**Do this:**
1. Write (or locate, if it already exists) a test case with a synthetic pixel region that is bright, low-chroma (<15), high-variance (>200) — i.e. matches the specular_highlight trigger condition.
2. Run `calculateConfidence()` on it directly (unit-level, not through the full pipeline) and print the **final** `diagnostic` and `level` fields.
3. State explicitly: does the final diagnostic read `specular_highlight`, or does it get overwritten by the later brightness block? Paste the raw output.
4. If it is overwritten, do not fix it yet — report the bug with the exact input values used and the actual vs expected diagnostic, and stop. This needs a design decision (should specular check take precedence via early return / else-if?) before a fix is written.

---

## Item 2 — rarity.ts: commit message vs actual diff mismatch

The commit message states this file was only documentation-updated ("document a known limitation... rather than shipping an unverified threshold guess"). The actual diff changes five real values: new ultra-rare band (`L<3`/`L>98`), rare bounds (`L<15/L>90` → `L<8/L>94`, `chroma>=60` → `>=65`), uncommon bounds (`chroma<20` → `<25`, `L<30/L>75` → `L<20/L>85`).

**Do this:**
1. Confirm whether `packages/color-science/src/testHarness.ts` contains ANY test that calls `getRarityTier()`. Search for it directly:
   ```
   grep -n "getRarityTier" packages/color-science/src/testHarness.ts
   ```
   Paste the raw result. If there are zero rarity-specific test calls, state that plainly — this means the 25/25 pass count provides no coverage of this change at all.
2. If rarity tests exist, run the full suite once against the OLD thresholds (`L<15/L>90`, `chroma>=60`, `chroma<20`, `L<30/L>75`, no `L<3/L>98` band) and once against the CURRENT thresholds, and paste both result sets side by side — this is the cross-test sweep that should have happened before this was merged.
3. Regardless of test coverage, manually compute the tier for these five reference colors under OLD vs NEW thresholds and paste the table — pick real values relevant to the spec (e.g. pure sRGB red C*≈105, pure blue C*≈134, a mid-saturation "common" object C*≈40, fluorescent pink C*≈85, metallic gold C*≈63). State plainly whether any of these flip tiers between old and new thresholds.
4. Do not treat the "known limitation" comment as sufficient — it describes a real unsolved problem (chroma alone can't separate vivid primaries from fluorescent/metallic) but the tier logic was still changed underneath it without verification. Flag this as an open item for Day 9/10, not something closed by adding a comment.

---

## Item 3 — Phase 3 "5 runs" — raw output required
The 5-run determinism table in Round 1 was a hand-built markdown table, not pasted terminal output. Rerun and paste the **actual unedited terminal scrollback** for at least 2 of the 5 runs (full stdout, not reformatted).

---

## Item 4 — Build/test ordering
Confirm the compiled `dist/` used by `node dist/testHarness.js` was rebuilt AFTER the CS-001 fix, not stale from before the merge:
```
npm run build --prefix packages/color-science
npm test --prefix packages/color-science
```
Run these two back to back, fresh, and paste both outputs with the actual build output preceding the test output — don't rely on a previous build.

---

## Item 5 — Type name accuracy check
Round 1 report referred to the new diagnostic type as `ConfidenceDiagnostic`. The actual export in the diff is `LightingDiagnostic`. Confirm which name is correct in the current source and correct the record — small, but another reminder not to trust prose summaries over the actual file.

---

## NOT for Antigravity — Jaswin to do directly
Phase 6 (real-device runtime walkthrough, especially iOS Safari camera capture behavior) still has not been done. This cannot be delegated to the coding AI — it requires a physical device. Run:
```
npm run dev -- --host
```
and manually test the capture → color extraction flow on an iPhone via Safari, watching for console errors and confirming the camera permission/capture flow actually works. This is your platform's single biggest known risk and it's the one thing in this whole audit that can't be verified by pasted terminal output.

---

## Sign-off for this round
Do not re-mark Day 9 as unblocked until:
- [ ] specular_highlight overwrite behavior confirmed fixed-or-not-a-bug, with raw output
- [ ] rarity.ts test coverage confirmed (or confirmed absent) and tier-flip table produced
- [ ] 5-run CS-001 verification redone with raw terminal paste
- [ ] build→test ordering confirmed fresh
- [ ] type name discrepancy resolved
- [ ] real-device iOS Safari walkthrough done by Jaswin personally

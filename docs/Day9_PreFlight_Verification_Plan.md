# Day 8 Merge Verification & Pre-Day-9 Audit — Implementation Plan

## Context for executing AI
This repo (`ColorHunt/MVP`, branch `main`) was just updated via `git pull origin main`, which produced a real merge commit (non-fast-forward) between a local WIP state and a partner branch (`23Newboyz`) that claims to resolve CS-001 (`testSameHueKMeans`) and adds Day 7–8 work outside `packages/color-science`. Nothing in this merge has been independently verified yet. Do not trust commit messages, PR descriptions, or prior "PASS" claims as evidence. Every step below must produce pasted, real terminal output. If a step cannot be completed, state that explicitly — do not fabricate output or summarize what "should" happen.

Execute phases in order. Do not skip a phase because a later one looks more relevant. Stop and flag (do not silently resolve) any ambiguous or conflicting result.

---

## Phase 0 — Merge Integrity Check
**Goal:** Confirm the merge didn't silently drop or overwrite work from either side.

```
git log --oneline --graph --all -30
git diff HEAD~1 HEAD --stat
```

Report:
- Full pasted output of both commands.
- Explicit list of files changed in the merge, with line counts (+/-).
- Flag any file under `packages/color-science/` that was touched by a commit NOT authored by Jaswin (this would violate track discipline — partner should not be editing this package).

---

## Phase 1 — Clean Build & Lint
**Goal:** Confirm the merged tree actually builds, not just that git resolved.

```
npm install
npx tsc --noEmit -p packages/color-science
npm run build
npx oxlint .
```

Report:
- Exit code of each command.
- Full output if any command exits non-zero.
- If `npm run build` fails, paste the raw error — do not interpret or summarize it. (Reminder: a broken tsconfig can cause an exit code that looks like a build failure but is actually a resolution failure — check the actual error text, not just pass/fail.)

---

## Phase 2 — Full Test Suite Rerun (color-science package)
**Goal:** Get a real, current pass/fail count. Day 8 ended at 24/25 known-failing on CS-001.

```
cd packages/color-science
npm test -- --verbose
```

Report:
- Full raw test output, every test name and result, not a summary.
- Total pass/fail count.
- Confirm whether the count differs from the pre-merge 24/25 baseline, and if so, which specific test(s) changed status.

---

## Phase 3 — CS-001 Direct Verification (testSameHueKMeans)
**Goal:** The merge commit claims this is fixed. Verify independently — do not accept the commit message as proof.

```
npx vitest run testSameHueKMeans --reporter=verbose
```
(adjust command to match actual test runner if not vitest — check `package.json` test script first and report which runner is actually configured)

Then:
1. Open the diff that touched the k-means logic: `git log --follow -p -- packages/color-science/src/kmeans.ts` (adjust path to actual file) and paste the actual code change, not a description of it.
2. State in plain terms what the fix changed (e.g. initialization method, distance metric, seed handling).
3. Run the test 5 times in a row and paste all 5 outputs — same-hue clustering with k-means++ initialization can be non-deterministic; a single pass is not sufficient evidence of a real fix.

```
for i in 1 2 3 4 5; do npx vitest run testSameHueKMeans --reporter=verbose; done
```

Flag explicitly if results differ across runs.

---

## Phase 4 — Regression Sweep: Known Watch Items from Day 8
These are documented risks that were NOT resolved as of Day 8 end. Confirm current status of each — do not assume the merge fixed them just because CS-001 was touched.

**4a. `testLowChromaDarkObject` (k-means++ bias toward high-chroma pixels)**
```
npx vitest run testLowChromaDarkObject --reporter=verbose
```
Paste output. If passing, paste the diff that changed initialization logic and confirm it doesn't just special-case this one test.

**4b. Weak assertions — Scenarios 2 & 3**
Locate the test file(s) containing Scenario 2 and Scenario 3. Paste the actual assertion code (not a description). For each:
- State what the assertion currently checks.
- State whether it would pass even if the target feature did NOT fire (i.e. is it a tautology or near-tautology).
- If still weak, do not fix silently — write the proposed stronger assertion and flag it for review before applying.

**4c. Undocumented `>= 0.80` boundary change**
```
git log -p --all -S">= 0.80" -- packages/color-science
```
Paste every location where this boundary appears or was changed. For each boundary, run the full test suite once with the boundary at its Day-8 pre-change value and once at current value, and paste both result sets side by side. This is the "full cross-test sweep" — do not approve the boundary change without this comparison.

**4d. `confidence.ts` diagnostics gap**
```
git diff HEAD~5 HEAD -- packages/color-science/src/confidence.ts
```
(adjust commit range to cover the merge)
Report whether granular diagnostics (per-cluster confidence breakdown, rejection reasons, etc.) were added. If not, this is still open — state that explicitly rather than marking it resolved.

---

## Phase 5 — Track Isolation Check
**Goal:** Confirm partner's Day 7–8 work (Collection Mode v0.1, Instagram Story template, UI/game flow) did not touch `packages/color-science` and that your work didn't touch their track.

```
git diff HEAD~1 HEAD --name-only | grep -v "packages/color-science"
git diff HEAD~1 HEAD --name-only | grep "packages/color-science"
```

Report both lists in full. Any unexpected cross-track file should be flagged, not silently accepted.

---

## Phase 6 — Runtime Verification (not just build/lint)
**Goal:** Per established standard, "completed" requires actual execution, not just clean build.

```
npm run dev -- --host
```

Manually walk through (on both desktop browser and a real device via the `--host` LAN URL, specifically testing iOS Safari camera behavior given known platform risk):
1. Photograph capture flow
2. Color extraction / scoring for at least 2 target colors (one high-chroma, one low-chroma/dark to specifically re-test 4a in a live context)
3. Confirm no console errors during the flow (paste console output)

Report pass/fail per step with actual observed behavior, not "should work."

---

## Phase 7 — Dependency Audit
```
npm audit
```
Paste full output. Flag any high/critical vulnerabilities introduced by the merge (compare against pre-merge `npm audit` if available).

---

## Sign-Off Checklist
Do not mark Day 9 as unblocked until every line below is checked against real pasted evidence from above — not inference:

- [ ] Merge integrity confirmed, no cross-track contamination (Phase 0, 5)
- [ ] Clean build + lint (Phase 1)
- [ ] Current test suite pass count captured and compared to 24/25 baseline (Phase 2)
- [ ] CS-001 verified across 5 consecutive runs, actual code diff reviewed (Phase 3)
- [ ] testLowChromaDarkObject status confirmed (4a)
- [ ] Scenario 2 & 3 assertions reviewed, weakness confirmed or disproven with evidence (4b)
- [ ] 0.80 boundary cross-test sweep completed with side-by-side results (4c)
- [ ] confidence.ts diagnostics status confirmed open or closed (4d)
- [ ] Runtime walkthrough completed on real device incl. iOS Safari (Phase 6)
- [ ] npm audit reviewed, no new high/critical issues unaddressed (Phase 7)

Any unchecked item is an open risk to carry into Day 9, not something to assume away.

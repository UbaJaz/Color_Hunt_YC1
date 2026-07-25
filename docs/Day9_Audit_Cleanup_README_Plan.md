# Day 9 — Full Audit, Cleanup, README (Final Structuring Pass)

## Scope guardrail
Fix code only inside `packages/color-science/` (your track). If issues are found in partner's files, list them — do not fix. Doc cleanup at repo root is fine, it's not track-specific.

---

## Phase A — Static audit (tool output only, no claims)
```
npx tsc --noEmit -p packages/color-science
npx oxlint packages/color-science
```
Paste full output. Pass = zero errors/warnings.

---

## Phase B — Dead code / duplication / debug leftovers
```
npx ts-prune -p packages/color-science/tsconfig.json
grep -rn "console.log" packages/color-science/src
grep -rn "TODO\|FIXME\|XXX" packages/color-science/src
```
- Every `ts-prune` hit: confirm genuinely unused (not a public API export) before deleting.
- Every `console.log`: remove or gate behind a debug flag.
- Every TODO/FIXME: fix now if trivial; otherwise move into README "Known Limitations" (Phase F) — don't leave it scattered in code with no tracking.

---

## Phase C — Confirm the specular_highlight fix landed
Don't assume the Round 2 patch was applied — check the working tree:
```
grep -n "specular_highlight" packages/color-science/src/confidence.ts
```
If the `else if` precedence fix isn't present, apply it now before continuing — everything after this phase depends on a correct baseline.

---

## Phase D — Full regression run (evidence gate for README)
```
npm run build --prefix packages/color-science
npm test --prefix packages/color-science
```
Paste full raw output. This is the number that goes in the README — not memory, not the Day 8 baseline.

---

## Phase E — Lightweight perf + doc cleanup

**Perf sanity (Day 10 original scope, compressed):**
```
node -e "console.time('kmeans+ciede2000'); require('./packages/color-science/dist/testHarness.js'); console.timeEnd('kmeans+ciede2000')"
```
If the full harness runs comfortably under ~1s on your dev machine, note it as acceptable-for-now and flag real mid-range-phone testing as deferred (goes in README future work, not silently dropped).

**Document/folder inventory:**
```
find . -name "*.md" -not -path "*/node_modules/*"
diff -rq "dist - Copy" dist
diff -rq "docs - Copy" docs
```
Classify every `.md` as KEEP / ARCHIVE (`/docs/archive`) / DELETE. Paste the table before deleting anything.
The `- Copy` suffixed folders (`dist - Copy`, `docs - Copy`, `packages - Copy`) look like accidental duplication from the merge — confirm via `diff` they're redundant, then delete. Don't delete without checking first.

---

## Phase F — README.md (repo root)
Write only after Phases A–D produce real evidence — cite that output, don't draft from memory then backfill.

Sections:
1. What ColorHunt is (1 paragraph)
2. Current verified state (cite Phase D test count directly)
3. Architecture split: `packages/color-science` vs UI/game-flow
4. Known limitations (Phase B leftovers + rarity.ts chroma-only gap + anything unresolved from Phase A/B)
5. Setup/run instructions
6. Deferred / future work — explicit list: real mid-range-device perf testing, cross-device/lighting testing, 5+ person friend testing session, calibration tuning (Day 6, never shipped), audio, iOS `navigator.vibrate()` non-functional workaround

---

## Sign-off
- [ ] Phase A: 0 errors/warnings
- [ ] Phase B: dead code triaged, not silently deleted
- [ ] Phase C: specular fix confirmed present in working tree
- [ ] Phase D: full suite passes, raw output pasted
- [ ] Phase E: perf sanity noted, doc/folder cleanup table reviewed before deletion
- [ ] Phase F: README written from Phase A–D evidence, includes deferred-work section

# Implementation Plan — Day 8 (Jaswin's Track: Color Science & Signal Processing)

Harden edge cases in the `@color-hunt/color-science` pipeline to ensure accurate, trustworthy color scoring under real-world camera conditions (very dark/light objects, mixed lighting shadows, and reflective specular highlights) while establishing a safe architecture for merging with Friend's Day 8 UI additions.

## User Review Required

> [!IMPORTANT]
> - **Friend's UI Code Isolation**: All changes are strictly confined to `packages/color-science/src/` and its test harness. No existing app screens (`src/screens/*`), components, or game state logic authored by your friend will be mutated.
> - **Zero API Breakage**: The public export interface of `@color-science` (`extractColorFromCanvas`, `calculateConfidence`, `getRarityTier`, `isSuccessfulUnlock`) remains 100% backward-compatible.

## Open Questions

None. The scope is fully determined by `ColorHunt_Build_Plan_Split.md` (Day 8 Jaswin Track) and empirical findings from `testHarness.ts`.

## Proposed Changes

### Packages / Color Science Core (`packages/color-science/src/`)

---

#### [MODIFY] [kmeans.ts](file:///c:/Users/jaswi/Downloads/ColorHunt-Merged/packages/color-science/src/kmeans.ts)
- **Lightness Significance for Low-Chroma Objects**: Update `scoreCluster()` to score clusters using an effective significance metric (`effectiveChroma = Math.max(chroma, lightnessSignificance)`), ensuring low-chroma dark objects ($L < 25$) and light/pastel objects ($L > 80$) are properly extracted without being discarded in favor of background noise.
- **Mixed Lighting Sub-Cluster Merging**: Add hue-cluster grouping ($\Delta h \le 30^\circ$) so that an object split across shadow and highlight regions under mixed lighting accumulates its total effective size ratio instead of getting split and outvoted by background noise.
- **Specular Highlight Penalty**: Explicitly penalize small ($< 8\%$ of sampled region) glare clusters with high lightness ($L > 90$) and low chroma ($\text{chroma} < 15$) to prevent gloss reflections from distorting extracted object colors.

---

#### [MODIFY] [confidence.ts](file:///c:/Users/jaswi/Downloads/ColorHunt-Merged/packages/color-science/src/confidence.ts)
- **Lighting Diagnostic Granularity**: Enhance `calculateConfidence()` to provide granular diagnostic messages and distinguish between bad lighting (e.g. extreme underexposure $L < 15$ or overexposure $L > 92$) vs naturally dark/light valid colors.

---

#### [MODIFY] [browser.ts](file:///c:/Users/jaswi/Downloads/ColorHunt-Merged/packages/color-science/src/browser.ts) & [index.ts](file:///c:/Users/jaswi/Downloads/ColorHunt-Merged/packages/color-science/src/index.ts)
- Ensure all Day 6, Day 7, and Day 8 color science utilities are cleanly exported for seamless consumption by Friend's upcoming Day 8 screens (personal palette, game history, settings).

---

#### [MODIFY] [testHarness.ts](file:///c:/Users/jaswi/Downloads/ColorHunt-Merged/packages/color-science/src/testHarness.ts)
- Add comprehensive test cases for overexposed light objects, dark objects, specular highlight glares, mixed-lighting shadow/highlight splits, and confidence diagnostics.

## Verification Plan

### Automated Tests
1. **Color Science Build & Test Suite**:
   ```powershell
   npm --prefix packages/color-science run build; if ($?) { npm --prefix packages/color-science test }
   ```
   - Verify that all synthetic math tests, dim-lighting tests, red-berry/green-leaf regression tests, white-balance tests, bonus voting tests, and real image tests pass cleanly without failures or flags.
   - Specifically verify that Scenario 2 (Overexposed object $L=92$, low chroma) passes cleanly without flagging.

2. **Full App TypeScript & Bundle Verification**:
   ```powershell
   npm run build
   ```
   - Verify that the React/Vite app compiles cleanly with 0 TypeScript errors.

3. **Linter Verification**:
   ```powershell
   npx oxlint
   ```
   - Verify 0 linting errors.

### Manual Verification
- Confirm that existing UI components in `src/` remain completely untouched and fully functional.

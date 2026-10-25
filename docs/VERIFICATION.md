# Verification log

Moved from the README.

## Verified state (2026-07-25)

Verified on 2026-07-25 against the `packages/color-science` track.

**Phase A — Static analysis:** `tsc --noEmit` and `oxlint` both exit zero. 0 type errors, 0 lint warnings across 17 source files.

**Phase D — Test suite:** All sections pass (fresh `tsc` build followed by `node dist/testHarness.js`). The harness has no single aggregate counter — each section reports its own count: `bonusVoting` 5/5, `rarityTierClassification` 16/16, `unlockLogic` 8/8, `confidenceDiagnostics` 6/6 (includes the new specular-highlight regression test). All other listed checks below also pass per raw harness output.

Test coverage includes:
- Synthetic CIEDE2000 color matching (5 objects × 10 targets)
- Dim-lighting k-means bug regression (83% dull / 17% saturated)
- Same-hue size-penalty isolation
- Red-berry / green-leaf foreground isolation regression
- `calculateSizeFactor` unit test with graduated ramp verification
- White-balance calibration (4 cases)
- Bonus voting multiplier (5 cases)
- Low-chroma dark object extraction (lightness significance)
- Lighting stress scenarios (5 scenarios)
- Rarity tier classification (16 reference colors)
- Successful unlock gate logic (8 cases)
- Confidence diagnostics with object-aware dark/light detection — **including specular highlight overwrite guard** (6 cases)
- Real-image pipeline: 3 × 1920 × 1000 px JPEG inputs (real-red, real-green, real-blue)

**Phase E — Perf sanity:** Full harness (including 3 real 1920 × 1000 px images) completes in **226 ms** on a dev machine. Acceptable for development; real mid-range device benchmarking is deferred (see Deferred Work below).

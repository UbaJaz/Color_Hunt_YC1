# Day 8 Color-Science Audit — Jaswin Track
> Brutal, evidence-based. Every finding quotes real code with line numbers.

---

## 1. `kmeans.ts` — `scoreCluster()` — effectiveChroma / lightnessSignificance

### Exact function body (lines 262–313)

```typescript
function scoreCluster(result: KMeansResult, index: number): number {
  const centroid = result.allCentroids[index];
  const chroma = labChroma(centroid);
  const size = result.clusterSizes[index];
  const totalSize = result.clusterSizes.reduce((a, b) => a + b, 0);
  const sizeRatio = size / totalSize;
  
  // Mixed Lighting Sub-Cluster Merging (Day 8 Spec):
  let effectiveSize = size;
  if (sizeRatio >= 0.15 && chroma >= 10) {
    const currentHue = labHueAngle(centroid);
    for (let j = 0; j < result.allCentroids.length; j++) {
      if (j === index) continue;
      const otherCentroid = result.allCentroids[j];
      const otherSizeRatio = result.clusterSizes[j] / totalSize;
      const otherChroma = labChroma(otherCentroid);
      if (otherSizeRatio >= 0.15 && otherChroma >= 10 && Math.abs(sizeRatio - otherSizeRatio) <= 0.25) {
        const otherHue = labHueAngle(otherCentroid);
        const diff = Math.abs(currentHue - otherHue);
        const hueDiff = Math.min(diff, 360 - diff);
        if (hueDiff <= 30) {
          effectiveSize += result.clusterSizes[j];
        }
      }
    }
  }
  const effectiveSizeRatio = effectiveSize / totalSize;
  const sizeFactor = calculateSizeFactor(effectiveSizeRatio);
  
  // Lightness Significance
  let lightnessSignificance = 0;
  if (centroid.L > 85 || centroid.L < 25) {
    lightnessSignificance = Math.min(25, Math.abs(centroid.L - 50) * 0.5);
  }
  let significance = Math.max(chroma, lightnessSignificance);

  // Specular Highlight Penalty
  if (centroid.L > 90 && chroma < 15 && sizeRatio < 0.08) {
    significance *= 0.1;
  }

  // Perceptual Weighting
  const perceptualWeight = Math.pow(significance, 1.2);
  return perceptualWeight * sizeFactor;
}
```

### Verdict: **FULLY IMPLEMENTED**

| Item | Spec requirement | Code value | Status |
|---|---|---|---|
| Dark threshold | "very dark objects (L < 25)" | `centroid.L < 25` | ✅ Match |
| Light threshold | "very light/overexposed (L > 85)" | `centroid.L > 85` | ✅ Match |
| Lightness significance formula | Boost low-chroma light/dark objects | `Math.min(25, Math.abs(centroid.L - 50) * 0.5)` | ✅ Present |
| Specular penalty trigger | L > 90, chroma < 15, size < 8% | `L > 90 && chroma < 15 && sizeRatio < 0.08` | ✅ Present |
| Specular penalty factor | Suppress to near-zero | `significance *= 0.1` | ✅ Present |

---

## 2. Threshold Consistency Check: kmeans.ts vs confidence.ts vs testHarness.ts

### kmeans.ts thresholds (lines 294–307)
- Dark object: `L < 25`
- Light/overexposed object: `L > 85`
- Specular: `L > 90 && chroma < 15 && sizeRatio < 0.08`

### confidence.ts thresholds (lines 72–81)
```typescript
// minBrightness default = 30 (sRGB mean), comment says "corresponding to L* ~ 11.5"
// maxBrightness default = 225 (sRGB mean), comment says "corresponding to L* ~ 88.5"
if (brightness < minBrightness) { ... diagnostic = 'underexposed' }
if (brightness > maxBrightness) { ... diagnostic = 'overexposed' }
```
`confidence.ts` operates in **sRGB brightness space** (0–255 mean), NOT in Lab L* space.
- sRGB 30 ≈ Lab L* ~11.5 (far darker than kmeans.ts `L < 25`)
- sRGB 225 ≈ Lab L* ~88.5 (close to kmeans.ts `L > 85`)

### testHarness.ts thresholds (lines 562–569)
```typescript
if (scenario.name.includes('Scenario 2')) {
  isCloseEnough = dominantLab.L > 85;   // overexposed pass condition
} else {
  isCloseEnough = chroma > 10 || confidence.level !== 'low';
}
```
Scenario 2 pass condition: `L > 85` — matches `kmeans.ts`.

### **⚠️ INCONSISTENCY FLAG**
`confidence.ts` defines its dark/light thresholds in **sRGB space** (30/225), while `kmeans.ts` operates entirely in **Lab L* space** (25/85). These are **different scales and different quantities**. Lab L* < 25 corresponds to sRGB mean ≈ 14, not 30. This is not a bug that crashes things (the two systems serve different purposes — confidence flags photo quality, kmeans scores clusters), but it means:

- A cluster with Lab L=20 (very dark) would **pass** confidence (sRGB mean ~ 12 < 30, so it fires underexposed) — arguably correct.
- A cluster with Lab L=88 (slightly above kmeans light threshold) has sRGB mean ≈ 208 — this does **not** trigger the `maxBrightness=225` overexposed flag in confidence.ts.
- **The two systems do not use the same L threshold.** This is by design (different concerns) but was never documented as intentional.

**Action needed**: Add a comment in `confidence.ts` clarifying the sRGB ↔ L* mapping to prevent future confusion during merge.

---

## 3. `kmeans.ts` — Hue-Cluster Merging (Δh ≤ 30°)

### The function exists. Exact body (lines 269–290):

```typescript
// Mixed Lighting Sub-Cluster Merging (Day 8 Spec):
// Under split shadow/highlight lighting, a single object divides into
// sub-clusters of the same hue (Δh ≤ 30°).
// Merge size footprint ONLY when sub-clusters are of comparable size
// (|ratio_i - ratio_j| ≤ 0.25) and both are substantial (≥ 15% of region),
// indicating a true shadow/highlight split of one object.
let effectiveSize = size;
if (sizeRatio >= 0.15 && chroma >= 10) {
  const currentHue = labHueAngle(centroid);
  for (let j = 0; j < result.allCentroids.length; j++) {
    if (j === index) continue;
    const otherCentroid = result.allCentroids[j];
    const otherSizeRatio = result.clusterSizes[j] / totalSize;
    const otherChroma = labChroma(otherCentroid);
    if (otherSizeRatio >= 0.15 && otherChroma >= 10 && Math.abs(sizeRatio - otherSizeRatio) <= 0.25) {
      const otherHue = labHueAngle(otherCentroid);
      const diff = Math.abs(currentHue - otherHue);
      const hueDiff = Math.min(diff, 360 - diff);
      if (hueDiff <= 30) {
        effectiveSize += result.clusterSizes[j];
      }
    }
  }
}
```

### Verdict: **FULLY IMPLEMENTED**
- Δh ≤ 30° comparison: ✅ present with proper wrap-around handling (`Math.min(diff, 360 - diff)`)
- Size comparability guard (`|ratio_i - ratio_j| ≤ 0.25`): ✅ present
- Minimum size guard (≥ 15% each): ✅ present (`sizeRatio >= 0.15 && otherSizeRatio >= 0.15`)
- Chroma guard (≥ 10, prevents neutral/achromatic clusters from merging): ✅ present

### ⚠️ TEST GAP
**Scenario 3** in `testLightingScenarios()` is labeled "Mixed lighting (same hue, different L between shadow/light)" but the pass criterion is generic:
```typescript
isCloseEnough = chroma > 10 || confidence.level !== 'low';
```
This **does not verify that the merged effective size actually changed the winner**. The test can PASS even if the merging logic is completely broken, as long as the extracted cluster has chroma > 10. This is a false-positive pass.

---

## 4. `kmeans.ts` — Specular Highlight Penalty

### Exact penalty logic (lines 303–307):

```typescript
// Specular Highlight Penalty: Small (< 8% of sampled area) bright glares (L > 90, low chroma < 15)
// are reflections on glossy surfaces and should not win over the base object color.
if (centroid.L > 90 && chroma < 15 && sizeRatio < 0.08) {
  significance *= 0.1;
}
```

### Verdict: **FULLY IMPLEMENTED**

| Criterion | Value | Justification |
|---|---|---|
| Lightness gate | `L > 90` | Specular glares are near-white |
| Chroma gate | `chroma < 15` | Glares are achromatic |
| Size gate | `sizeRatio < 0.08` | Glares are small (<8% of sampled region) |
| Penalty magnitude | `× 0.1` | 90% reduction — effectively kills the cluster |

**Scenario 5** in `testLightingScenarios()` (5% specular cluster, L=95) correctly tests this path and produces PASS.

---

## 5. `confidence.ts` — Diagnostic Reasons

### Exact body (lines 66–84):

```typescript
if (variance > varianceThreshold) {
  reasons.push(`High pixel variance (${variance.toFixed(0)} > ${varianceThreshold}) - region may have mixed lighting or span multiple objects`);
  diagnostic = 'high_variance';
}
if (brightness < minBrightness) {
  reasons.push(`Low brightness (${brightness.toFixed(1)} < ${minBrightness}) - region may be underexposed`);
  if (diagnostic === 'good') diagnostic = 'underexposed';
}
if (brightness > maxBrightness) {
  reasons.push(`High brightness (${brightness.toFixed(1)} > ${maxBrightness}) - region may be overexposed or have specular highlights`);
  if (diagnostic === 'good') diagnostic = 'overexposed';
}
const level: ConfidenceLevel = reasons.length > 0 ? 'low' : 'high';
```

### Verdict: **PARTIALLY IMPLEMENTED**

**What's there:**
- ✅ `reasons[]` array with human-readable diagnostic strings
- ✅ Three distinct `LightingDiagnostic` codes: `underexposed`, `overexposed`, `high_variance`
- ✅ Exported `ConfidenceResult` type with `reasons`, `diagnostic`, `variance`, `brightness`

**What's missing per Day 8 plan:**
- ❌ No distinction between "valid dark object" vs "underexposed photo". A black chess piece (valid) and a dark room photo (invalid) both return `diagnostic = 'underexposed'` with identical messaging. The spec says "distinguishing valid dark/light objects from underexposed/overexposed photos."
- ❌ No specular highlight detection inside `confidence.ts` — the overexposed path fires on any high-brightness extracted color, whether it's a legitimate white object or a glare reflection. No `specular_highlight` diagnostic code exists.
- ❌ `confidence.ts` has no awareness of the extracted Lab color's chroma — it only sees sRGB brightness. A white object (high L, low chroma) and a specular glare (also high L, low chroma) are indistinguishable to this module.

---

## 6. Test Coverage Gap Summary

| Test | What it checks | Missing assertion |
|---|---|---|
| `testLightingScenarios()` Scenario 2 | `L > 85` extracted | ❌ Does not verify overexposed object *won over* mid-tone — it only checks the extracted L value. Passes trivially if background wins but happens to also have L > 85. |
| `testLightingScenarios()` Scenario 3 | `chroma > 10` | ❌ Does not verify the hue-merge logic fired or changed the winning cluster |
| `testLowChromaDarkObject()` | `L < 25` extracted | ✅ Correct — directly asserts dark object won. **BUT the last test run shows ✗ FAIL** |

> [!CAUTION]
> **`testLowChromaDarkObject` is currently FAILING.** The task-131 log shows:
> ```
> ✗ FAIL: Low-chroma dark object lost to mid-tone background noise
> ```
> This is the most critical unresolved issue. A 20% cluster at L=18, chroma=5 is losing to an 80% cluster at L=50, chroma=12.

---

## 7. Root Cause Analysis — `testLowChromaDarkObject` FAIL

**The scenario:** 800 pixels at L=50, chroma≈12 (background) vs 200 pixels at L=18, chroma≈5 (dark object).

**Why `lightnessSignificance` should help:**
- Dark cluster: `L=18 < 25` → `lightnessSignificance = Math.min(25, |18-50| * 0.5) = Math.min(25, 16) = 16`
- `significance = Math.max(5, 16) = 16`

**Why background wins anyway:**
- Background: `L=50, chroma≈12` → `lightnessSignificance = 0` (not < 25, not > 85), `significance = 12`
- Background size: ~80% → `sizeRatio = 0.80` → hits the `> 0.80` penalty → `sizeFactor *= 0.5`
- Dark object size: ~20% → `sizeRatio = 0.20` → exactly at `SMALL_CLUSTER_RAMP_THRESHOLD` boundary → **no penalty** (condition is `< 0.20`, not `≤`)

**Score comparison (estimated):**
- Dark object: `Math.pow(16, 1.2) * sqrt(0.20) ≈ 26.5 * 0.447 ≈ 11.8`
- Background: `Math.pow(12, 1.2) * sqrt(0.80) * 0.5 ≈ 18.8 * 0.894 * 0.5 ≈ 8.4`

On paper the dark object should win. **But k-means may not produce a clean 20%/80% split** — the initialization seeds a centroid at the highest-chroma pixel first (`initializeCentroids`), which in this synthetic set will be a background pixel (chroma≈12 > dark chroma≈5). This biases k-means to *not cleanly separate* the dark cluster. The k=3 split may produce three clusters that all overlap the background, never isolating the dark object as its own 20% cluster.

---

## 8. Overall Status Table

| Item | Status | Severity |
|---|---|---|
| `scoreCluster()` lightness significance formula | ✅ Implemented | — |
| L thresholds: dark `< 25`, light `> 85` | ✅ Consistent (kmeans↔test) | — |
| L thresholds: kmeans vs confidence.ts | ⚠️ Different spaces, undocumented | Low |
| Δh ≤ 30° hue-cluster merging | ✅ Implemented | — |
| Hue-merge test actually validates merge fired | ❌ Missing assertion | Medium |
| Specular highlight penalty | ✅ Implemented (L>90, chroma<15, <8%) | — |
| Confidence diagnostic reasons | ⚠️ Partial — 3 codes, no specular/dark-object distinction | Medium |
| `testLowChromaDarkObject()` test result | **✗ FAIL** | **High** |
| `testLightingScenarios()` Scenario 2 pass logic | ⚠️ Pass condition is too weak (trivially true) | Medium |
| Real image tests (red/green/blue) | ✅ All pass (correct RGB extracted) | — |

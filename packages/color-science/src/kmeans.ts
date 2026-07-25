// K-means clustering for color extraction
// Pure function - browser portable (works with any Lab array)
// Uses Lab space for perceptually uniform clustering

import { Lab, KMeansResult } from './types.js';

// DESIGN DECISION: Small cluster penalty threshold
// Clusters below 20% of total pixels get a graduated penalty to prevent
// small high-chroma noise clusters (e.g., specular highlights) from winning
// over larger representative clusters.
const SMALL_CLUSTER_RAMP_THRESHOLD = 0.20;

// DESIGN DECISION: Hue divergence threshold
// If the best-scoring cluster's hue diverges by more than 90 degrees from the
// largest cluster's hue, prefer the larger cluster instead. This prevents
// picking noise clusters with totally different hues from the actual object.
const HUE_DIVERGENCE_THRESHOLD_DEG = 90;

// DESIGN DECISION: Size threshold for hue-consistency check
// Only apply hue-consistency check when the best cluster is smaller than this
// fraction of total pixels, to avoid overriding legitimate choices when clusters
// are similar in size.
const HUE_CHECK_SIZE_THRESHOLD = 0.25;

// DESIGN DECISION: Chroma threshold for hue-consistency check
// Only apply hue-consistency check when the largest cluster has sufficient chroma
// (colorfulness). This prevents the hue check from incorrectly preferring a large
// dull background over a small vivid object (e.g., red berry against green leaf).
// If the largest cluster is dull/neutral (low chroma), it's likely a background
// and shouldn't override a small high-chroma foreground object.
// Raised to 60 after regression testing to prevent moderately colorful backgrounds
// (e.g., green leaves with chroma ~40) from overriding very vivid small objects
// (e.g., red berries with chroma ~70).
const HUE_CHECK_CHROMA_THRESHOLD = 60;

/**
 * Calculate Euclidean distance between two Lab colors
 */
function labDistance(c1: Lab, c2: Lab): number {
  return Math.sqrt(
    Math.pow(c1.L - c2.L, 2) +
    Math.pow(c1.a - c2.a, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * Calculate chroma (colorfulness/saturation) of a Lab color
 */
function labChroma(c: Lab): number {
  return Math.sqrt(c.a * c.a + c.b * c.b);
}

/**
 * Calculate hue angle in degrees from Lab a,b coordinates
 * Returns value in [0, 360) range
 */
function labHueAngle(lab: Lab): number {
  const hue = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  return hue < 0 ? hue + 360 : hue;
}

/**
 * Calculate size factor for cluster scoring
 * Applies graduated penalty for small clusters and penalty for overly large clusters
 * @param sizeRatio - Fraction of total pixels in this cluster (0-1)
 * @returns Size factor (0-1, higher is better)
 */
export function calculateSizeFactor(sizeRatio: number): number {
  // Base size factor: use sqrt for a gentle falloff for most sizes
  let sizeFactor = Math.sqrt(sizeRatio);
  
  // AUDIT FIX: Make the penalty steeper below threshold.
  // Using (ratio/threshold)^2 * 0.5 creates a much sharper drop for small clusters,
  // ensuring that noise (usually <10%) cannot beat representative clusters (20%+).
  if (sizeRatio < SMALL_CLUSTER_RAMP_THRESHOLD) {
    const ratio = sizeRatio / SMALL_CLUSTER_RAMP_THRESHOLD;
    sizeFactor *= (ratio * ratio) * 0.5;
  }
  
  // Penalty for clusters that dominate ≥ 80% of the image.
  // Uses >= (not >) so that hue-merged background pairs that sum to exactly 80%
  // are also penalised. Without this, a merged 80% background avoids the penalty
  // entirely and can outscore a 20% dark/light object whose lightness significance
  // is the correct winner.
  if (sizeRatio >= 0.80) {
    sizeFactor *= 0.5;
  }
  
  return sizeFactor;
}

// DESIGN DECISION: First-centroid seeding strategies for multi-run k-means.
// Every run gets a DIFFERENT anchor pixel as its first centroid so that dark,
// light, and low-chroma clusters all get at least one run where k-means can
// cleanly separate them. Without this, runs that always seed on the
// highest-chroma pixel never produce a clean cluster for achromatic dark or
// light objects, so scoreCluster()'s lightness significance boost never fires
// on a properly isolated centroid.
export const enum SeedStrategy {
  HighestChroma = 0, // Most colorful pixel — classic k-means++ anchor
  DarkestPixel  = 1, // Lowest L — gives dark objects a seeding run
  LightestPixel = 2, // Highest L — gives overexposed/light objects a seeding run
  MaxSpread     = 3, // Pixel furthest from dataset mean — maximises initial spread
}

/**
 * Pick the first centroid pixel according to the requested seeding strategy.
 * The strategy rotates across k-means runs so that every run explores a
 * different region of Lab space as its starting point.
 */
function pickFirstCentroid(pixels: Lab[], strategy: SeedStrategy): number {
  switch (strategy) {
    case SeedStrategy.DarkestPixel: {
      let idx = 0, minL = Infinity;
      for (let i = 0; i < pixels.length; i++) {
        if (pixels[i].L < minL) { minL = pixels[i].L; idx = i; }
      }
      return idx;
    }
    case SeedStrategy.LightestPixel: {
      let idx = 0, maxL = -Infinity;
      for (let i = 0; i < pixels.length; i++) {
        if (pixels[i].L > maxL) { maxL = pixels[i].L; idx = i; }
      }
      return idx;
    }
    case SeedStrategy.MaxSpread: {
      // Compute dataset mean then pick the pixel furthest from it
      let sumL = 0, sumA = 0, sumB = 0;
      for (const p of pixels) { sumL += p.L; sumA += p.a; sumB += p.b; }
      const n = pixels.length;
      const mean: Lab = { L: sumL / n, a: sumA / n, b: sumB / n };
      let idx = 0, maxDist = -1;
      for (let i = 0; i < pixels.length; i++) {
        const d = labDistance(pixels[i], mean);
        if (d > maxDist) { maxDist = d; idx = i; }
      }
      return idx;
    }
    case SeedStrategy.HighestChroma:
    default: {
      let idx = 0, maxChroma = -1;
      for (let i = 0; i < pixels.length; i++) {
        const c = labChroma(pixels[i]);
        if (c > maxChroma) { maxChroma = c; idx = i; }
      }
      return idx;
    }
  }
}

/**
 * Initialize k centroids using k-means++ with a strategy-specific first anchor.
 * @param pixels - Lab pixel array
 * @param k - number of clusters
 * @param strategy - which pixel to use as the first centroid seed
 * @param kppOffset - deterministic offset for k-means++ subsequent centroid selection
 */
function initializeCentroids(
  pixels: Lab[],
  k: number,
  strategy: SeedStrategy = SeedStrategy.HighestChroma,
  kppOffset: number = 0
): Lab[] {
  if (pixels.length === 0) return [];
  if (k <= 1) return [pixels[0]];

  const centroids: Lab[] = [];

  // First centroid chosen by the seeding strategy for this run
  const firstIndex = pickFirstCentroid(pixels, strategy);
  centroids.push({ ...pixels[firstIndex] });

  // k-means++ for remaining centroids: probabilistically pick pixels
  // that are far from already-chosen centroids, using a deterministic offset
  // so results are reproducible across runs.
  for (let i = 1; i < k; i++) {
    const distances = pixels.map(p => {
      const minDist = Math.min(...centroids.map(c => labDistance(p, c)));
      return minDist * minDist;
    });

    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let target = ((totalDist / k) * (i + kppOffset)) % totalDist;

    let selectedIndex = 0;
    let cumulative = 0;
    for (let j = 0; j < distances.length; j++) {
      cumulative += distances[j];
      if (cumulative >= target) {
        selectedIndex = j;
        break;
      }
    }

    centroids.push({ ...pixels[selectedIndex] });
  }

  return centroids;
}

/**
 * Assign each pixel to the nearest centroid
 */
function assignClusters(pixels: Lab[], centroids: Lab[]): number[] {
  return pixels.map(pixel => {
    let minDist = Infinity;
    let clusterIndex = 0;
    
    for (let i = 0; i < centroids.length; i++) {
      const dist = labDistance(pixel, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        clusterIndex = i;
      }
    }
    
    return clusterIndex;
  });
}

/**
 * Recalculate centroids as the mean of assigned pixels
 */
function recalculateCentroids(pixels: Lab[], assignments: number[], k: number): Lab[] {
  const newCentroids: Lab[] = [];
  const sums: Lab[] = Array(k).fill(null).map(() => ({ L: 0, a: 0, b: 0 }));
  const counts: number[] = Array(k).fill(0);

  for (let i = 0; i < pixels.length; i++) {
    const cluster = assignments[i];
    sums[cluster].L += pixels[i].L;
    sums[cluster].a += pixels[i].a;
    sums[cluster].b += pixels[i].b;
    counts[cluster]++;
  }

  for (let i = 0; i < k; i++) {
    if (counts[i] > 0) {
      newCentroids.push({
        L: sums[i].L / counts[i],
        a: sums[i].a / counts[i],
        b: sums[i].b / counts[i]
      });
    } else {
      // Deterministic fallback for empty cluster: pick pixel furthest from existing newCentroids
      let maxMinDist = -1;
      let bestPixelIndex = 0;
      for (let j = 0; j < pixels.length; j++) {
        const p = pixels[j];
        const minDist = newCentroids.length > 0
          ? Math.min(...newCentroids.map(c => labDistance(p, c)))
          : 0;
        if (minDist > maxMinDist) {
          maxMinDist = minDist;
          bestPixelIndex = j;
        }
      }
      newCentroids.push({ ...pixels[bestPixelIndex] });
    }
  }

  return newCentroids;
}

/**
 * Check if centroids have converged
 */
function hasConverged(oldCentroids: Lab[], newCentroids: Lab[], threshold: number = 0.1): boolean {
  for (let i = 0; i < oldCentroids.length; i++) {
    if (labDistance(oldCentroids[i], newCentroids[i]) > threshold) {
      return false;
    }
  }
  return true;
}

/**
 * Run a single k-means iteration with a given seeding strategy.
 * @param strategy - which pixel to use as the first centroid seed
 * @param kppOffset - deterministic offset for k-means++ subsequent centroid picks
 */
function runKMeans(
  pixels: Lab[],
  k: number,
  maxIterations: number,
  strategy: SeedStrategy,
  kppOffset: number
): KMeansResult {
  let centroids = initializeCentroids(pixels, k, strategy, kppOffset);
  let assignments: number[] = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    assignments = assignClusters(pixels, centroids);
    const newCentroids = recalculateCentroids(pixels, assignments, k);

    if (hasConverged(centroids, newCentroids)) {
      centroids = newCentroids;
      break;
    }

    centroids = newCentroids;
  }

  // Calculate cluster sizes
  const clusterSizes = Array(k).fill(0);
  for (const assignment of assignments) {
    clusterSizes[assignment]++;
  }

  // Default dominantIndex to highest-chroma cluster for backward compatibility.
  // The real winner is chosen by scoreCluster() in extractDominantColor().
  const chromas = centroids.map(c => labChroma(c));
  const maxChromaIndex = chromas.indexOf(Math.max(...chromas));

  return {
    centroid: centroids[maxChromaIndex],
    clusterSizes,
    allCentroids: centroids,
    assignments,
    dominantIndex: maxChromaIndex
  };
}

/**
 * Score a specific cluster within a k-means result
 */
function scoreCluster(result: KMeansResult, index: number): number {
  const centroid = result.allCentroids[index];
  const chroma = labChroma(centroid);
  const size = result.clusterSizes[index];
  const totalSize = result.clusterSizes.reduce((a, b) => a + b, 0);
  const sizeRatio = size / totalSize;
  
  // Mixed Lighting Sub-Cluster Merging (Day 8 Spec):
  // Under split shadow/highlight lighting, a single object divides into sub-clusters of the same hue (Δh ≤ 30°).
  // Merge size footprint ONLY when sub-clusters are of comparable size (|ratio_i - ratio_j| ≤ 0.25),
  // comparable chroma (a true shadow/highlight split of one surface changes L, not saturation, much),
  // and both are substantial (≥ 15% of region), indicating a true shadow/highlight split of one object.
  //
  // CS-001 root cause (confirmed via instrumented run during Day 9 investigation):
  // k-means sometimes splits ONE large, comparably-sized cluster (e.g. an 83%-of-frame dull-orange
  // background) into two noisy halves of similar size. A separate, small, genuinely more saturated
  // object (e.g. a 17% vivid-orange object) can coincidentally fall within the size-proximity and
  // hue-proximity windows of one of those halves purely by chance of how k-means split the larger
  // cluster — even though it is not a lighting split of the same physical surface. Without a chroma
  // check, that small vivid cluster's effective size got inflated by merging with a half of the
  // unrelated large cluster, which pushed its size factor above the small-cluster penalty entirely
  // and let it outscore the true dominant color. Requiring the two candidate clusters' chroma to be
  // within a shadow/highlight-plausible range (ratio ≤ 1.6, i.e. at most 60% more saturated) preserves
  // the legitimate shadow/highlight merges (Scenario 3, dim-lighting split) while blocking merges with
  // a distinctly more saturated, unrelated object.
  const CHROMA_PROXIMITY_MAX_RATIO = 1.6;
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
        const chromaRatio = Math.max(chroma, otherChroma) / Math.min(chroma, otherChroma);
        if (hueDiff <= 30 && chromaRatio <= CHROMA_PROXIMITY_MAX_RATIO) {
          effectiveSize += result.clusterSizes[j];
        }
      }
    }
  }
  const effectiveSizeRatio = effectiveSize / totalSize;
  const sizeFactor = calculateSizeFactor(effectiveSizeRatio);
  
  // Lightness Significance: For light/overexposed (L > 85) or dark (L < 25) low-chroma objects,
  // evaluate lightness contrast relative to mid-tone neutral (L=50) so valid light/dark objects
  // are not outvoted by colorful background noise.
  let lightnessSignificance = 0;
  if (centroid.L > 85 || centroid.L < 25) {
    lightnessSignificance = Math.min(25, Math.abs(centroid.L - 50) * 0.5);
  }
  let significance = Math.max(chroma, lightnessSignificance);

  // Specular Highlight Penalty: Small (< 8% of sampled area) bright glares (L > 90, low chroma < 15)
  // are reflections on glossy surfaces and should not win over the base object color.
  if (centroid.L > 90 && chroma < 15 && sizeRatio < 0.08) {
    significance *= 0.1;
  }

  // Perceptual Weighting: Significance^1.2 gives vivid colors appropriate weight over dull foliage/backgrounds
  const perceptualWeight = Math.pow(significance, 1.2);

  return perceptualWeight * sizeFactor;
}

/**
 * Extract dominant color using stabilized k-means clustering in Lab space
 * Runs multiple times with deterministic seeds and picks the best result
 * @param pixels - Array of Lab pixel values
 * @param k - Number of clusters (default: 3)
 * @param maxIterations - Maximum iterations per run (default: 100)
 * @param numRuns - Number of k-means runs (default: 5)
 * @returns K-means result with dominant centroid, cluster sizes, and all centroids
 */
export function extractDominantColor(
  pixels: Lab[],
  k: number = 3,
  maxIterations: number = 100,
  numRuns: number = 5
): KMeansResult {
  if (pixels.length === 0) {
    throw new Error('Cannot extract color from empty pixel array');
  }

  // Run k-means multiple times, each with a DIFFERENT first-centroid strategy.
  // This ensures that dark, light, and low-chroma clusters all get at least one
  // run where they are seeded as the starting anchor, giving scoreCluster()'s
  // lightness significance boost a properly isolated centroid to evaluate.
  //
  // Strategy assignment across runs:
  //   Run 0: HighestChroma — classic behavior, vivid objects
  //   Run 1: DarkestPixel  — gives dark/low-chroma objects a dedicated run
  //   Run 2: LightestPixel — gives overexposed/white objects a dedicated run
  //   Run 3: MaxSpread     — maximises initial cluster separation
  //   Run 4+: HighestChroma — fall back to classic for extra stability runs
  const strategies: SeedStrategy[] = [
    SeedStrategy.HighestChroma,
    SeedStrategy.DarkestPixel,
    SeedStrategy.LightestPixel,
    SeedStrategy.MaxSpread,
  ];
  const results: KMeansResult[] = [];
  for (let run = 0; run < numRuns; run++) {
    const strategy = strategies[run] ?? SeedStrategy.HighestChroma;
    results.push(runKMeans(pixels, k, maxIterations, strategy, run));
  }

  // AUDIT FIX: Evaluate ALL clusters across ALL runs to find the global best.
  // Previously, we only looked at the most chromatic cluster of each run,
  // which prevented larger but slightly less colorful clusters from ever winning.
  let bestRunIndex = 0;
  let bestClusterIndex = results[0].dominantIndex;
  let bestScore = -Infinity;

  for (let r = 0; r < results.length; r++) {
    for (let c = 0; c < k; c++) {
      const score = scoreCluster(results[r], c);
      if (score > bestScore) {
        bestScore = score;
        bestRunIndex = r;
        bestClusterIndex = c;
      }
    }
  }

  const bestResult = results[bestRunIndex];
  bestResult.dominantIndex = bestClusterIndex;
  bestResult.centroid = bestResult.allCentroids[bestClusterIndex];

  // Hue-consistency sanity check: if the best-scoring cluster's hue diverges
  // significantly from the largest cluster's hue, prefer the larger cluster.
  // This prevents picking small high-chroma noise clusters with wrong hues.
  // Only apply this check if the best cluster is significantly smaller than
  // the largest cluster (less than 25% of total pixels), to avoid overriding
  // legitimate choices when clusters are similar in size.
  const totalSize = bestResult.clusterSizes.reduce((a, b) => a + b, 0);
  const bestSize = bestResult.clusterSizes[bestResult.dominantIndex];
  const bestSizeRatio = bestSize / totalSize;

  if (bestSizeRatio < HUE_CHECK_SIZE_THRESHOLD) {
    const largestClusterIndex = bestResult.clusterSizes.indexOf(Math.max(...bestResult.clusterSizes));
    if (largestClusterIndex !== bestResult.dominantIndex) {
      const bestHue = labHueAngle(bestResult.centroid);
      const largestHue = labHueAngle(bestResult.allCentroids[largestClusterIndex]);
      const hueDivergence = Math.abs(bestHue - largestHue);
      // Handle wrap-around at 360°
      const adjustedDivergence = Math.min(hueDivergence, 360 - hueDivergence);

      if (adjustedDivergence > HUE_DIVERGENCE_THRESHOLD_DEG) {
        const largestCentroid = bestResult.allCentroids[largestClusterIndex];
        const largestChroma = labChroma(largestCentroid);
        
        // AUDIT FIX: Only apply hue override if the largest cluster has sufficient chroma.
        // This prevents the hue check from incorrectly preferring a large dull background
        // over a small vivid object (e.g., red berry against green leaf).
        if (largestChroma > HUE_CHECK_CHROMA_THRESHOLD) {
          bestResult.dominantIndex = largestClusterIndex;
          bestResult.centroid = largestCentroid;
        }
      }
    }
  }

  return bestResult;
}

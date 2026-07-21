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
const HUE_CHECK_CHROMA_THRESHOLD = 15;

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
  
  // Penalty for overly large clusters (>80% of image)
  // This helps when the background is overwhelmingly dominant
  if (sizeRatio > 0.80) {
    sizeFactor *= 0.5;
  }
  
  return sizeFactor;
}

/**
 * Initialize k centroids using k-means++ with a deterministic seed
 * First centroid = highest chroma pixel (most colorful = likely the object)
 */
function initializeCentroids(pixels: Lab[], k: number, seedOffset: number = 0): Lab[] {
  if (pixels.length === 0) return [];
  if (k <= 1) return [pixels[0]];

  const centroids: Lab[] = [];

  // Deterministic first centroid: highest chroma pixel
  let firstIndex = 0;
  let maxChroma = -1;
  for (let i = 0; i < pixels.length; i++) {
    const chroma = labChroma(pixels[i]);
    if (chroma > maxChroma) {
      maxChroma = chroma;
      firstIndex = i;
    }
  }
  centroids.push({ ...pixels[firstIndex] });

  // k-means++ for remaining centroids
  for (let i = 1; i < k; i++) {
    const distances = pixels.map(p => {
      const minDist = Math.min(...centroids.map(c => labDistance(p, c)));
      return minDist * minDist;
    });

    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let target = ((totalDist / k) * (i + seedOffset)) % totalDist;
    
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
      const randomIndex = Math.floor(Math.random() * pixels.length);
      newCentroids.push({ ...pixels[randomIndex] });
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
 * Run a single k-means iteration
 */
function runKMeans(
  pixels: Lab[],
  k: number,
  maxIterations: number,
  seedOffset: number
): KMeansResult {
  let centroids = initializeCentroids(pixels, k, seedOffset);
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

  // AUDIT FIX: Don't pre-pick dominantIndex here. 
  // Let the scoring logic evaluate all clusters.
  // We'll set a default for backward compatibility.
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
  
  const sizeFactor = calculateSizeFactor(sizeRatio);
  
  // Primary heuristic: Chroma * SizeFactor
  // This balances colorfulness with representativeness.
  return chroma * sizeFactor;
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

  // Run k-means multiple times with different deterministic seeds
  const results: KMeansResult[] = [];
  for (let run = 0; run < numRuns; run++) {
    results.push(runKMeans(pixels, k, maxIterations, run));
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

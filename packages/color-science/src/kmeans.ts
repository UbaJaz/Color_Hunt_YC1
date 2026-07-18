// K-means clustering for color extraction
// Pure function - browser portable (works with any Lab array)
// Uses Lab space for perceptually uniform clustering

import { Lab, KMeansResult } from './types.js';

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

  // Pick the most saturated (chromatic) cluster as the dominant color
  const chromas = centroids.map(c => labChroma(c));
  const dominantIndex = chromas.indexOf(Math.max(...chromas));

  return {
    centroid: centroids[dominantIndex],
    clusterSizes,
    allCentroids: centroids,
    assignments,
    dominantIndex
  };
}

/**
 * Score a k-means result for quality (higher = better)
 * 
 * We want clusters that are:
 * 1. HIGH chroma (colorful, not gray/background)
 * 2. REASONABLE size (not too tiny, not the whole image)
 * 3. The chroma should be significantly higher than other clusters
 * 
 * New heuristic: chroma * sqrt(sizeRatio) with penalty for extremes
 */
function scoreResult(result: KMeansResult): number {
  const dominantChroma = labChroma(result.centroid);
  const dominantSize = result.clusterSizes[result.dominantIndex];
  const totalSize = result.clusterSizes.reduce((a, b) => a + b, 0);
  const sizeRatio = dominantSize / totalSize;

  // Calculate max chroma of other clusters
  const otherChromas = result.allCentroids
    .map((c, i) => ({ chroma: labChroma(c), index: i }))
    .filter(x => x.index !== result.dominantIndex)
    .map(x => x.chroma);
  const maxOtherChroma = Math.max(...otherChromas);
  
  // Chroma advantage: how much more saturated is this cluster vs others?
  const chromaAdvantage = dominantChroma - maxOtherChroma;

  // Size factor: penalize if cluster is <5% or >80% of image
  let sizeFactor = Math.sqrt(sizeRatio);
  if (sizeRatio < 0.05) sizeFactor *= 0.3;
  if (sizeRatio > 0.80) sizeFactor *= 0.5;

  // Score: chroma advantage weighted by reasonable size
  // This favors clusters that are both colorful AND well-sized
  return chromaAdvantage * sizeFactor;
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

  // Pick the result with the best score
  let bestResult = results[0];
  let bestScore = scoreResult(bestResult);

  for (let i = 1; i < results.length; i++) {
    const score = scoreResult(results[i]);
    if (score > bestScore) {
      bestScore = score;
      bestResult = results[i];
    }
  }

  return bestResult;
}
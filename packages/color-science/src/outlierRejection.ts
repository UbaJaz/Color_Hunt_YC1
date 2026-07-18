// Outlier rejection for color extraction
// Pure function - browser portable
// Works in Lab space for perceptually uniform outlier detection

import { Lab } from './types.js';

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
 * Calculate mean of Lab values
 */
function labMean(pixels: Lab[]): Lab {
  if (pixels.length === 0) {
    return { L: 0, a: 0, b: 0 };
  }

  const sum = pixels.reduce(
    (acc, p) => ({
      L: acc.L + p.L,
      a: acc.a + p.a,
      b: acc.b + p.b
    }),
    { L: 0, a: 0, b: 0 }
  );

  return {
    L: sum.L / pixels.length,
    a: sum.a / pixels.length,
    b: sum.b / pixels.length
  };
}

/**
 * Calculate standard deviation of Lab values from a centroid
 */
function labStandardDeviation(pixels: Lab[], centroid: Lab): Lab {
  if (pixels.length === 0) {
    return { L: 0, a: 0, b: 0 };
  }

  const sumSquaredDiffs = pixels.reduce(
    (acc, p) => ({
      L: acc.L + Math.pow(p.L - centroid.L, 2),
      a: acc.a + Math.pow(p.a - centroid.a, 2),
      b: acc.b + Math.pow(p.b - centroid.b, 2)
    }),
    { L: 0, a: 0, b: 0 }
  );

  const n = pixels.length;
  return {
    L: Math.sqrt(sumSquaredDiffs.L / n),
    a: Math.sqrt(sumSquaredDiffs.a / n),
    b: Math.sqrt(sumSquaredDiffs.b / n)
  };
}

/**
 * Reject outliers more than specified standard deviations from centroid
 * Uses Euclidean distance in Lab space for perceptually uniform filtering
 * @param pixels - Array of Lab pixel values
 * @param centroid - Reference centroid color
 * @param numStdDevs - Number of standard deviations threshold (default: 2)
 * @returns Filtered pixels and recomputed centroid
 */
export function rejectOutliers(
  pixels: Lab[],
  centroid: Lab,
  numStdDevs: number = 2
): { filteredPixels: Lab[]; newCentroid: Lab } {
  if (pixels.length === 0) {
    return { filteredPixels: [], newCentroid: { L: 0, a: 0, b: 0 } };
  }

  // Calculate standard deviation from centroid
  const stdDev = labStandardDeviation(pixels, centroid);

  // Filter pixels within threshold using Euclidean distance
  const filteredPixels = pixels.filter(pixel => {
    const distance = labDistance(pixel, centroid);
    const threshold = numStdDevs * Math.sqrt(
      stdDev.L * stdDev.L + stdDev.a * stdDev.a + stdDev.b * stdDev.b
    );
    return distance <= threshold;
  });

  // Recompute centroid from filtered pixels
  const newCentroid = labMean(filteredPixels);

  return {
    filteredPixels,
    newCentroid
  };
}

// Confidence scoring for lighting quality assessment
// Pure function - browser portable

import { RGB } from './types.js';

export type ConfidenceLevel = 'high' | 'low';

export interface ConfidenceResult {
  level: ConfidenceLevel;
  variance: number;
  brightness: number;
  reasons: string[];
}

/**
 * Calculate pixel variance from an array of RGB values.
 * Variance measures how spread out the pixel values are - high variance
 * can indicate mixed lighting, noise, or a region that spans multiple
 * objects/colors rather than a single uniform surface.
 * 
 * @param pixels - Array of RGB pixel values
 * @returns Variance value (higher = more variation in pixel values)
 */
function calculatePixelVariance(pixels: RGB[]): number {
  if (pixels.length === 0) return 0;

  // Calculate mean brightness across all pixels
  const brightnesses = pixels.map(p => (p.r + p.g + p.b) / 3);
  const meanBrightness = brightnesses.reduce((sum, b) => sum + b, 0) / brightnesses.length;

  // Calculate variance
  const squaredDiffs = brightnesses.map(b => Math.pow(b - meanBrightness, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / brightnesses.length;

  return variance;
}

/**
 * Calculate confidence score for a color extraction.
 * 
 * DESIGN DECISION: Operate on the sampled region's pixels (not the entire image)
 * Rationale: The confidence assessment should reflect the quality of the specific
 * region the user tapped, not the overall photo. A photo might have good lighting
 * overall but the tapped region could be in shadow or have a specular highlight.
 * By operating on the sampled pixels, we give localized feedback that matches
 * what the user actually selected.
 * 
 * DESIGN DECISION: Threshold values
 * - Variance threshold: 2000 (empirically chosen - high variance indicates mixed
 *   lighting, noise, or a region spanning multiple objects)
 * - Brightness range: 30-225 (out-of-range values indicate underexposed or
 *   overexposed regions where color extraction is unreliable)
 * 
 * These thresholds are conservative - they flag clearly problematic conditions
 * rather than attempting to be perfect. The goal is to catch obvious retake cases
 * (too dark, too bright, noisy region) without being overly strict.
 * 
 * @param extractedRgb - The final extracted RGB color
 * @param sampledPixels - The RGB pixels from the sampled region (same data used
 *   for k-means extraction in pipeline.ts)
 * @param varianceThreshold - Maximum acceptable variance (default: 2000)
 * @param minBrightness - Minimum acceptable brightness (default: 30)
 * @param maxBrightness - Maximum acceptable brightness (default: 225)
 * @returns Confidence result with level and diagnostic information
 */
export function calculateConfidence(
  extractedRgb: RGB,
  sampledPixels: RGB[],
  varianceThreshold: number = 2000,
  minBrightness: number = 30,
  maxBrightness: number = 225
): ConfidenceResult {
  const reasons: string[] = [];

  // Calculate brightness of extracted color
  const brightness = (extractedRgb.r + extractedRgb.g + extractedRgb.b) / 3;

  // Calculate variance of sampled pixels
  const variance = calculatePixelVariance(sampledPixels);

  // Check variance threshold
  if (variance > varianceThreshold) {
    reasons.push(`High pixel variance (${variance.toFixed(0)} > ${varianceThreshold}) - region may have mixed lighting or span multiple objects`);
  }

  // Check brightness thresholds
  if (brightness < minBrightness) {
    reasons.push(`Low brightness (${brightness.toFixed(1)} < ${minBrightness}) - region may be underexposed`);
  }

  if (brightness > maxBrightness) {
    reasons.push(`High brightness (${brightness.toFixed(1)} > ${maxBrightness}) - region may be overexposed or have specular highlights`);
  }

  // Determine confidence level
  const level: ConfidenceLevel = reasons.length > 0 ? 'low' : 'high';

  return {
    level,
    variance,
    brightness,
    reasons
  };
}

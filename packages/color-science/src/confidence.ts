// Confidence scoring for lighting quality assessment
// Pure function - browser portable
//
// IMPORTANT — COORDINATE SPACE:
// This module works entirely in sRGB brightness space (mean of R, G, B channels,
// each in [0, 255]).  It does NOT use Lab L* values.
//
// Relationship between the two spaces (approximate, non-linear):
//   sRGB mean 30  ≈  Lab L*  11.5  (pitch-black boundary)
//   sRGB mean 128 ≈  Lab L*  53.4  (mid-tone)
//   sRGB mean 225 ≈  Lab L*  88.5  (near-white boundary)
//
// kmeans.ts uses Lab L* thresholds (dark: L < 25, light: L > 85, specular: L > 90).
// Those numbers are NOT directly comparable to the sRGB thresholds here (30 / 225).
// The two systems serve different purposes and are intentionally separate:
//   - confidence.ts flags whether the PHOTO EXPOSURE is usable.
//   - kmeans.ts boosts individual cluster scores for dark/light OBJECTS within the photo.

import { RGB } from './types.js';

export type ConfidenceLevel = 'high' | 'low';
export type LightingDiagnostic = 'good' | 'underexposed' | 'overexposed' | 'high_variance';

export interface ConfidenceResult {
  level: ConfidenceLevel;
  diagnostic: LightingDiagnostic;
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
 * @param extractedRgb - The final extracted RGB color
 * @param sampledPixels - The RGB pixels from the sampled region
 * @param varianceThreshold - Maximum acceptable variance (default: 2000)
 * @param minBrightness - Minimum acceptable brightness (default: 30, corresponding to L* ~ 11.5)
 * @param maxBrightness - Maximum acceptable brightness (default: 225, corresponding to L* ~ 88.5)
 * @returns Confidence result with level, diagnostic code, and diagnostic reasons
 */
export function calculateConfidence(
  extractedRgb: RGB,
  sampledPixels: RGB[],
  varianceThreshold: number = 2000,
  minBrightness: number = 30,
  maxBrightness: number = 225
): ConfidenceResult {
  const reasons: string[] = [];
  let diagnostic: LightingDiagnostic = 'good';

  // Calculate brightness of extracted color (sRGB mean brightness)
  const brightness = (extractedRgb.r + extractedRgb.g + extractedRgb.b) / 3;

  // Calculate variance of sampled pixels
  const variance = calculatePixelVariance(sampledPixels);

  // Check variance threshold
  if (variance > varianceThreshold) {
    reasons.push(`High pixel variance (${variance.toFixed(0)} > ${varianceThreshold}) - region may have mixed lighting or span multiple objects`);
    diagnostic = 'high_variance';
  }

  // Check brightness thresholds (aligned with L* < 12 and L* > 88.5 extreme bounds)
  if (brightness < minBrightness) {
    reasons.push(`Low brightness (${brightness.toFixed(1)} < ${minBrightness}) - region may be underexposed`);
    if (diagnostic === 'good') diagnostic = 'underexposed';
  }

  if (brightness > maxBrightness) {
    reasons.push(`High brightness (${brightness.toFixed(1)} > ${maxBrightness}) - region may be overexposed or have specular highlights`);
    if (diagnostic === 'good') diagnostic = 'overexposed';
  }

  // Determine confidence level
  const level: ConfidenceLevel = reasons.length > 0 ? 'low' : 'high';

  return {
    level,
    diagnostic,
    variance,
    brightness,
    reasons
  };
}

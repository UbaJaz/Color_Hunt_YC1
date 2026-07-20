// White-balance calibration for ColorHunt
// Pure functions - browser portable (works with any RGB values)

import { RGB } from './types.js';

export interface CalibrationMatrix {
  rScale: number;
  gScale: number;
  bScale: number;
}

/**
 * Estimate a white-balance correction from a photographed white/grey card.
 * Assumes the card should read as pure white (255, 255, 255) under neutral light;
 * any deviation is attributed to a lighting color cast and corrected for.
 *
 * Scale factors are clamped to [1/3, 3] to avoid extreme corrections on a
 * badly-lit or badly-tapped calibration photo (e.g. if the "white card" region
 * accidentally sampled a shadow, don't let that produce a wild overcorrection).
 * Each channel is also floored at 1 before dividing, to avoid divide-by-zero
 * on a pure-black sampled pixel.
 */
export function estimateWhiteBalance(whiteCardRgb: RGB): CalibrationMatrix {
  const clamp = (scale: number) => Math.max(1 / 3, Math.min(3, scale));
  return {
    rScale: clamp(255 / Math.max(1, whiteCardRgb.r)),
    gScale: clamp(255 / Math.max(1, whiteCardRgb.g)),
    bScale: clamp(255 / Math.max(1, whiteCardRgb.b)),
  };
}

/**
 * Apply a calibration matrix to a single RGB pixel. Per-channel scale,
 * clamped to valid 0-255 range after correction.
 */
export function applyCalibration(rgb: RGB, matrix: CalibrationMatrix): RGB {
  const clampChannel = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return {
    r: clampChannel(rgb.r * matrix.rScale),
    g: clampChannel(rgb.g * matrix.gScale),
    b: clampChannel(rgb.b * matrix.bScale),
  };
}

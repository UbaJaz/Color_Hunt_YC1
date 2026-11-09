// White-balance calibration for ColorHunt
// Pure functions - browser portable (works with any RGB values)

import { RGB } from './types.js';
import { srgbToLinear, linearToSrgb } from './colorConversion.js';

export interface CalibrationMatrix {
  rScale: number;
  gScale: number;
  bScale: number;
}

/**
 * Estimate a white-balance correction from a photographed white/grey card.
 * Assumes the card should be neutral (R=G=B) under neutral light;
 * any deviation is attributed to a lighting color cast and corrected for.
 *
 * Scale factors are clamped to [1/3, 3] to avoid extreme corrections on a
 * badly-lit or badly-tapped calibration photo (e.g. if the "white card" region
 * accidentally sampled a shadow, don't let that produce a wild overcorrection).
 * Each channel is also floored at 1 before dividing, to avoid divide-by-zero
 * on a pure-black sampled pixel.
 */
export function estimateWhiteBalance(whiteCardRgb: RGB): CalibrationMatrix {
  // Gains are linear-light multipliers: a colour cast is a physical per-channel light
  // gain, so it must be undone before the sRGB gamma curve, not on gamma-encoded values.
  const clamp = (scale: number) => Math.max(1 / 3, Math.min(3, scale));
  const r = srgbToLinear(whiteCardRgb.r);
  const g = srgbToLinear(whiteCardRgb.g);
  const b = srgbToLinear(whiteCardRgb.b);
  // Scale up to the card's brightest channel, not to white: a grey card in dim light
  // must remove the cast without also over-exposing the whole photo.
  const target = Math.max(1e-4, r, g, b);
  return {
    rScale: clamp(target / Math.max(1e-4, r)),
    gScale: clamp(target / Math.max(1e-4, g)),
    bScale: clamp(target / Math.max(1e-4, b)),
  };
}

/**
 * Check that the sampled "white card" is usable: bright enough and not strongly coloured.
 * Catches a calibration tap on a coloured object, a shadow, or the lens covered.
 */
export function validateCalibrationCard(rgb: RGB): { ok: boolean; reason?: string } {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  if (max < 90) return { ok: false, reason: 'That spot is too dark. Use a well-lit white or grey paper.' };
  if ((max - min) / max > 0.4) return { ok: false, reason: 'That spot is too colourful. Tap a plain white or grey paper.' };
  return { ok: true };
}

/**
 * Apply a calibration matrix to a single RGB pixel in linear light, then re-encode to sRGB.
 */
export function applyCalibration(rgb: RGB, matrix: CalibrationMatrix): RGB {
  const channel = (v: number, scale: number) =>
    Math.round(255 * linearToSrgb(Math.max(0, Math.min(1, srgbToLinear(v) * scale))));
  return {
    r: channel(rgb.r, matrix.rScale),
    g: channel(rgb.g, matrix.gScale),
    b: channel(rgb.b, matrix.bScale),
  };
}

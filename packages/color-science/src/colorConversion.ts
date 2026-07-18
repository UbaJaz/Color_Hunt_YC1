// Color space conversions: RGB → XYZ → Lab
// Pure functions - browser portable
// Uses sRGB to CIE XYZ (D65 illuminant) to CIE Lab conversion

import { RGB, Lab, XYZ } from './types.js';

/**
 * sRGB to linear RGB conversion
 * Applies gamma correction (inverse companding)
 */
function srgbToLinear(rgb: number): number {
  const normalized = rgb / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  } else {
    return Math.pow((normalized + 0.055) / 1.055, 2.4);
  }
}

/**
 * Linear RGB to XYZ conversion
 * Uses sRGB transformation matrix with D65 illuminant
 * Reference: IEC 61966-2-1:1999
 */
function linearRgbToXyz(linearR: number, linearG: number, linearB: number): XYZ {
  // sRGB to XYZ transformation matrix (D65)
  const X = linearR * 0.4124564 + linearG * 0.3575761 + linearB * 0.1804375;
  const Y = linearR * 0.2126729 + linearG * 0.7151522 + linearB * 0.0721750;
  const Z = linearR * 0.0193339 + linearG * 0.1191920 + linearB * 0.9503041;

  return { X, Y, Z };
}

/**
 * XYZ to Lab conversion
 * Uses D65 reference white point
 * Reference: CIE Standard Illuminant D65 (Xn=0.95047, Yn=1.00000, Zn=1.08883)
 */
function xyzToLab(xyz: XYZ): Lab {
  // D65 reference white point
  const Xn = 0.95047;
  const Yn = 1.00000;
  const Zn = 1.08883;

  const fx = f(xyz.X / Xn);
  const fy = f(xyz.Y / Yn);
  const fz = f(xyz.Z / Zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return { L, a, b };
}

/**
 * Helper function for XYZ to Lab conversion
 */
function f(t: number): number {
  if (t > 0.008856) {
    return Math.pow(t, 1 / 3);
  } else {
    return 7.787 * t + 16 / 116;
  }
}

/**
 * Convert RGB to Lab color space
 * @param rgb - RGB color with values 0-255
 * @returns Lab color with L in [0,100], a and b typically in [-128,127]
 */
export function rgbToLab(rgb: RGB): Lab {
  // Convert to linear RGB
  const linearR = srgbToLinear(rgb.r);
  const linearG = srgbToLinear(rgb.g);
  const linearB = srgbToLinear(rgb.b);

  // Convert to XYZ
  const xyz = linearRgbToXyz(linearR, linearG, linearB);

  // Convert to Lab
  return xyzToLab(xyz);
}

/**
 * Lab to RGB conversion (inverse of rgbToLab)
 * Useful for visualization or debugging
 */
export function labToRgb(lab: Lab): RGB {
  const { L, a, b } = lab;

  // Inverse of xyzToLab
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const Xn = 0.95047;
  const Yn = 1.00000;
  const Zn = 1.08883;

  const X = Xn * fInverse(fx);
  const Y = Yn * fInverse(fy);
  const Z = Zn * fInverse(fz);

  // Inverse of linearRgbToXyz
  const linearR = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  const linearG = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
  const linearB = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;

  // Inverse of srgbToLinear
  const r = linearToSrgb(linearR);
  const g = linearToSrgb(linearG);
  const bVal = linearToSrgb(linearB);

  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(bVal * 255)))
  };
}

/**
 * Helper function for Lab to XYZ conversion
 */
function fInverse(t: number): number {
  const t3 = t * t * t;
  if (t3 > 0.008856) {
    return t3;
  } else {
    return (t - 16 / 116) / 7.787;
  }
}

/**
 * Linear RGB to sRGB conversion
 * Applies gamma correction (companding)
 */
function linearToSrgb(linear: number): number {
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  } else {
    return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  }
}

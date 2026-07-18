// CIEDE2000 color difference formula
// Pure function - browser portable
// Reference: "The CIEDE2000 Color-Difference Formula: Implementation Notes, 
// Supplementary Test Data, and Mathematical Observations" by Sharma et al.
// URL: https://www.ece.rochester.edu/~gsharma/ciede2000/ciede2000noteCRNA.pdf

import { Lab } from './types.js';

/**
 * Calculate CIEDE2000 color difference between two Lab colors
 * @param lab1 - First Lab color
 * @param lab2 - Second Lab color
 * @returns Delta E 2000 value (typically 0-100 for most practical color differences)
 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const L1 = lab1.L;
  const a1 = lab1.a;
  const b1 = lab1.b;
  const L2 = lab2.L;
  const a2 = lab2.a;
  const b2 = lab2.b;

  // Step 1: Calculate C' (chroma) and h' (hue angle) for each color
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);

  const Cab = (C1 + C2) / 2;

  // Calculate G factor
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));

  // Calculate a' values
  const a1Prime = a1 * (1 + G);
  const a2Prime = a2 * (1 + G);

  // Calculate C' and h' with a' values
  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);

  let h1Prime = Math.atan2(b1, a1Prime) * (180 / Math.PI);
  if (h1Prime < 0) h1Prime += 360;

  let h2Prime = Math.atan2(b2, a2Prime) * (180 / Math.PI);
  if (h2Prime < 0) h2Prime += 360;

  // Step 2: Calculate delta L', delta C', delta H'
  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;

  let deltaHPrime: number;
  if (C1Prime * C2Prime === 0) {
    deltaHPrime = 0;
  } else {
    const deltaH = h2Prime - h1Prime;
    if (Math.abs(deltaH) <= 180) {
      deltaHPrime = deltaH;
    } else if (deltaH > 180) {
      deltaHPrime = deltaH - 360;
    } else {
      deltaHPrime = deltaH + 360;
    }
  }

  const deltaHPrimeCalc = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(deltaHPrime * Math.PI / 360);

  // Step 3: Calculate mean L', C', and H'
  const LBarPrime = (L1 + L2) / 2;
  const CBarPrime = (C1Prime + C2Prime) / 2;

  let HBarPrime: number;
  if (C1Prime * C2Prime === 0) {
    HBarPrime = h1Prime + h2Prime;
  } else {
    if (Math.abs(h1Prime - h2Prime) <= 180) {
      HBarPrime = (h1Prime + h2Prime) / 2;
    } else if (h1Prime + h2Prime < 360) {
      HBarPrime = (h1Prime + h2Prime + 360) / 2;
    } else {
      HBarPrime = (h1Prime + h2Prime - 360) / 2;
    }
  }

  // Step 4: Calculate T, S_L, S_C, S_H, and R_T
  const T = (
    1 -
    0.17 * Math.cos((HBarPrime - 30) * Math.PI / 180) +
    0.24 * Math.cos(2 * HBarPrime * Math.PI / 180) +
    0.32 * Math.cos((3 * HBarPrime + 6) * Math.PI / 180) -
    0.20 * Math.cos((4 * HBarPrime - 63) * Math.PI / 180)
  );

  const SL = 1 + (0.015 * Math.pow(LBarPrime - 50, 2)) / Math.sqrt(20 + Math.pow(LBarPrime - 50, 2));
  const SC = 1 + 0.045 * CBarPrime;
  const SH = 1 + 0.015 * CBarPrime * T;

  const deltaTheta = 30 * Math.exp(-Math.pow((HBarPrime - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(CBarPrime, 7) / (Math.pow(CBarPrime, 7) + Math.pow(25, 7)));
  const RT = -Math.sin(2 * deltaTheta * Math.PI / 180) * RC;

  // Step 5: Calculate final delta E
  const deltaE = Math.sqrt(
    Math.pow(deltaLPrime / SL, 2) +
    Math.pow(deltaCPrime / SC, 2) +
    Math.pow(deltaHPrimeCalc / SH, 2) +
    RT * (deltaCPrime / SC) * (deltaHPrimeCalc / SH)
  );

  return deltaE;
}

/**
 * Convert delta E to a score (0-100)
 * Higher score = better color match
 * 
 * DESIGN DECISION: Normalization range
 * - deltaE of 0 = perfect match (score 100)
 * - deltaE of ~2.3 = just noticeable difference (JND) for most observers
 * - deltaE of ~5 = clearly different colors
 * - deltaE of ~10+ = very different colors
 * 
 * Using a normalization factor of 10 means:
 * - deltaE 0-2.3: score 77-100 (excellent match)
 * - deltaE 2.3-5: score 50-77 (good match)
 * - deltaE 5-10: score 0-50 (poor match)
 * - deltaE >10: score approaches 0 (very poor match)
 * 
 * This feels reasonable for a party game - small differences are rewarded,
 * but clearly wrong matches get low scores.
 * 
 * @param deltaE - Delta E value from CIEDE2000
 * @param normalizationFactor - Factor to normalize deltaE (default: 10)
 * @returns Score from 0-100
 */
export function deltaEToScore(deltaE: number, normalizationFactor: number = 10): number {
  const normalizedDeltaE = deltaE / normalizationFactor;
  const score = (1 - Math.min(normalizedDeltaE, 1)) * 100;
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate color match score directly from two Lab colors
 */
export function calculateColorScore(lab1: Lab, lab2: Lab, normalizationFactor: number = 10): number {
  const deltaE = deltaE2000(lab1, lab2);
  return deltaEToScore(deltaE, normalizationFactor);
}

import { deltaE2000, deltaEToMatchScore, rgbToLab } from '@color-science';
import type { RGB } from '../types/color';
import type { PairPart, RoundResult } from '../types/game';

/** Score one capture against its target. No capture scores 0. */
export function scorePart(rgb: RGB | null, target: RGB): PairPart {
  if (!rgb) return { extractedRgb: null, deltaE: null, score: 0 };
  const deltaE = deltaE2000(rgbToLab(rgb), rgbToLab(target));
  return { extractedRgb: rgb, deltaE, score: deltaEToMatchScore(deltaE) };
}

/**
 * Fold the captures of a two-colour round into one result: the score is the average (a missing capture counts 0),
 * deltaE is averaged only when every capture exists so a half-finished round never earns the precision bonus.
 */
export function combineParts(parts: PairPart[]): Pick<RoundResult, 'extractedRgb' | 'deltaE' | 'score' | 'pair'> {
  const score = parts.reduce((sum, p) => sum + p.score, 0) / parts.length;
  const complete = parts.every(p => p.deltaE != null);
  const deltaE = complete ? parts.reduce((sum, p) => sum + p.deltaE!, 0) / parts.length : null;
  return { extractedRgb: parts[0].extractedRgb, deltaE, score, pair: parts };
}

// Rarity unlock logic for ColorHunt
// Maps an extracted colour to a rarity tier based on Lab-space properties.

import type { RGB } from './types.js';
import { rgbToLab } from './colorConversion.js';
import type { ConfidenceLevel } from './confidence.js';

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'ultra-rare';

/**
 * Thresholds derived from the spec's rarity table:
 *
 * | Tier        | Examples                           | Detection hint                         |
 * |-------------|------------------------------------|-----------------------------------------|
 * | Common      | Red, Blue, Yellow, Green           | High chroma (C* ≥ 40), mid lightness   |
 * | Uncommon    | Teal, Coral, Lavender, Taupe       | Moderate chroma (20–40) OR unusual L   |
 * | Rare        | Metallic Gold, Fluorescent Pink    | Very high chroma (≥ 60) or extreme L   |
 * | Ultra-Rare  | Pantone Color of the Year          | Near-neutral (C* < 10) mid-L OR very   |
 *              |                                    | narrow hue window (future: hue match)  |
 *
 * NOTE: These thresholds are a Day-7 first pass. Day-8 hardening should
 * A/B test against real player captures and adjust accordingly.
 */
export function getRarityTier(rgb: RGB): RarityTier {
  const lab = rgbToLab(rgb);
  const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b); // C* in Lab space
  const L = lab.L;

  // Ultra-rare: near-achromatic mid-tones (hardest to match — looks like nothing)
  // OR very extreme lightness (near-black / near-white)
  if (chroma < 10 && L > 20 && L < 80) return 'ultra-rare';
  if (L < 8 || L > 96) return 'ultra-rare';

  // Rare: very high chroma (fluorescent / metallic effect) or extreme but not pure black/white
  if (chroma >= 60) return 'rare';
  if (L < 15 || L > 90) return 'rare';

  // Uncommon: moderate chroma / unusual tones
  if (chroma < 20) return 'uncommon';
  if (L < 30 || L > 75) return 'uncommon';

  // Common: vivid, mid-tone — typical easy finds
  return 'common';
}

/**
 * Returns true when a submission qualifies as a "successful unlock" for
 * Collection Mode purposes.
 *
 * Criteria (Day 7 spec):
 * - Score ≥ 75 (good colour match)
 * - Confidence level is not 'low' (poor lighting → not a valid unlock)
 *
 * Friend's Collection Mode UI will call this to gate the unlock animation.
 */
export function isSuccessfulUnlock(score: number, confidence: ConfidenceLevel): boolean {
  return score >= 75 && confidence !== 'low';
}

/**
 * Human-readable label and emoji for each tier — used in ResultsScreen
 * and future Collection Mode unlock cards.
 */
export const RARITY_DISPLAY: Record<RarityTier, { label: string; emoji: string; color: string }> = {
  common: { label: 'Common', emoji: '⚪', color: 'text-neutral-400' },
  uncommon: { label: 'Uncommon', emoji: '🟢', color: 'text-green-400' },
  rare: { label: 'Rare', emoji: '🔵', color: 'text-blue-400' },
  'ultra-rare': { label: 'Ultra-Rare', emoji: '🟣', color: 'text-purple-400' },
};

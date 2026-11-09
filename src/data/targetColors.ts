import type { RGB, TargetColor, Difficulty } from '../types/color';
import { generateRandomTargetColor } from '@color-science';
import type { GameSettings, Pack } from '../types/game';
import { seededRng } from '../utils/challenge';

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function defineColor(id: string, name: string, hex: string, difficulty: Difficulty): TargetColor {
  return { id, name, hex, rgb: hexToRgb(hex), difficulty };
}

export const TARGET_COLORS: readonly TargetColor[] = [
  defineColor('crimson', 'Crimson', '#DC143C', 'easy'),
  defineColor('coral', 'Coral', '#FF7F50', 'medium'),
  defineColor('goldenrod', 'Goldenrod', '#DAA520', 'easy'),
  defineColor('forest-green', 'Forest Green', '#228B22', 'easy'),
  defineColor('teal', 'Teal', '#008080', 'medium'),
  defineColor('cadet-blue', 'Cadet Blue', '#5F9EA0', 'medium'),
  defineColor('royal-blue', 'Royal Blue', '#4169E1', 'easy'),
  defineColor('slate-blue', 'Slate Blue', '#6A5ACD', 'medium'),
  defineColor('orchid', 'Orchid', '#DA70D6', 'medium'),
  defineColor('hot-pink', 'Hot Pink', '#FF69B4', 'easy'),
  defineColor('tomato', 'Tomato', '#FF6347', 'medium'),
  defineColor('chocolate', 'Chocolate', '#D2691E', 'medium'),
  defineColor('olive', 'Olive', '#808000', 'hard'),
  defineColor('sea-green', 'Sea Green', '#2E8B57', 'medium'),
  defineColor('steel-blue', 'Steel Blue', '#4682B4', 'medium'),
  defineColor('dark-orchid', 'Dark Orchid', '#9932CC', 'hard'),
  defineColor('firebrick', 'Firebrick', '#B22222', 'hard'),
  defineColor('sandy-brown', 'Sandy Brown', '#F4A460', 'medium'),
  defineColor('medium-turquoise', 'Medium Turquoise', '#48D1CC', 'medium'),
  defineColor('slate-gray', 'Slate Gray', '#708090', 'hard'),
];

const NATURE: TargetColor[] = [
  ...['forest-green', 'sea-green', 'olive', 'chocolate', 'sandy-brown', 'cadet-blue', 'steel-blue', 'goldenrod', 'slate-gray'].map(id => TARGET_COLORS.find(c => c.id === id)!),
  defineColor('moss', 'Moss', '#6B7F3A', 'medium'),
  defineColor('terracotta', 'Terracotta', '#C9694A', 'medium'),
  defineColor('sky', 'Sky', '#87CEEB', 'easy'),
  defineColor('sand', 'Sand', '#D8C28F', 'medium'),
];
const PASTEL: TargetColor[] = [
  defineColor('baby-pink', 'Baby Pink', '#F8C8DC', 'medium'),
  defineColor('mint', 'Mint', '#BDEFD0', 'medium'),
  defineColor('lavender', 'Lavender', '#D6C8F0', 'medium'),
  defineColor('peach', 'Peach', '#FFD3B0', 'medium'),
  defineColor('powder-blue', 'Powder Blue', '#B7D7F0', 'medium'),
  defineColor('butter', 'Butter', '#FFF2B3', 'medium'),
];
const NEON: TargetColor[] = [
  defineColor('neon-green', 'Neon Green', '#39FF14', 'easy'),
  defineColor('electric-blue', 'Electric Blue', '#00B7FF', 'easy'),
  defineColor('hot-magenta', 'Hot Magenta', '#FF1493', 'easy'),
  defineColor('laser-lemon', 'Laser Lemon', '#FFFF33', 'easy'),
  defineColor('blaze-orange', 'Blaze Orange', '#FF5F1F', 'easy'),
  defineColor('electric-purple', 'Electric Purple', '#BF00FF', 'easy'),
];

/** 'all' stays the original list so existing challenge links keep producing the same colours. */
export const COLOR_PACKS: Record<Pack, readonly TargetColor[]> = { all: TARGET_COLORS, nature: NATURE, pastel: PASTEL, neon: NEON };

/** Picks a random color from a curated preset list, optionally excluding the last one. */
export function getRandomTargetColor(excludeId?: string, rng: () => number = Math.random, pack: Pack = 'all'): TargetColor {
  const all = COLOR_PACKS[pack] ?? TARGET_COLORS;
  const pool = excludeId ? all.filter((c) => c.id !== excludeId) : all;
  const index = Math.floor(rng() * pool.length);
  return pool[index];
}

/**
 * Fix 3 / Day 6: Generates a procedurally random target color using
 * generateRandomTargetColor() from @color-science (perceptually uniform Lab space).
 * Returns a TargetColor shape so it's a drop-in replacement wherever
 * getRandomTargetColor() is used.
 *
 * Used when the host enables "Random Color" mode in the Lobby settings.
 */
export function getDynamicTargetColor(difficulty: Difficulty = 'medium', rng: () => number = Math.random): TargetColor {
  const rgb = generateRandomTargetColor(difficulty, rng);
  const hex = rgbToHex(rgb);
  return {
    id: `dynamic-${hex}`,
    name: hex,        // hex shown as name — keeps UI honest about what the target is
    hex,
    rgb,
    difficulty,
  };
}


/** Rough warm/cool split on hue: reds, oranges and yellows are warm, everything else cool. Greys count as warm. */
export function isWarm({ r, g, b }: RGB): boolean {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return true;
  const sector = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const hue = (sector * 60 + 360) % 360;
  return hue <= 75 || hue >= 330;
}

/**
 * The target for a round. Two-colour rounds ask for slot 1 (warm) and slot 2 (cool); a seed keeps both reproducible.
 * Single-colour rounds seed exactly as before so existing challenge links give the same colours.
 */
export function pickTargetColor(settings: GameSettings | null, excludeId?: string, roundNumber = 1, slot: 1 | 2 = 1): TargetColor {
  const pair = !!settings?.twoColor;
  const rng = settings?.seed ? seededRng(settings.seed, pair ? roundNumber * 10 + slot : roundNumber) : undefined;
  const draw = () => (settings?.useRandomColor ? getDynamicTargetColor(settings.difficulty, rng) : getRandomTargetColor(excludeId, rng, settings?.pack));
  let color = draw();
  if (pair) for (let i = 0; i < 40 && isWarm(color.rgb) !== (slot === 1); i++) color = draw();
  return color;
}

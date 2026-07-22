import type { RGB, TargetColor, Difficulty } from '../types/color';
import { generateRandomTargetColor } from '@color-science';

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

/** Picks a random color from the curated preset list, optionally excluding the last one. */
export function getRandomTargetColor(excludeId?: string): TargetColor {
  const pool = excludeId ? TARGET_COLORS.filter((c) => c.id !== excludeId) : TARGET_COLORS;
  const index = Math.floor(Math.random() * pool.length);
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
export function getDynamicTargetColor(difficulty: Difficulty = 'medium'): TargetColor {
  const rgb = generateRandomTargetColor(difficulty);
  const hex = rgbToHex(rgb);
  return {
    id: `dynamic-${hex}`,
    name: hex,        // hex shown as name — keeps UI honest about what the target is
    hex,
    rgb,
    difficulty,
  };
}


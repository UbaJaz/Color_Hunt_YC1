import type { RGB, TargetColor } from '../types/color';

/**
 * Placeholder target-color library.
 *
 * Per ColorHunt_Build_Plan_Split.md (Day 3 — Friend track): "Wire up the
 * target-color data structure (hex + friendly name library, even if
 * placeholder)." The real 20-30 color production palette is explicit Day 6
 * scope, owned by the color-science track. These are standard, well-known
 * named colors (deliberately not reused from Jaswin's Day 2 test palette —
 * see Day1_Day2_Summary_For_Partner.md's note on avoiding circular test
 * data) so this list is trivially swappable later without touching callers.
 */
function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function defineColor(id: string, name: string, hex: string): TargetColor {
  return { id, name, hex, rgb: hexToRgb(hex) };
}

export const TARGET_COLORS: readonly TargetColor[] = [
  defineColor('crimson', 'Crimson', '#DC143C'),
  defineColor('coral', 'Coral', '#FF7F50'),
  defineColor('goldenrod', 'Goldenrod', '#DAA520'),
  defineColor('forest-green', 'Forest Green', '#228B22'),
  defineColor('teal', 'Teal', '#008080'),
  defineColor('cadet-blue', 'Cadet Blue', '#5F9EA0'),
  defineColor('royal-blue', 'Royal Blue', '#4169E1'),
  defineColor('slate-blue', 'Slate Blue', '#6A5ACD'),
  defineColor('orchid', 'Orchid', '#DA70D6'),
  defineColor('hot-pink', 'Hot Pink', '#FF69B4'),
  defineColor('tomato', 'Tomato', '#FF6347'),
  defineColor('chocolate', 'Chocolate', '#D2691E'),
  defineColor('olive', 'Olive', '#808000'),
  defineColor('sea-green', 'Sea Green', '#2E8B57'),
  defineColor('steel-blue', 'Steel Blue', '#4682B4'),
  defineColor('dark-orchid', 'Dark Orchid', '#9932CC'),
  defineColor('firebrick', 'Firebrick', '#B22222'),
  defineColor('sandy-brown', 'Sandy Brown', '#F4A460'),
  defineColor('medium-turquoise', 'Medium Turquoise', '#48D1CC'),
  defineColor('slate-gray', 'Slate Gray', '#708090'),
];

/** Picks a random target color, optionally excluding one (e.g. the previous round's) to avoid immediate repeats. */
export function getRandomTargetColor(excludeId?: string): TargetColor {
  const pool = excludeId ? TARGET_COLORS.filter((c) => c.id !== excludeId) : TARGET_COLORS;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

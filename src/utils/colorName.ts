import { deltaE2000, rgbToLab } from '@color-science';
import type { RGB } from '../types/color';
import { COLOR_PACKS } from '../data/targetColors';

// Plain everyday names first so a grey photo is "Grey", not "Slate Gray"; the game palettes add the finer names.
const BASICS: { name: string; rgb: RGB }[] = [
  ['White', 255, 255, 255], ['Black', 0, 0, 0], ['Light grey', 192, 192, 192], ['Grey', 128, 128, 128], ['Dark grey', 64, 64, 64],
  ['Red', 255, 0, 0], ['Orange', 255, 165, 0], ['Yellow', 255, 255, 0], ['Green', 0, 128, 0], ['Blue', 0, 0, 255],
  ['Purple', 128, 0, 128], ['Pink', 255, 192, 203], ['Brown', 139, 69, 19], ['Beige', 245, 245, 220], ['Navy', 0, 0, 128], ['Cyan', 0, 255, 255],
].map(([name, r, g, b]) => ({ name: name as string, rgb: { r: r as number, g: g as number, b: b as number } }));

const NAMES = [...BASICS, ...Object.values(COLOR_PACKS).flat().map(c => ({ name: c.name, rgb: c.rgb }))].map(c => ({ ...c, lab: rgbToLab(c.rgb) }));

/** The closest named colour, by the same perceptual distance the game scores with. */
export function nearestColorName(rgb: RGB): string {
  const lab = rgbToLab(rgb);
  let best = NAMES[0];
  let bestD = Infinity;
  for (const n of NAMES) {
    const d = deltaE2000(lab, n.lab);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best.name;
}

/** Plain-words gap between a pick and its target, e.g. "lighter, redder". Empty when they are about the same. */
export function describeDifference(pick: RGB, target: RGB): string {
  const p = rgbToLab(pick);
  const t = rgbToLab(target);
  const parts: string[] = [];
  if (Math.abs(p.L - t.L) > 6) parts.push(p.L > t.L ? 'lighter' : 'darker');
  if (Math.abs(p.a - t.a) > 6) parts.push(p.a > t.a ? 'redder' : 'greener');
  if (Math.abs(p.b - t.b) > 6) parts.push(p.b > t.b ? 'yellower' : 'bluer');
  return parts.join(', ');
}

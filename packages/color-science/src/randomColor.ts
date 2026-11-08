import { RGB, Lab } from './types.js';
import { labToRgb, rgbToLab } from './colorConversion.js';

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Generates a random color in Lab space to ensure perceptual uniformity,
 * then converts to RGB.
 * 
 * Difficulty affects the allowed chroma (saturation) and lightness ranges.
 * - easy: High chroma, mid lightness (vivid colors like red, green, blue).
 * - medium: Moderate chroma, slightly varied lightness (pastels, darkish colors).
 * - hard: Very low chroma or extreme lightness (browns, off-whites, very dark colors).
 */
export function generateRandomTargetColor(difficulty: Difficulty = 'medium'): RGB {
  let minL = 0, maxL = 100;
  let minC = 0, maxC = 100; // Chroma
  
  switch (difficulty) {
    case 'easy':
      minL = 40; maxL = 70;
      minC = 60; maxC = 100;
      break;
    case 'medium':
      minL = 25; maxL = 85;
      minC = 20; maxC = 60;
      break;
    case 'hard':
      // Hard mode: either very dark/light, or very low chroma (greys/browns)
      if (Math.random() > 0.5) {
        // Low chroma
        minL = 30; maxL = 80;
        minC = 0; maxC = 20;
      } else {
        // Extreme lightness
        if (Math.random() > 0.5) {
          minL = 5; maxL = 25; // Dark
        } else {
          minL = 85; maxL = 98; // Light
        }
        minC = 0; maxC = 40;
      }
      break;
  }

  const L = minL + Math.random() * (maxL - minL);
  let C = minC + Math.random() * (maxC - minC);
  
  // Random hue angle (0 to 360 degrees) -> radians
  const hueRad = Math.random() * Math.PI * 2;
  // High-chroma Lab points are often outside sRGB and would be silently clamped to a
  // different colour; shrink chroma until the colour survives the round trip.
  for (let i = 0; i < 30; i++) {
    const rgb = labToRgb({ L, a: C * Math.cos(hueRad), b: C * Math.sin(hueRad) });
    const back = rgbToLab(rgb);
    if (Math.hypot(back.a - C * Math.cos(hueRad), back.b - C * Math.sin(hueRad)) < 3) return rgb;
    C *= 0.92;
  }
  const a = 0;
  const b = 0;

  const lab: Lab = { L, a, b };
  return labToRgb(lab);
}

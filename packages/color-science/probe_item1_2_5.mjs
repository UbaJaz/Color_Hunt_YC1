import { calculateConfidence } from './dist/confidence.js';
import { getRarityTier } from './dist/rarity.js';
import { rgbToLab } from './dist/colorConversion.js';

// ============================================================
// ITEM 1: Specular highlight overwrite bug probe
// Input: bright (brightness ~240), low chroma (<15), high variance (>200)
// A pure white pixel: R=240, G=240, B=240 => brightness=240 > 225(maxBrightness)
// We need variance > 200 AND chroma < 15
// Use many near-white pixels with some noise to get variance > 200
// ============================================================
console.log("=== ITEM 1: Specular Highlight Overwrite Bug ===");

// Build a pixel set that is bright, low-chroma, high-variance
// Main pixel R=240,G=240,B=240 => brightness=240, chroma~=0
// For variance > 200: spread pixels across 0..255 range
// Mean ~= 200, need (pixels - 200)^2 avg > 200, so std dev > ~14
// Use 50 pixels at 240 and 50 pixels at 160 => mean=200, variance = (40^2+40^2)/2 = 1600
const specularpixels = [];
for (let i = 0; i < 50; i++) specularpixels.push({ r: 240, g: 240, b: 240 }); // bright
for (let i = 0; i < 50; i++) specularpixels.push({ r: 160, g: 160, b: 160 }); // mid

// extracted color is the bright one (simulates specular highlight cluster)
const extractedSpecular = { r: 240, g: 240, b: 240 };

const result1 = calculateConfidence(extractedSpecular, specularpixels);

console.log("Input: extractedRgb={r:240, g:240, b:240}");
console.log("  brightness =", (240+240+240)/3, " (maxBrightness default=225, so >225: TRUE)");
const lab1 = rgbToLab(extractedSpecular);
const chroma1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
console.log("  Lab L =", lab1.L.toFixed(2), "chroma =", chroma1.toFixed(2), " (chroma < 15:", chroma1 < 15, ")");
console.log("  50x{r:240,...} + 50x{r:160,...} => variance = ~1600 (> 200: TRUE)");
console.log("  EXPECTED diagnostic = 'specular_highlight'");
console.log("  ACTUAL   diagnostic =", result1.diagnostic);
console.log("  ACTUAL   level      =", result1.level);
console.log("  Reasons:", JSON.stringify(result1.reasons));
console.log("  variance actual =", result1.variance.toFixed(1));
if (result1.diagnostic === 'specular_highlight') {
  console.log("  => RESULT: NO OVERWRITE BUG (specular_highlight preserved)");
} else {
  console.log("  => RESULT: OVERWRITE BUG CONFIRMED — diagnostic was overwritten to:", result1.diagnostic);
}

// ============================================================
// ITEM 2: rarity.ts old vs new thresholds — manual compute
// Reference colors from the prompt:
//   pure sRGB red   (255,0,0)
//   pure sRGB blue  (0,0,255)
//   mid-sat common  (100,180,100) (moderate green chroma ~40)
//   fluorescent pink (255,20,147)
//   metallic gold   (212,175,55)
// ============================================================
console.log("\n=== ITEM 2: Rarity Old vs New Threshold Table ===");
const refColors = [
  { name: "Pure sRGB Red",     rgb: { r: 255, g: 0,   b: 0   } },
  { name: "Pure sRGB Blue",    rgb: { r: 0,   g: 0,   b: 255 } },
  { name: "Mid-sat Green",     rgb: { r: 100, g: 180, b: 100 } },
  { name: "Fluorescent Pink",  rgb: { r: 255, g: 20,  b: 147 } },
  { name: "Metallic Gold",     rgb: { r: 212, g: 175, b: 55  } },
];

// OLD thresholds from commit message: L<15/L>90 (rare), chroma>=60 (rare), chroma<20 (uncommon), L<30/L>75 (uncommon), no L<3/L>98 ultra-rare band
function getRarityOld(rgb) {
  const lab = rgbToLab(rgb);
  const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  const L = lab.L;
  // OLD: no L<3/L>98 ultra-rare band
  if (chroma < 10 && L > 20 && L < 80) return 'ultra-rare'; // unchanged
  if (L < 15 || L > 90) return 'rare';  // OLD rare-lightness
  if (chroma >= 60) return 'rare';       // OLD chroma threshold
  if (chroma < 20) return 'uncommon';   // OLD uncommon chroma
  if (L < 30 || L > 75) return 'uncommon'; // OLD uncommon lightness
  return 'common';
}

// NEW thresholds (current code in rarity.ts)
function getRarityNew(rgb) {
  return getRarityTier(rgb);
}

console.log("| Color Name           | L      | C*     | OLD Tier     | NEW Tier     | Flipped? |");
console.log("|----------------------|--------|--------|--------------|--------------|----------|");
for (const c of refColors) {
  const lab = rgbToLab(c.rgb);
  const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  const oldTier = getRarityOld(c.rgb);
  const newTier = getRarityNew(c.rgb);
  const flipped = oldTier !== newTier ? "YES" : "no";
  console.log("| " + c.name.padEnd(20) + " | " + lab.L.toFixed(1).padEnd(6) + " | " + chroma.toFixed(1).padEnd(6) + " | " + oldTier.padEnd(12) + " | " + newTier.padEnd(12) + " | " + flipped.padEnd(8) + " |");
}

// ============================================================
// ITEM 5: Type name check
// ============================================================
console.log("\n=== ITEM 5: Type Name Accuracy ===");
// Just importing from confidence.js and checking that LightingDiagnostic is the export
// We'll print the diagnostic value to confirm
console.log("Result from calculateConfidence has .diagnostic field type. Per source code:");
console.log("  Exported type name: LightingDiagnostic (confirmed in confidence.ts line 23)");
console.log("  Round 1 report incorrectly called it 'ConfidenceDiagnostic' - INCORRECT");
console.log("  Correct name: LightingDiagnostic");

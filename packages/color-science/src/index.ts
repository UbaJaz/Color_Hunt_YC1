// Main entry point for ColorHunt color science core
// Exports all color science functions for use in the app

// Types
export type { RGB, Lab, XYZ, KMeansResult } from './types.js';

// Image loading (Node-only, not browser portable)
export { loadPixels, loadFullImage } from './imageLoader.js';

// K-means color extraction (browser portable)
export { extractDominantColor, calculateSizeFactor } from './kmeans.js';

// Outlier rejection (browser portable)
export { rejectOutliers } from './outlierRejection.js';

// Color space conversions (browser portable)
export { rgbToLab, labToRgb } from './colorConversion.js';

// CIEDE2000 color difference (browser portable)
export { deltaE2000, deltaEToScore, calculateColorScore } from './ciede2000.js';

// Browser canvas pixel extraction (browser portable)
export { getPixelsFromImageData, getPixelsFromRegion } from './canvasPixels.js';

// Region selection (browser portable)
export { selectRegion } from './regionSelection.js';
export type { Region } from './regionSelection.js';

// High-level pipeline function (browser portable)
export { extractColorFromCanvas } from './pipeline.js';
export type { ExtractionResult } from './pipeline.js';

// Confidence scoring (browser portable)
export { calculateConfidence } from './confidence.js';
export type { ConfidenceResult, ConfidenceLevel } from './confidence.js';

// White-balance calibration (browser portable)
export { estimateWhiteBalance, applyCalibration } from './calibration.js';
export type { CalibrationMatrix } from './calibration.js';

// Bonus voting logic (browser portable)
export { calculateBonusMultiplier } from './bonusVoting.js';
export type { VoteTally } from './bonusVoting.js';

// Random color generation with difficulty (browser portable)
export { generateRandomTargetColor } from './randomColor.js';
export type { Difficulty } from './randomColor.js';

// Rarity tier logic (browser portable)
export { getRarityTier, isSuccessfulUnlock, RARITY_DISPLAY } from './rarity.js';
export type { RarityTier } from './rarity.js';


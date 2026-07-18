// Main entry point for ColorHunt color science core
// Exports all color science functions for use in the app

// Types
export type { RGB, Lab, XYZ, KMeansResult } from './types.js';

// Image loading (Node-only, not browser portable)
export { loadPixels, loadFullImage } from './imageLoader.js';

// K-means color extraction (browser portable)
export { extractDominantColor } from './kmeans.js';

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

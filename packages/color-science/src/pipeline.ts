// High-level pipeline function for browser canvas color extraction
// Browser portable - uses Canvas API

import { extractDominantColor } from './kmeans.js';
import { rejectOutliers } from './outlierRejection.js';
import { rgbToLab, labToRgb } from './colorConversion.js';
import { getPixelsFromRegion } from './canvasPixels.js';
import { selectRegion, Region } from './regionSelection.js';
import { RGB, Lab } from './types.js';

export interface ExtractionResult {
  extractedRgb: RGB;
  extractedLab: Lab;
  dominantClusterSize: number;
  totalPixelsSampled: number;
  region: Region;
}

/**
 * Full pipeline: given a canvas and a tap coordinate, extract the dominant color.
 * 
 * Steps:
 * 1. Compute sampling region via selectRegion()
 * 2. Get ImageData from the canvas context for that region
 * 3. Convert ImageData to RGB[] via getPixelsFromRegion()
 * 4. Convert RGB[] to Lab[] via rgbToLab()
 * 5. Run k-means: extractDominantColor()
 * 6. Filter outliers: rejectOutliers() on the dominant cluster pixels only
 * 7. Convert final centroid back to RGB via labToRgb()
 * 
 * NOTE: This function does NOT draw on the canvas. It returns the region
 * coordinates so the caller (React UI) can draw the selection rectangle.
 * 
 * NOTE: getContext('2d') can return null. Throw a clear error if it does.
 */
export function extractColorFromCanvas(
  canvas: HTMLCanvasElement,
  tapX: number,
  tapY: number,
  k: number = 3,
  outlierStdDevs: number = 2,
  regionProportion: number = 0.20
): ExtractionResult {
  // 1. Get 2D context
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 2. Select region (clipped to bounds)
  const region = selectRegion(tapX, tapY, canvas.width, canvas.height, regionProportion);

  // 3. Get ImageData for that region
  const imageData = ctx.getImageData(region.x, region.y, region.width, region.height);

  // 4. Extract RGB pixels
  const rgbPixels = getPixelsFromRegion(imageData, 0, 0, region.width, region.height);
  // NOTE: getPixelsFromRegion on the ImageData sub-region starts at (0,0)
  // because ctx.getImageData() already cropped to the region

  // 5. Convert to Lab
  const labPixels = rgbPixels.map(rgb => rgbToLab(rgb));

  // 6. K-means
  const kmeansResult = extractDominantColor(labPixels, k);

  // 7. Get dominant cluster pixels only
  const dominantClusterPixels = labPixels.filter(
    (_, i) => kmeansResult.assignments[i] === kmeansResult.dominantIndex
  );

  // 8. Outlier rejection
  const outlierResult = rejectOutliers(dominantClusterPixels, kmeansResult.centroid, outlierStdDevs);

  // 9. Convert back to RGB
  const finalRgb = labToRgb(outlierResult.newCentroid);

  // 10. Return
  return {
    extractedRgb: finalRgb,
    extractedLab: outlierResult.newCentroid,
    dominantClusterSize: dominantClusterPixels.length,
    totalPixelsSampled: rgbPixels.length,
    region
  };
}

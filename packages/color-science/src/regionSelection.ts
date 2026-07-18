// Tap-region selection logic
// Pure function - browser portable

export interface Region {
  x: number;      // top-left x in image pixels
  y: number;      // top-left y in image pixels
  width: number;  // region width in image pixels
  height: number; // region height in image pixels
}

/**
 * Convert a tap coordinate into a rectangular sampling region.
 * 
 * DESIGN DECISION: Region size is proportional to the smaller image dimension.
 * Rationale: A fixed 100×100px region is too small for a 1920×1080 photo
 * and too large for a thumbnail. Using a proportion keeps the sampled area
 * visually consistent regardless of image resolution.
 * 
 * Default proportion: 20% of min(imgWidth, imgHeight).
 * This gives ~200-400px regions on typical phone photos, which is large
 * enough for k-means to find a stable cluster but small enough to stay
 * within the tapped object.
 * 
 * The region is centered on the tap point. If the tap is near an edge,
 * the region is CLIPPED to image bounds (shifted inward, never returning
 * negative coordinates or dimensions exceeding the image).
 */
export function selectRegion(
  tapX: number,
  tapY: number,
  imgWidth: number,
  imgHeight: number,
  proportion: number = 0.20
): Region {
  // Compute region size based on proportion of smaller dimension
  const minDimension = Math.min(imgWidth, imgHeight);
  let regionWidth = Math.floor(minDimension * proportion);
  let regionHeight = Math.floor(minDimension * proportion);

  // Cap region size to image dimensions
  regionWidth = Math.min(regionWidth, imgWidth);
  regionHeight = Math.min(regionHeight, imgHeight);

  // Center region on tap point, but clip to bounds
  let x = Math.floor(tapX - regionWidth / 2);
  let y = Math.floor(tapY - regionHeight / 2);

  // Clip left edge
  if (x < 0) {
    x = 0;
  }

  // Clip right edge
  if (x + regionWidth > imgWidth) {
    x = imgWidth - regionWidth;
  }

  // Clip top edge
  if (y < 0) {
    y = 0;
  }

  // Clip bottom edge
  if (y + regionHeight > imgHeight) {
    y = imgHeight - regionHeight;
  }

  return {
    x,
    y,
    width: regionWidth,
    height: regionHeight
  };
}

// Browser pixel extraction from Canvas ImageData
// Pure functions - browser portable

import { RGB } from './types.js';

/**
 * Extract all RGB pixels from a full ImageData buffer.
 * ImageData.data is a Uint8ClampedArray in RGBA order (4 bytes per pixel).
 * Skip the alpha channel — same pattern as imageLoader.ts with sharp's ensureAlpha().raw().
 */
export function getPixelsFromImageData(imageData: ImageData): RGB[] {
  const pixels: RGB[] = [];
  const data = imageData.data;
  const stride = 4; // RGBA

  for (let i = 0; i < data.length; i += stride) {
    pixels.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2]
    });
  }

  return pixels;
}

/**
 * Extract RGB pixels from a rectangular region of an ImageData buffer.
 * x, y, width, height are in pixels. Must be clipped to image bounds before calling.
 */
export function getPixelsFromRegion(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): RGB[] {
  const pixels: RGB[] = [];
  const data = imageData.data;
  const imgWidth = imageData.width;
  const stride = 4; // RGBA

  for (let row = 0; row < height; row++) {
    const rowOffset = ((y + row) * imgWidth + x) * stride;
    for (let col = 0; col < width; col++) {
      const pixelOffset = rowOffset + (col * stride);
      pixels.push({
        r: data[pixelOffset],
        g: data[pixelOffset + 1],
        b: data[pixelOffset + 2]
      });
    }
  }

  return pixels;
}

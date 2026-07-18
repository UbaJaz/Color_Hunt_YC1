// Image loading utility using sharp
// This is isolated from the color math to keep core functions browser-portable

import sharp from 'sharp';
import { RGB } from './types.js';

/**
 * Load an image file and extract RGB pixel values from a rectangular region
 * @param imagePath - Path to the image file
 * @param x - X coordinate of crop region (default: 0)
 * @param y - Y coordinate of crop region (default: 0)
 * @param width - Width of crop region (default: full image width)
 * @param height - Height of crop region (default: full image height)
 * @returns Array of RGB pixel values
 */
export async function loadPixels(
  imagePath: string,
  x: number = 0,
  y: number = 0,
  width?: number,
  height?: number
): Promise<RGB[]> {
  let image = sharp(imagePath);
  const metadata = await image.metadata();

  const imgWidth = metadata.width || 0;
  const imgHeight = metadata.height || 0;

  // Use full image dimensions if not specified
  const cropWidth = width ?? imgWidth;
  const cropHeight = height ?? imgHeight;

  // Extract the region
  image = image.extract({ left: x, top: y, width: cropWidth, height: cropHeight });

  // Force alpha channel so output is ALWAYS 4 channels (RGBA), regardless of
  // whether the source file (JPEG, PNG without alpha, etc.) had one.
  // Without this, JPEGs (3 channels) would silently corrupt the pixel array
  // when read with a hardcoded stride of 4.
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Use the ACTUAL channel count reported by sharp, not a hardcoded assumption.
  const channels = info.channels;

  // Convert buffer to RGB array using the real stride
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += channels) {
    pixels.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2]
    });
  }

  return pixels;
}

/**
 * Load full image pixels (no cropping)
 */
export async function loadFullImage(imagePath: string): Promise<RGB[]> {
  return loadPixels(imagePath);
}

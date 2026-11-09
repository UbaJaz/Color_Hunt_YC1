import { describe, expect, it } from 'vitest';
import { mapClientPointToImagePixel } from './imageCoordinates';

const rect = (width: number, height: number, left = 0, top = 0) => ({ width, height, left, top }) as DOMRect;

describe('mapClientPointToImagePixel', () => {
  it('maps the centre of the box to the centre of the image', () => {
    expect(mapClientPointToImagePixel(50, 100, rect(100, 200), 400, 400)).toEqual({ x: 200, y: 200 });
  });

  it('undoes object-cover cropping on the overflowing axis', () => {
    // 400x200 image in a 100x100 box: scale 0.5, 100 source px of width cropped each side.
    expect(mapClientPointToImagePixel(0, 50, rect(100, 100), 400, 200)).toEqual({ x: 100, y: 100 });
  });

  it('clamps taps outside the image and respects the box offset', () => {
    expect(mapClientPointToImagePixel(-50, 999, rect(100, 100), 100, 100)).toEqual({ x: 0, y: 100 });
    expect(mapClientPointToImagePixel(60, 70, rect(100, 100, 10, 20), 100, 100)).toEqual({ x: 50, y: 50 });
  });
});

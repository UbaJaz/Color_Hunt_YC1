import { describe, expect, it } from 'vitest';
import { describeDifference, nearestColorName } from './colorName';

describe('colour names', () => {
  it('names a colour by its closest palette entry', () => {
    expect(nearestColorName({ r: 220, g: 20, b: 60 })).toBe('Crimson');
    expect(nearestColorName({ r: 255, g: 0, b: 0 })).toBe('Red');
    expect(nearestColorName({ r: 250, g: 250, b: 250 })).toBe('White');
    expect(nearestColorName({ r: 120, g: 120, b: 125 })).toBe('Grey');
  });

  it('describes how a pick differs from the target in plain words', () => {
    expect(describeDifference({ r: 200, g: 0, b: 0 }, { r: 200, g: 0, b: 0 })).toBe('');
    expect(describeDifference({ r: 255, g: 120, b: 120 }, { r: 200, g: 0, b: 0 })).toContain('lighter');
    expect(describeDifference({ r: 100, g: 0, b: 0 }, { r: 200, g: 0, b: 0 })).toContain('darker');
    expect(describeDifference({ r: 0, g: 160, b: 0 }, { r: 200, g: 0, b: 0 })).toContain('greener');
  });
});

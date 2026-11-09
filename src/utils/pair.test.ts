import { describe, expect, it } from 'vitest';
import { combineParts, scorePart } from './pair';

const RED = { r: 255, g: 0, b: 0 };

describe('two-colour scoring', () => {
  it('scores an exact match 100 and a missing capture 0', () => {
    expect(scorePart(RED, RED).score).toBeGreaterThanOrEqual(99);
    expect(scorePart(null, RED)).toEqual({ extractedRgb: null, deltaE: null, score: 0 });
  });

  it('averages both captures', () => {
    const out = combineParts([scorePart(RED, RED), scorePart({ r: 0, g: 0, b: 255 }, RED)]);
    const a = scorePart(RED, RED).score;
    const b = scorePart({ r: 0, g: 0, b: 255 }, RED).score;
    expect(out.score).toBeCloseTo((a + b) / 2);
    expect(out.extractedRgb).toEqual(RED);
    expect(out.pair).toHaveLength(2);
  });

  it('gives no deltaE (so no precision bonus) when one capture is missing', () => {
    const out = combineParts([scorePart(RED, RED), scorePart(null, RED)]);
    expect(out.deltaE).toBeNull();
    expect(out.score).toBeCloseTo(scorePart(RED, RED).score / 2);
  });
});

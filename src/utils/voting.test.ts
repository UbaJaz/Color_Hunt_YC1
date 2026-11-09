import { describe, expect, it } from 'vitest';
import { finalizeResults } from './voting';
import { makeResult } from '../test/helpers';

describe('finalizeResults', () => {
  it('tallies votes per object and applies the multiplier', () => {
    const results = [makeResult('a', 50), makeResult('b', 50)];
    const out = finalizeResults(results, { b: { a: 'up' }, c: { a: 'up', b: 'down' } });
    expect(out[0].bonusVotes).toEqual({ thumbsUp: 2, thumbsDown: 0 });
    expect(out[0].finalScore).toBe(100); // 50 * 2.0
    expect(out[1].bonusVotes).toEqual({ thumbsUp: 0, thumbsDown: 1 });
    expect(out[1].finalScore).toBe(50); // unpopular: no penalty
  });

  it('caps at 100 and treats no ballots as neutral', () => {
    expect(finalizeResults([makeResult('a', 90)], { b: { a: 'up' } })[0].finalScore).toBe(100);
    expect(finalizeResults([makeResult('a', 70)], {})[0].finalScore).toBe(70);
  });
});

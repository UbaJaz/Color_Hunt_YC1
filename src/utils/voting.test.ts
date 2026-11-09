import { describe, expect, it } from 'vitest';
import { finalizeResults, precisionBonus, streakBonus, streakLength } from './voting';
import { makeResult } from '../test/helpers';

describe('finalizeResults', () => {
  it('tallies votes per object and applies the multiplier', () => {
    const results = [makeResult('a', 50), makeResult('b', 50)];
    const out = finalizeResults(results, { b: { a: 'up' }, c: { a: 'up', b: 'down' } });
    expect(out[0].bonusVotes).toEqual({ thumbsUp: 2, thumbsDown: 0 });
    expect(out[0].finalScore).toBe(65); // 50 + 15
    expect(out[1].bonusVotes).toEqual({ thumbsUp: 0, thumbsDown: 1 });
    expect(out[1].finalScore).toBe(50); // unpopular: no penalty
  });

  it('adds points instead of multiplying, so votes cannot rescue a weak match', () => {
    expect(finalizeResults([makeResult('a', 60)], { b: { a: 'up' } })[0].finalScore).toBe(75);
    expect(finalizeResults([makeResult('a', 90)], { b: { a: 'up' } })[0].finalScore).toBe(105);
  });

  it('treats no ballots as neutral', () => {
    expect(finalizeResults([makeResult('a', 70)], {})[0].finalScore).toBe(70);
  });

  it('adds a precision bonus only for near-exact matches', () => {
    expect(precisionBonus(1.5)).toBe(5);
    expect(precisionBonus(3)).toBe(3);
    expect(precisionBonus(4)).toBe(0);
    expect(precisionBonus(null)).toBe(0);
    expect(finalizeResults([{ ...makeResult('a', 95), deltaE: 1 }], {})[0].finalScore).toBe(100);
  });

  it('builds streaks from consecutive good rounds and resets on a weak one', () => {
    const good = (id: string) => [makeResult(id, 85)];
    const weak = (id: string) => [makeResult(id, 50)];
    expect(streakLength('a', makeResult('a', 85), [])).toBe(1);
    expect(streakLength('a', makeResult('a', 85), [good('a'), good('a')])).toBe(3);
    expect(streakLength('a', makeResult('a', 85), [good('a'), weak('a'), good('a')])).toBe(2);
    expect(streakLength('a', makeResult('a', 70), [good('a')])).toBe(0);
    expect([1, 2, 3, 4, 7].map(streakBonus)).toEqual([0, 3, 5, 8, 8]);
    const out = finalizeResults([makeResult('a', 90)], {}, [good('a'), good('a')]);
    expect(out[0]).toMatchObject({ streak: 3, finalScore: 95 }); // 90 + 5
  });
});

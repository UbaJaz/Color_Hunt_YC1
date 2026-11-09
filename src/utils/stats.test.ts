import { beforeEach, describe, expect, it } from 'vitest';
import { loadStats, recordGame } from './stats';

describe('stats', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the best score and closest match across games', () => {
    expect(recordGame({ bestTotal: 200, bestDeltaE: 5 }).newBest).toBe(false); // first game sets the baseline
    expect(recordGame({ bestTotal: 150, bestDeltaE: 2 }).newBest).toBe(false);
    expect(recordGame({ bestTotal: 260, bestDeltaE: null }).newBest).toBe(true);
    expect(loadStats()).toMatchObject({ gamesPlayed: 3, bestTotal: 260, bestDeltaE: 2 });
  });

  it('tracks the daily challenge best per day and survives corrupt storage', () => {
    recordGame({ bestTotal: 100, bestDeltaE: 3, dailySeed: 'd20261109' });
    recordGame({ bestTotal: 80, bestDeltaE: 3, dailySeed: 'd20261109' });
    expect(loadStats().daily).toEqual({ d20261109: 100 });
    localStorage.setItem('colorhunt-stats-v1', '{oops');
    expect(loadStats().gamesPlayed).toBe(0);
  });
});

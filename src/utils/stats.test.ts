import { beforeEach, describe, expect, it } from 'vitest';
import { activeDailyStreak, loadStats, recordGame } from './stats';

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

  it('counts consecutive daily challenges, ignores a replay the same day and resets after a gap', () => {
    const play = (seed: string) => recordGame({ bestTotal: 50, bestDeltaE: 5, dailySeed: seed }).stats;
    expect(play('d20261109').dailyStreak).toBe(1);
    expect(play('d20261109').dailyStreak).toBe(1);
    expect(play('d20261110').dailyStreak).toBe(2);
    expect(play('d20261111').dailyStreak).toBe(3);
    expect(activeDailyStreak(loadStats(), 'd20261112')).toBe(3); // yesterday counts
    expect(activeDailyStreak(loadStats(), 'd20261113')).toBe(0); // a day was missed
    expect(play('d20261115').dailyStreak).toBe(1);
    expect(play('d20261201').dailyStreak).toBe(1);
  });

  it('keeps the streak across a month and a year boundary', () => {
    const play = (seed: string) => recordGame({ bestTotal: 1, bestDeltaE: 1, dailySeed: seed }).stats;
    play('d20261231');
    expect(play('d20270101').dailyStreak).toBe(2);
  });
});

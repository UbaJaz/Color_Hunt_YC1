const KEY = 'colorhunt-stats-v1';

export interface Stats {
  gamesPlayed: number;
  /** Highest total score any player reached in a game on this device. */
  bestTotal: number;
  /** Closest colour match ever (lowest deltaE), or null before the first capture. */
  bestDeltaE: number | null;
  /** Best total per daily-challenge seed. */
  daily: Record<string, number>;
  /** Consecutive days with a finished daily challenge, as of `lastDailyDay`. */
  dailyStreak: number;
  /** Day number (days since 1970) of the latest daily played, or null. */
  lastDailyDay: number | null;
}

const empty = (): Stats => ({ gamesPlayed: 0, bestTotal: 0, bestDeltaE: null, daily: {}, dailyStreak: 0, lastDailyDay: null });

/** `d20261109` -> a day count, so consecutive dates differ by exactly 1 (UTC maths avoids daylight-saving gaps). */
export const dayNumber = (seed: string) => Math.floor(Date.UTC(+seed.slice(1, 5), +seed.slice(5, 7) - 1, +seed.slice(7, 9)) / 86_400_000);

/** The streak to show today: still alive if the last daily was today or yesterday, otherwise 0. */
export function activeDailyStreak(stats: Stats, todaySeed: string): number {
  return stats.lastDailyDay != null && stats.lastDailyDay >= dayNumber(todaySeed) - 1 ? stats.dailyStreak : 0;
}

export function loadStats(): Stats {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stats | null;
    return s && typeof s.gamesPlayed === 'number' ? { ...empty(), ...s } : empty();
  } catch {
    return empty();
  }
}

export interface GameSummary {
  bestTotal: number;
  bestDeltaE: number | null;
  /** Set when the game was a daily challenge. */
  dailySeed?: string;
}

/** Folds a finished game into the saved stats; `newBest` tells the UI whether to show a badge. */
export function recordGame(g: GameSummary): { stats: Stats; newBest: boolean } {
  const prev = loadStats();
  let dailyStreak = prev.dailyStreak;
  let lastDailyDay = prev.lastDailyDay;
  if (g.dailySeed) {
    const day = dayNumber(g.dailySeed);
    if (lastDailyDay !== day) dailyStreak = lastDailyDay === day - 1 ? dailyStreak + 1 : 1; // same day again changes nothing
    lastDailyDay = Math.max(day, lastDailyDay ?? day);
  }
  const stats: Stats = {
    dailyStreak,
    lastDailyDay,
    gamesPlayed: prev.gamesPlayed + 1,
    bestTotal: Math.max(prev.bestTotal, g.bestTotal),
    bestDeltaE: g.bestDeltaE == null ? prev.bestDeltaE : Math.min(prev.bestDeltaE ?? Infinity, g.bestDeltaE),
    daily: g.dailySeed ? { ...prev.daily, [g.dailySeed]: Math.max(prev.daily[g.dailySeed] ?? 0, g.bestTotal) } : prev.daily,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // storage blocked: stats just don't persist
  }
  return { stats, newBest: prev.gamesPlayed > 0 && g.bestTotal > prev.bestTotal };
}

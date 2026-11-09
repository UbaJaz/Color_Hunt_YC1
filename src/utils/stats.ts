const KEY = 'colorhunt-stats-v1';

export interface Stats {
  gamesPlayed: number;
  /** Highest total score any player reached in a game on this device. */
  bestTotal: number;
  /** Closest colour match ever (lowest deltaE), or null before the first capture. */
  bestDeltaE: number | null;
  /** Best total per daily-challenge seed. */
  daily: Record<string, number>;
}

const empty = (): Stats => ({ gamesPlayed: 0, bestTotal: 0, bestDeltaE: null, daily: {} });

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
  const stats: Stats = {
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

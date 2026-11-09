import type { Stats } from '../../utils/stats';

interface FinalStatsProps {
  stats: Stats;
  newBest: boolean;
  /** The game was a daily challenge, so show the daily streak too. */
  daily: boolean;
}

/** Personal bests under the final standings. */
export function FinalStats({ stats, newBest, daily }: FinalStatsProps) {
  return (
    <div className="text-center text-xs text-neutral-400">
      {newBest && <p className="mb-1 text-sm font-bold text-yellow-300">New personal best!</p>}
      {daily && <p className="mb-1 text-sm font-bold text-orange-300">🔥 {stats.dailyStreak} day daily streak</p>}
      <p>
        Best game {stats.bestTotal} · Closest match ΔE {stats.bestDeltaE?.toFixed(1) ?? '—'} · {stats.gamesPlayed} played
      </p>
    </div>
  );
}

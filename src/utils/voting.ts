import { calculateVoteBonus } from '@color-science';
import type { RoundResult } from '../types/game';

export type Vote = 'up' | 'down';
/** ballots[voterId][ownerId] = that voter's vote on the owner's object. */
export type Ballots = Record<string, Record<string, Vote>>;

/** Reward near-exact matches (deltaE 2000 under 2 is barely visible to the eye). */
export function precisionBonus(deltaE: number | null): number {
  if (deltaE == null) return 0;
  return deltaE < 2 ? 5 : deltaE < 4 ? 3 : 0;
}

export const STREAK_SCORE = 80;

/** 2 good rounds in a row +3, 3 in a row +5, 4 or more +8. */
export function streakBonus(streak: number): number {
  return streak >= 4 ? 8 : streak === 3 ? 5 : streak === 2 ? 3 : 0;
}

/** Streak length for one player: this round must be good, then count back through earlier rounds until one was not. */
export function streakLength(playerId: string, current: RoundResult, history: RoundResult[][]): number {
  if ((current.score ?? 0) < STREAK_SCORE) return 0;
  let n = 1;
  for (let i = history.length - 1; i >= 0; i--) {
    const prev = history[i].find(r => r.playerId === playerId);
    if ((prev?.score ?? 0) < STREAK_SCORE) break;
    n++;
  }
  return n;
}

/** Tally everyone's votes per object and add the vote bonus (0..15 points) on top of the colour score. */
export function finalizeResults(results: RoundResult[], ballots: Ballots, history: RoundResult[][] = []): RoundResult[] {
  return results.map(result => {
    const votes = Object.values(ballots).map(b => b[result.playerId]);
    const tally = {
      thumbsUp: votes.filter(v => v === 'up').length,
      thumbsDown: votes.filter(v => v === 'down').length,
    };
    const streak = streakLength(result.playerId, result, history);
    const finalScore = Math.round(result.score || 0) + calculateVoteBonus(tally) + precisionBonus(result.deltaE) + streakBonus(streak);
    return { ...result, bonusVotes: tally, streak, finalScore };
  });
}

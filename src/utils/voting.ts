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

/** Tally everyone's votes per object and add the vote bonus (0..15 points) on top of the colour score. */
export function finalizeResults(results: RoundResult[], ballots: Ballots): RoundResult[] {
  return results.map(result => {
    const votes = Object.values(ballots).map(b => b[result.playerId]);
    const tally = {
      thumbsUp: votes.filter(v => v === 'up').length,
      thumbsDown: votes.filter(v => v === 'down').length,
    };
    const finalScore = Math.round(result.score || 0) + calculateVoteBonus(tally) + precisionBonus(result.deltaE);
    return { ...result, bonusVotes: tally, finalScore };
  });
}

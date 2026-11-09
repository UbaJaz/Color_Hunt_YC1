import { calculateVoteBonus } from '@color-science';
import type { RoundResult } from '../types/game';

export type Vote = 'up' | 'down';
/** ballots[voterId][ownerId] = that voter's vote on the owner's object. */
export type Ballots = Record<string, Record<string, Vote>>;

/** Tally everyone's votes per object and add the vote bonus (0..15 points) on top of the colour score. */
export function finalizeResults(results: RoundResult[], ballots: Ballots): RoundResult[] {
  return results.map(result => {
    const votes = Object.values(ballots).map(b => b[result.playerId]);
    const tally = {
      thumbsUp: votes.filter(v => v === 'up').length,
      thumbsDown: votes.filter(v => v === 'down').length,
    };
    const finalScore = Math.round(result.score || 0) + calculateVoteBonus(tally);
    return { ...result, bonusVotes: tally, finalScore };
  });
}

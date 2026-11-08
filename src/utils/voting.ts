import { calculateBonusMultiplier } from '@color-science';
import type { RoundResult } from '../types/game';

export type Vote = 'up' | 'down';
/** ballots[voterId][ownerId] = that voter's vote on the owner's object. */
export type Ballots = Record<string, Record<string, Vote>>;

/** Tally everyone's votes per object and apply the bonus multiplier (capped at 100). */
export function finalizeResults(results: RoundResult[], ballots: Ballots): RoundResult[] {
  return results.map(result => {
    const votes = Object.values(ballots).map(b => b[result.playerId]);
    const tally = {
      thumbsUp: votes.filter(v => v === 'up').length,
      thumbsDown: votes.filter(v => v === 'down').length,
    };
    const finalScore = Math.min(100, Math.round((result.score || 0) * calculateBonusMultiplier(tally)));
    return { ...result, bonusVotes: tally, finalScore };
  });
}

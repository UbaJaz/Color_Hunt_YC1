// Bonus voting logic for ColorHunt
// Converts vote tallies into additive bonus points

export interface VoteTally {
  thumbsUp: number;
  thumbsDown: number;
}

/**
 * Additive vote bonus (0..maxBonus points), added AFTER the colour score and not capped,
 * so a strong match is never flattened to 100 and a weak match is never rescued to it.
 * 50% approval or less earns nothing; 100% approval earns maxBonus.
 */
export function calculateVoteBonus(votes: VoteTally, maxBonus: number = 15): number {
  const total = votes.thumbsUp + votes.thumbsDown;
  if (total === 0) return 0;
  const approval = votes.thumbsUp / total;
  return approval <= 0.5 ? 0 : Math.round((approval - 0.5) * 2 * maxBonus);
}

// Bonus voting logic for ColorHunt
// Converts vote tallies into score multipliers

export interface VoteTally {
  thumbsUp: number;
  thumbsDown: number;
}

/**
 * Converts a "most unlikely item" vote tally into a score multiplier.
 * No votes = neutral (1.0x). At or below 50% approval = no bonus (1.0x floor —
 * an unpopular-but-valid find isn't penalized, just not rewarded).
 * Above 50% approval scales linearly up to 2.0x at 100% approval.
 */
export function calculateBonusMultiplier(votes: VoteTally): number {
  const total = votes.thumbsUp + votes.thumbsDown;
  if (total === 0) return 1.0;

  const approvalRatio = votes.thumbsUp / total;
  if (approvalRatio <= 0.5) return 1.0;

  return 1.0 + (approvalRatio - 0.5) * 2;
}

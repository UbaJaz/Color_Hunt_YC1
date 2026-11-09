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
 *
 * NOTE FOR INTEGRATION: When applying this multiplier to a base score (e.g. finalScore = baseScore * multiplier),
 * the combined result MUST be explicitly clamped to 100 max: Math.min(100, Math.round(baseScore * multiplier)).
 */
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

export function calculateBonusMultiplier(votes: VoteTally): number {
  const total = votes.thumbsUp + votes.thumbsDown;
  if (total === 0) return 1.0;

  const approvalRatio = votes.thumbsUp / total;
  if (approvalRatio <= 0.5) return 1.0;

  return 1.0 + (approvalRatio - 0.5) * 2;
}

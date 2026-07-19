import type { RGB, Region, TargetColor } from './color';

export interface Player {
  id: string;
  name: string;
  totalScore: number;
}

/**
 * Result of a single player's submission for a round.
 *
 * `extractedRgb`, `deltaE`, and `score` are populated by
 * @color-science's `extractColorFromCanvas()` (k-means + outlier rejection
 * in Lab space) and `deltaE2000`/`deltaEToScore` (see CaptureScreen). They
 * stay `null` only until a result has actually been recorded for the round.
 */
export interface RoundResult {
  playerId: string;
  region: Region | null;
  extractedRgb: RGB | null;
  deltaE: number | null;
  score: number | null;
}

export interface Round {
  roundNumber: number;
  targetColor: TargetColor;
  results: RoundResult[];
}

export interface GameState {
  players: Player[];
  rounds: Round[];
}

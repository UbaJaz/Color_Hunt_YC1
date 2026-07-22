import type { RGB, Region, TargetColor, Difficulty } from './color';
import type { ConfidenceResult, CalibrationMatrix } from '@color-science';

export interface Player {
  id: string;
  name: string;
  totalScore: number;
}

/**
 * Host-configurable settings chosen in the Lobby before the game starts.
 * Stored in GameState so all screens can access them without prop drilling.
 */
export interface GameSettings {
  /** Total number of rounds to play. */
  roundCount: number;
  /** Difficulty filter applied to colour generation. */
  difficulty: Difficulty;
  /** When true, rounds use the procedural Lab-space generator instead of the curated preset list. */
  useRandomColor: boolean;
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
  confidence: ConfidenceResult | null;
  bonusVotes: { thumbsUp: number; thumbsDown: number } | null;
  finalScore: number | null;
}

export interface Round {
  roundNumber: number;
  targetColor: TargetColor;
  results: RoundResult[];
  currentPlayerIndex: number;
}

export interface GameState {
  players: Player[];
  rounds: Round[];
  calibrationMatrix: CalibrationMatrix | null;
  /** Set by START_GAME action; null until the host confirms the Lobby. */
  settings: GameSettings | null;
}


import type { RGB, Region, TargetColor, Difficulty } from './color';
import type { ConfidenceResult, CalibrationMatrix, Lab } from '@color-science';

export interface Player {
  id: string;
  name: string;
  totalScore: number;
}

export interface ExtractionDebugData {
  naturalPoint: { x: number; y: number };
  region: Region;
  rawAverageRgb: RGB;
  dominantClusterLab: Lab;
  dominantClusterRgb: RGB;
  allClusterSizes: number[];
  extractedRgb: RGB;
  confidenceLevel: string;
  confidenceReasons: string[];
}

export type Pack = 'all' | 'nature' | 'pastel' | 'neon';
export const PACKS: readonly Pack[] = ['all', 'nature', 'pastel', 'neon'];

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
  /** Memory mode: the target swatch is hidden a few seconds into each turn. */
  memoryMode: boolean;
  /** Challenge links: same seed gives the same target colours for everyone. */
  seed?: string;
  /** Each round also shows a hunting-ground prompt such as "Find it in the kitchen". */
  themes?: boolean;
  /** Which curated colour list the preset rounds draw from (ignored in random-colour mode). */
  pack?: Pack;
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
  /** Consecutive rounds (this one included) with a colour score of at least 80. */
  streak?: number;
  debugData?: ExtractionDebugData | null;
}

export interface Round {
  roundNumber: number;
  targetColor: TargetColor;
  results: RoundResult[];
  currentPlayerIndex: number;
  theme?: string;
}

export interface GameState {
  players: Player[];
  rounds: Round[];
  calibrationMatrix: CalibrationMatrix | null;
  /** Set by START_GAME action; null until the host confirms the Lobby. */
  settings: GameSettings | null;
}


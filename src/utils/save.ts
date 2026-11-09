import type { GameState } from '../types/game';

const KEY = 'colorhunt-save-v1';

// Screens that can be resumed safely (lobby/final have nothing to resume, howto is transient).
const RESUMABLE = ['calibration', 'capture', 'results', 'voting', 'leaderboard'];

export interface SavedGame {
  state: GameState;
  screen: string;
  retakesUsed: number;
}

/** Returns the saved game, or null if there is none or it is corrupt (old versions, hand edits). */
export function loadSave(): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedGame;
    const ok =
      Array.isArray(saved?.state?.players) &&
      Array.isArray(saved.state.rounds) &&
      saved.state.rounds.length > 0 &&
      saved.state.settings != null &&
      RESUMABLE.includes(saved.screen);
    return ok ? saved : null;
  } catch {
    return null;
  }
}

/** Photos are only needed while voting on the current round; older rounds drop them so the save stays small. */
function slim(state: GameState): GameState {
  const last = state.rounds.length - 1;
  return {
    ...state,
    rounds: state.rounds.map((round, i) =>
      i === last
        ? round
        : { ...round, results: round.results.map(({ photo: _photo, pair, ...rest }) => ({ ...rest, ...(pair && { pair: pair.map(({ photo: _p, ...part }) => part) }) })) }
    ),
  };
}

export function writeSave(save: SavedGame) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...save, state: slim(save.state) }));
  } catch {
    // storage full or blocked: the game still works, it just can't resume
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

import type { GameState } from '../types/game';

const KEY = 'colorhunt-save-v1';

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
      typeof saved.screen === 'string';
    return ok ? saved : null;
  } catch {
    return null;
  }
}

export function writeSave(save: SavedGame) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
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

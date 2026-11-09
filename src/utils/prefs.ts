const KEY = 'colorhunt-prefs-v1';

export interface Prefs {
  /** Show colour names and "lighter / redder" hints next to swatches, so colour never has to be judged by eye alone. */
  colourBlind: boolean;
  /** Beeps, chimes and the final fanfare. */
  sound: boolean;
  /** Short vibrations on capture, votes and big scores (phones only). */
  haptics: boolean;
}

const DEFAULTS: Prefs = { colourBlind: false, sound: true, haptics: true };

export function getPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Prefs> | null) };
  } catch {
    return DEFAULTS;
  }
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): Prefs {
  const next = { ...getPrefs(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: the choice lasts until the page closes
  }
  return next;
}

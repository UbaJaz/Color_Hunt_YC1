import type { Difficulty } from '../types/color';
import type { GameSettings } from '../types/game';

/** Small deterministic PRNG (mulberry32) keyed by a string, so the same seed gives the same colours everywhere. */
export function seededRng(seed: string, salt: number): () => number {
  let h = 2166136261;
  for (const ch of `${seed}:${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const makeSeed = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), n => (n % 36).toString(36)).join('');

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** `?seed=abc&rounds=5&diff=hard&random=1&memory=1` -> settings, or null when there is no valid seed. */
export function parseChallenge(search: string): GameSettings | null {
  const q = new URLSearchParams(search);
  const seed = q.get('seed') ?? '';
  if (!/^[a-z0-9]{1,12}$/i.test(seed)) return null;
  const rounds = Number(q.get('rounds'));
  const diff = q.get('diff') as Difficulty;
  return {
    seed,
    roundCount: Number.isInteger(rounds) && rounds >= 1 && rounds <= 10 ? rounds : 3,
    difficulty: DIFFICULTIES.includes(diff) ? diff : 'medium',
    useRandomColor: q.get('random') === '1',
    memoryMode: q.get('memory') === '1',
  };
}

export function buildChallengeUrl(base: string, s: GameSettings & { seed: string }): string {
  const q = new URLSearchParams({ seed: s.seed, rounds: String(s.roundCount), diff: s.difficulty });
  if (s.useRandomColor) q.set('random', '1');
  if (s.memoryMode) q.set('memory', '1');
  return `${base}?${q}`;
}

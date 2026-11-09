import { describe, expect, it } from 'vitest';
import { buildChallengeUrl, dailySeed, isDailySeed, parseChallenge, seededRng } from './challenge';
import { getDynamicTargetColor, getRandomTargetColor } from '../data/targetColors';

describe('seededRng', () => {
  it('repeats for the same seed and round, differs otherwise', () => {
    const run = (seed: string, round: number) => { const r = seededRng(seed, round); return [r(), r(), r()]; };
    expect(run('abc', 1)).toEqual(run('abc', 1));
    expect(run('abc', 1)).not.toEqual(run('abc', 2));
    expect(run('abc', 1)).not.toEqual(run('abd', 1));
  });

  it('gives identical target colours (preset and generated) for the same seed', () => {
    expect(getRandomTargetColor(undefined, seededRng('s', 1))).toEqual(getRandomTargetColor(undefined, seededRng('s', 1)));
    expect(getDynamicTargetColor('hard', seededRng('s', 2))).toEqual(getDynamicTargetColor('hard', seededRng('s', 2)));
  });
});

describe('challenge links', () => {
  const settings = { seed: 'k3j9x2', roundCount: 5, difficulty: 'hard', useRandomColor: true, memoryMode: true, themes: true, twoColor: true, pack: 'neon' } as const;

  it('round-trips settings through a link', () => {
    const url = new URL(buildChallengeUrl('https://x.test/', settings));
    expect(parseChallenge(url.search)).toEqual(settings);
  });

  it('ignores links without a valid seed and sanitises the rest', () => {
    expect(parseChallenge('')).toBeNull();
    expect(parseChallenge('?seed=<script>')).toBeNull();
    expect(parseChallenge('?seed=ok&rounds=999&diff=nope')).toMatchObject({ roundCount: 3, difficulty: 'medium' });
  });
});

describe('daily seed', () => {
  it('is stable within a day, changes between days and is a valid seed', () => {
    expect(dailySeed(new Date(2026, 10, 9, 8))).toBe('d20261109');
    expect(dailySeed(new Date(2026, 10, 9, 23))).toBe('d20261109');
    expect(dailySeed(new Date(2026, 10, 10))).toBe('d20261110');
    expect(parseChallenge('?seed=d20261109')?.seed).toBe('d20261109');
    expect(isDailySeed('d20261109')).toBe(true);
    expect(isDailySeed('abc123')).toBe(false);
  });
});

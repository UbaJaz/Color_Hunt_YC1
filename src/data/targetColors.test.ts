import { describe, expect, it } from 'vitest';
import { getDynamicTargetColor, getRandomTargetColor, isWarm, pickTargetColor } from './targetColors';
import { seededRng } from '../utils/challenge';
import type { GameSettings } from '../types/game';

const base: GameSettings = { roundCount: 3, difficulty: 'medium', useRandomColor: false, memoryMode: false };

describe('pickTargetColor', () => {
  it('keeps single-colour seeded rounds identical to the original seeding, so old challenge links do not change', () => {
    for (const seed of ['abc', 'k3j9x2', 'd20261109']) {
      for (const round of [1, 2, 3]) {
        expect(pickTargetColor({ ...base, seed }, undefined, round)).toEqual(getRandomTargetColor(undefined, seededRng(seed, round)));
        expect(pickTargetColor({ ...base, seed, useRandomColor: true, difficulty: 'hard' }, undefined, round)).toEqual(getDynamicTargetColor('hard', seededRng(seed, round)));
      }
    }
  });

  it('pins the exact colours for known seeds, so reordering the colour list cannot silently change old challenge links', () => {
    const ids = (seed: string) => [1, 2, 3].map(round => pickTargetColor({ ...base, seed }, undefined, round).id);
    expect(ids('abc')).toEqual(['firebrick', 'cadet-blue', 'chocolate']);
    expect(ids('k3j9x2')).toEqual(['royal-blue', 'slate-blue', 'crimson']);
    expect(ids('d20261109')).toEqual(['crimson', 'medium-turquoise', 'hot-pink']);
  });

  it('gives a reproducible warm then cool pair for a seed', () => {
    const settings = { ...base, seed: 'pair1', twoColor: true };
    for (let round = 1; round <= 5; round++) {
      const warm = pickTargetColor(settings, undefined, round, 1);
      const cool = pickTargetColor(settings, warm.id, round, 2);
      expect(isWarm(warm.rgb)).toBe(true);
      expect(isWarm(cool.rgb)).toBe(false);
      expect(pickTargetColor(settings, undefined, round, 1)).toEqual(warm);
      expect(pickTargetColor(settings, warm.id, round, 2)).toEqual(cool);
    }
  });

  it('finds a warm and a cool colour in every pack and in random mode', () => {
    for (const pack of ['all', 'nature', 'pastel', 'neon'] as const) {
      const s = { ...base, pack, twoColor: true };
      expect(isWarm(pickTargetColor(s, undefined, 1, 1).rgb)).toBe(true);
      expect(isWarm(pickTargetColor(s, undefined, 1, 2).rgb)).toBe(false);
    }
    const random = { ...base, useRandomColor: true, twoColor: true, seed: 'r1' };
    expect(isWarm(pickTargetColor(random, undefined, 1, 1).rgb)).toBe(true);
    expect(isWarm(pickTargetColor(random, undefined, 1, 2).rgb)).toBe(false);
  });
});

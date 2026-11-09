import { beforeEach, describe, expect, it } from 'vitest';
import { clearSave, loadSave, writeSave } from './save';
import type { GameState } from '../types/game';

const state = {
  players: [{ id: 'p1', name: 'Ann', totalScore: 0 }],
  rounds: [{ roundNumber: 1, targetColor: {}, results: [], currentPlayerIndex: 0 }],
  calibrationMatrix: null,
  settings: { roundCount: 3, difficulty: 'medium', useRandomColor: false, memoryMode: false },
} as unknown as GameState;

describe('save', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a resumable game and clears it', () => {
    writeSave({ state, screen: 'capture', retakesUsed: 1 });
    expect(loadSave()?.retakesUsed).toBe(1);
    clearSave();
    expect(loadSave()).toBeNull();
  });

  it('rejects saves that would resume into a blank or unknown screen', () => {
    writeSave({ state, screen: 'lobby', retakesUsed: 0 });
    expect(loadSave()).toBeNull();
    writeSave({ state, screen: 'nonsense', retakesUsed: 0 });
    expect(loadSave()).toBeNull();
  });

  it('rejects corrupt JSON and saves without settings', () => {
    localStorage.setItem('colorhunt-save-v1', '{oops');
    expect(loadSave()).toBeNull();
    writeSave({ state: { ...state, settings: null }, screen: 'capture', retakesUsed: 0 });
    expect(loadSave()).toBeNull();
  });

  it('keeps photos for the current round but drops them from earlier rounds', () => {
    const result = (photo: string) => ({ playerId: 'p1', region: null, extractedRgb: null, deltaE: null, score: 0, confidence: null, bonusVotes: null, finalScore: null, photo, pair: [{ extractedRgb: null, deltaE: null, score: 0, photo }] });
    const rounds = [1, 2].map(n => ({ roundNumber: n, targetColor: {}, results: [result(`img${n}`)], currentPlayerIndex: 0 }));
    writeSave({ state: { ...state, rounds } as unknown as GameState, screen: 'voting', retakesUsed: 0 });
    const saved = loadSave()!.state.rounds;
    expect(saved[0].results[0].photo).toBeUndefined();
    expect(saved[0].results[0].pair![0].photo).toBeUndefined();
    expect(saved[1].results[0].photo).toBe('img2');
  });
});

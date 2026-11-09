import { describe, expect, it } from 'vitest';
import { createRoom, hostReduce, recomputeTotals, type Intent, type OnlineState, type PickTarget } from './host';
import { SETTINGS } from '../test/helpers';

const RED = { id: 'red', name: 'Red', hex: '#ff0000', rgb: { r: 255, g: 0, b: 0 }, difficulty: 'easy' } as const;
const pick: PickTarget = () => RED;

function run(state: OnlineState, ...steps: [string, Intent][]) {
  return steps.reduce((s, [from, intent]) => hostReduce(s, from, intent, pick), state);
}

const lobby = () => run(createRoom('ABCD', 'h', 'Host'), ['a', { type: 'JOIN', name: 'Ann' }], ['b', { type: 'JOIN', name: 'Bob' }]);
const playing = () => run(lobby(), ['h', { type: 'START', settings: { ...SETTINGS } }]);

describe('host reducer', () => {
  it('joins players once, dedupes names, ignores late joiners', () => {
    let s = run(lobby(), ['a', { type: 'JOIN', name: 'Other' }], ['c', { type: 'JOIN', name: 'host' }]);
    expect(s.players.map(p => p.name)).toEqual(['Host', 'Ann', 'Bob', 'host 2']);
    s = run(s, ['h', { type: 'START', settings: { ...SETTINGS } }], ['z', { type: 'JOIN', name: 'Late' }]);
    expect(s.players).toHaveLength(4);
  });

  it('gives each round a theme only when themes are on, and the same one for the same seed', () => {
    const start = (settings: object) => run(lobby(), ['h', { type: 'START', settings: { ...SETTINGS, ...settings } }]).rounds[0].theme;
    expect(start({})).toBeUndefined();
    expect(start({ themes: true, seed: 'abc' })).toBeTruthy();
    expect(start({ themes: true, seed: 'abc' })).toBe(start({ themes: true, seed: 'abc' }));
  });

  it('only the host can start', () => {
    expect(run(lobby(), ['a', { type: 'START', settings: { ...SETTINGS } }]).phase).toBe('lobby');
    expect(playing().phase).toBe('playing');
  });

  it('recomputes the score from the colour and ignores anything inflated', () => {
    const s = run(playing(), ['a', { type: 'SUBMIT', extractedRgb: { r: 255, g: 0, b: 0 }, score: 100 } as Intent]);
    const r = s.rounds[0].results[0];
    expect(r.playerId).toBe('a');
    expect(r.deltaE).toBeCloseTo(0);
    expect(r.score).toBeGreaterThan(95);
    const far = run(playing(), ['a', { type: 'SUBMIT', extractedRgb: { r: 0, g: 0, b: 255 } }]);
    expect(far.rounds[0].results[0].score).toBeLessThan(15);
  });

  it('rejects invalid colours, duplicate and unknown submitters', () => {
    let s = run(playing(), ['a', { type: 'SUBMIT', extractedRgb: { r: 999, g: 0, b: 0 } }]);
    expect(s.rounds[0].results[0].score).toBe(0);
    s = run(s, ['a', { type: 'SUBMIT', extractedRgb: RED.rgb }], ['nobody', { type: 'SUBMIT', extractedRgb: RED.rgb }]);
    expect(s.rounds[0].results).toHaveLength(1);
  });

  it('moves to voting when all submitted, then to the leaderboard when all voted', () => {
    let s = run(playing(), ['h', { type: 'SUBMIT', extractedRgb: RED.rgb }], ['a', { type: 'SUBMIT', extractedRgb: RED.rgb }]);
    expect(s.phase).toBe('playing');
    s = run(s, ['b', { type: 'SUBMIT', extractedRgb: null }]);
    expect(s.phase).toBe('voting');
    s = run(s, ['h', { type: 'VOTES', votes: { h: 'up', a: 'up', b: 'up' } }], ['a', { type: 'VOTES', votes: { h: 'up' } }]);
    expect(s.phase).toBe('voting');
    s = run(s, ['a', { type: 'VOTES', votes: { h: 'down' } }], ['b', { type: 'VOTES', votes: {} }]);
    expect(s.phase).toBe('leaderboard');
    const byId = Object.fromEntries(s.rounds[0].results.map(r => [r.playerId, r]));
    expect(byId.h.bonusVotes).toEqual({ thumbsUp: 1, thumbsDown: 0 }); // own vote and the repeat ballot ignored
    expect(byId.b.bonusVotes).toEqual({ thumbsUp: 0, thumbsDown: 0 }); // b has no photo: not votable
  });

  it('solo play skips voting', () => {
    const s = run(createRoom('SOLO', 'h', 'Host'), ['h', { type: 'START', settings: { ...SETTINGS } }], ['h', { type: 'SUBMIT', extractedRgb: RED.rgb }]);
    expect(s.phase).toBe('leaderboard');
    expect(s.players[0].totalScore).toBe(s.rounds[0].results[0].finalScore);
  });

  it('FORCE (host only) scores missing photos 0 and skips missing ballots', () => {
    let s = run(playing(), ['h', { type: 'SUBMIT', extractedRgb: RED.rgb }], ['a', { type: 'FORCE' }]);
    expect(s.phase).toBe('playing');
    s = run(s, ['h', { type: 'FORCE' }]);
    expect(s.phase).toBe('voting');
    expect(s.rounds[0].results.filter(r => r.score === 0)).toHaveLength(2);
    s = run(s, ['h', { type: 'FORCE' }]);
    expect(s.phase).toBe('leaderboard');
  });

  it('plays all rounds, then final, then back to the lobby with zeroed scores', () => {
    let s = run(playing(), ['h', { type: 'FORCE' }], ['h', { type: 'FORCE' }]);
    for (let i = 1; i < SETTINGS.roundCount; i++) {
      s = run(s, ['h', { type: 'NEXT' }], ['h', { type: 'FORCE' }], ['h', { type: 'FORCE' }]);
    }
    expect(s.rounds).toHaveLength(SETTINGS.roundCount);
    s = run(s, ['h', { type: 'NEXT' }]);
    expect(s.phase).toBe('final');
    s = run(s, ['h', { type: 'AGAIN' }]);
    expect(s.phase).toBe('lobby');
    expect(s.players.every(p => p.totalScore === 0)).toBe(true);
  });
});

describe('recomputeTotals', () => {
  it('sums final scores per player across rounds and ignores unfinished ones', () => {
    const res = (playerId: string, finalScore: number | null) => ({ playerId, region: null, extractedRgb: null, deltaE: null, score: 0, confidence: null, bonusVotes: null, finalScore });
    const rounds = [
      { roundNumber: 1, targetColor: RED, currentPlayerIndex: 0, results: [res('a', 80), res('b', 50)] },
      { roundNumber: 2, targetColor: RED, currentPlayerIndex: 0, results: [res('a', 20), res('b', null)] },
    ];
    const players = [{ id: 'a', name: 'A', totalScore: 999 }, { id: 'b', name: 'B', totalScore: 0 }];
    expect(recomputeTotals(players, rounds).map(p => p.totalScore)).toEqual([100, 50]);
  });
});

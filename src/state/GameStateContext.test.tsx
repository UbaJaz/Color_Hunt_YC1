import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameStateProvider, useGameState } from './GameStateContext';
import { makeResult, SETTINGS } from '../test/helpers';

const wrapper = ({ children }: { children: ReactNode }) => <GameStateProvider>{children}</GameStateProvider>;

function setupTwoPlayers() {
  const hook = renderHook(() => useGameState(), { wrapper });
  act(() => hook.result.current.addPlayer('Ann'));
  act(() => hook.result.current.addPlayer('Bo'));
  act(() => hook.result.current.startGame(SETTINGS));
  return hook;
}

describe('game state', () => {
  it('gives players unique ids, even after a removal', () => {
    const { result } = setupTwoPlayers();
    const [a, b] = result.current.state.players;
    act(() => result.current.removePlayer(a.id));
    act(() => result.current.addPlayer('Cy'));
    const ids = result.current.state.players.map(p => p.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(b.id);
  });

  it('adds scores only once even if votes are recorded twice', () => {
    const { result } = setupTwoPlayers();
    const [a] = result.current.state.players;
    const voted = [{ ...makeResult(a.id, 80), finalScore: 80 }];
    act(() => result.current.recordResult(makeResult(a.id, 80)));
    act(() => result.current.recordVotes(voted));
    act(() => result.current.recordVotes(voted));
    expect(result.current.state.players[0].totalScore).toBe(80);
  });

  it('resets scores, rounds and settings on play again but keeps players', () => {
    const { result } = setupTwoPlayers();
    const [a] = result.current.state.players;
    act(() => result.current.recordResult(makeResult(a.id, 80)));
    act(() => result.current.recordVotes([{ ...makeResult(a.id, 80), finalScore: 80 }]));
    act(() => result.current.resetGame());
    expect(result.current.state.players.map(p => p.totalScore)).toEqual([0, 0]);
    expect(result.current.state.rounds).toHaveLength(0);
    expect(result.current.state.settings).toBeNull();
  });
});

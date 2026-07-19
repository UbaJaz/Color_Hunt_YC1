import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { GameState, Player, Round, RoundResult } from '../types/game';
import { getRandomTargetColor } from '../data/targetColors';

/**
 * Game state model: players, rounds, and target colors.
 *
 * Per ColorHunt_Build_Plan_Split.md (Day 2 — Friend track): "start the game
 * state model (players, rounds, target colors) that everything else will
 * plug into." Implemented as local React state (Context + reducer), not
 * Firestore — the MVP's Phase 1 milestone (Day 5) is a single-device
 * pass-and-play round, and Firebase/real-time sync isn't referenced anywhere
 * in the day-by-day plan (colorhunt_llm_spec.md's Firestore data model is
 * lower priority per the stated doc order and is architecture for a later
 * phase, not Day 2/3 scope).
 *
 * Multi-player lobby UI (add players, take turns) is explicit Day 5 scope,
 * so this provider seeds a single default player — `addPlayer` is fully
 * implemented and ready for that UI to call, it's just not exercised yet.
 */

type Action =
  | { type: 'START_ROUND' }
  | { type: 'RECORD_RESULT'; payload: RoundResult }
  | { type: 'ADD_PLAYER'; payload: { name: string } };

function createRound(roundNumber: number, excludeColorId?: string): Round {
  return {
    roundNumber,
    targetColor: getRandomTargetColor(excludeColorId),
    results: [],
  };
}

function createInitialState(): GameState {
  return {
    players: [{ id: 'player-1', name: 'You', totalScore: 0 }],
    rounds: [createRound(1)],
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_ROUND': {
      const previousRound = state.rounds[state.rounds.length - 1];
      return {
        ...state,
        rounds: [...state.rounds, createRound(state.rounds.length + 1, previousRound?.targetColor.id)],
      };
    }
    case 'RECORD_RESULT': {
      const rounds = state.rounds.slice();
      const lastIndex = rounds.length - 1;
      const current = rounds[lastIndex];
      rounds[lastIndex] = { ...current, results: [...current.results, action.payload] };
      return { ...state, rounds };
    }
    case 'ADD_PLAYER': {
      const player: Player = {
        id: `player-${state.players.length + 1}`,
        name: action.payload.name,
        totalScore: 0,
      };
      return { ...state, players: [...state.players, player] };
    }
    default:
      return state;
  }
}

interface GameStateContextValue {
  state: GameState;
  currentRound: Round;
  startRound: () => void;
  recordResult: (result: RoundResult) => void;
  addPlayer: (name: string) => void;
}

const GameStateContext = createContext<GameStateContextValue | null>(null);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const startRound = useCallback(() => dispatch({ type: 'START_ROUND' }), []);
  const recordResult = useCallback((result: RoundResult) => dispatch({ type: 'RECORD_RESULT', payload: result }), []);
  const addPlayer = useCallback((name: string) => dispatch({ type: 'ADD_PLAYER', payload: { name } }), []);

  const value = useMemo<GameStateContextValue>(
    () => ({
      state,
      currentRound: state.rounds[state.rounds.length - 1],
      startRound,
      recordResult,
      addPlayer,
    }),
    [state, startRound, recordResult, addPlayer]
  );

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState(): GameStateContextValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return ctx;
}

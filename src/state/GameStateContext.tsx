import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { GameState, GameSettings, Player, Round, RoundResult } from '../types/game';
import { getRandomTargetColor, getDynamicTargetColor } from '../data/targetColors';
import type { CalibrationMatrix } from '@color-science';

type Action =
  | { type: 'START_GAME'; payload: GameSettings }
  | { type: 'START_ROUND' }
  | { type: 'RECORD_RESULT'; payload: RoundResult }
  | { type: 'ADD_PLAYER'; payload: { id: string; name: string } }
  | { type: 'REMOVE_PLAYER'; payload: { id: string } }
  | { type: 'RESET_GAME' }
  | { type: 'LOAD_STATE'; payload: GameState }
  | { type: 'NEXT_TURN' }
  | { type: 'SET_CALIBRATION_MATRIX'; payload: CalibrationMatrix }
  | { type: 'RECORD_VOTES'; payload: { resultsWithVotes: RoundResult[] } };

/**
 * Pick a target color for a new round.
 * If settings.useRandomColor is true, use the procedural Lab-space generator
 * (getDynamicTargetColor) with the configured difficulty.
 * Otherwise fall back to the curated preset list, excluding the previous round's colour.
 */
function pickTargetColor(settings: GameSettings | null, excludeColorId?: string) {
  if (settings?.useRandomColor) {
    return getDynamicTargetColor(settings.difficulty);
  }
  return getRandomTargetColor(excludeColorId);
}

function createRound(roundNumber: number, settings: GameSettings | null, excludeColorId?: string): Round {
  return {
    roundNumber,
    targetColor: pickTargetColor(settings, excludeColorId),
    results: [],
    currentPlayerIndex: 0,
  };
}

function createInitialState(): GameState {
  return {
    players: [],
    rounds: [],
    calibrationMatrix: null,
    settings: null,
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_GAME': {
      // Store settings and kick off round 1. Preserves players added in Lobby.
      return {
        ...state,
        settings: action.payload,
        rounds: [createRound(1, action.payload)],
      };
    }
    case 'START_ROUND': {
      const previousRound = state.rounds[state.rounds.length - 1];
      return {
        ...state,
        rounds: [...state.rounds, createRound(state.rounds.length + 1, state.settings, previousRound?.targetColor.id)],
      };
    }
    case 'RECORD_RESULT': {
      const rounds = state.rounds.slice();
      const lastIndex = rounds.length - 1;
      const current = rounds[lastIndex];
      // Update result if it exists for this player, else add
      const existingIdx = current.results.findIndex(r => r.playerId === action.payload.playerId);
      let newResults = [...current.results];
      if (existingIdx >= 0) {
        newResults[existingIdx] = action.payload;
      } else {
        newResults.push(action.payload);
      }
      rounds[lastIndex] = { ...current, results: newResults };
      return { ...state, rounds };
    }
    case 'ADD_PLAYER': {
      const player: Player = {
        id: action.payload.id,
        name: action.payload.name,
        totalScore: 0,
      };
      return { ...state, players: [...state.players, player] };
    }
    case 'REMOVE_PLAYER': {
      return { ...state, players: state.players.filter(p => p.id !== action.payload.id) };
    }
    case 'LOAD_STATE': {
      return action.payload;
    }
    case 'RESET_GAME': {
      // Play Again: keep players and calibration, wipe scores, rounds and settings.
      return { ...state, players: state.players.map(p => ({ ...p, totalScore: 0 })), rounds: [], settings: null };
    }
    case 'NEXT_TURN': {
      const rounds = state.rounds.slice();
      const lastIndex = rounds.length - 1;
      const current = rounds[lastIndex];
      rounds[lastIndex] = { ...current, currentPlayerIndex: current.currentPlayerIndex + 1 };
      return { ...state, rounds };
    }
    case 'SET_CALIBRATION_MATRIX': {
      return { ...state, calibrationMatrix: action.payload };
    }
    case 'RECORD_VOTES': {
      const rounds = state.rounds.slice();
      const lastIndex = rounds.length - 1;
      const current = rounds[lastIndex];
      // Votes already counted for this round (e.g. a double dispatch): ignore, or scores double.
      if (current.results.some(r => r.finalScore != null)) return state;
      rounds[lastIndex] = { ...current, results: action.payload.resultsWithVotes };

      // Update total scores
      const players = state.players.map(p => {
        const result = action.payload.resultsWithVotes.find(r => r.playerId === p.id);
        if (result && result.finalScore != null) {
          return { ...p, totalScore: p.totalScore + result.finalScore };
        }
        return p;
      });

      return { ...state, rounds, players };
    }
    default:
      return state;
  }
}

interface GameStateContextValue {
  state: GameState;
  currentRound: Round | undefined;
  startGame: (settings: GameSettings) => void;
  startRound: () => void;
  recordResult: (result: RoundResult) => void;
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;
  resetGame: () => void;
  loadState: (state: GameState) => void;
  nextTurn: () => void;
  setCalibrationMatrix: (matrix: CalibrationMatrix) => void;
  recordVotes: (resultsWithVotes: RoundResult[]) => void;
}

const GameStateContext = createContext<GameStateContextValue | null>(null);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const startGame = useCallback((settings: GameSettings) => dispatch({ type: 'START_GAME', payload: settings }), []);
  const startRound = useCallback(() => dispatch({ type: 'START_ROUND' }), []);
  const recordResult = useCallback((result: RoundResult) => dispatch({ type: 'RECORD_RESULT', payload: result }), []);
  const addPlayer = useCallback((name: string) => dispatch({ type: 'ADD_PLAYER', payload: { id: crypto.randomUUID(), name } }), []);
  const removePlayer = useCallback((id: string) => dispatch({ type: 'REMOVE_PLAYER', payload: { id } }), []);
  const loadState = useCallback((s: GameState) => dispatch({ type: 'LOAD_STATE', payload: s }), []);
  const resetGame = useCallback(() => dispatch({ type: 'RESET_GAME' }), []);
  const nextTurn = useCallback(() => dispatch({ type: 'NEXT_TURN' }), []);
  const setCalibrationMatrix = useCallback((matrix: CalibrationMatrix) => dispatch({ type: 'SET_CALIBRATION_MATRIX', payload: matrix }), []);
  const recordVotes = useCallback((resultsWithVotes: RoundResult[]) => dispatch({ type: 'RECORD_VOTES', payload: { resultsWithVotes } }), []);

  const value = useMemo<GameStateContextValue>(
    () => ({
      state,
      currentRound: state.rounds[state.rounds.length - 1],
      startGame,
      startRound,
      recordResult,
      addPlayer,
      removePlayer,
      resetGame,
      loadState,
      nextTurn,
      setCalibrationMatrix,
      recordVotes,
    }),
    [state, startGame, startRound, recordResult, addPlayer, removePlayer, resetGame, loadState, nextTurn, setCalibrationMatrix, recordVotes]
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

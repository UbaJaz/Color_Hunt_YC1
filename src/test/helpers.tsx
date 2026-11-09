import { useEffect, useState, type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { GameStateProvider, useGameState } from '../state/GameStateContext';
import type { RoundResult } from '../types/game';

export type Game = ReturnType<typeof useGameState>;

function Seed({ setup, children }: { setup: (g: Game) => void; children: ReactElement }) {
  const game = useGameState();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setup(game);
    setReady(true); // the screen mounts only after the seed actions are applied
    // seed exactly once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? children : null;
}

/** Render a screen inside the real GameStateProvider, after running `setup` once to seed state. */
export function renderWithGame(ui: ReactElement, setup: (g: Game) => void) {
  return render(
    <GameStateProvider>
      <Seed setup={setup}>{ui}</Seed>
    </GameStateProvider>
  );
}

/** Make addPlayer hand out predictable ids: p1, p2, ... */
export function stubPlayerIds() {
  let n = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `p${++n}` as `${string}-${string}-${string}-${string}-${string}`);
}

export const SETTINGS = { roundCount: 3, difficulty: 'medium', useRandomColor: false } as const;

export function makeResult(playerId: string, score: number, level: 'high' | 'low' = 'high'): RoundResult {
  return {
    playerId,
    region: null,
    extractedRgb: { r: 200, g: 40, b: 40 },
    deltaE: 10,
    score,
    confidence: { level, diagnostic: level === 'high' ? 'good' : 'underexposed', variance: 0, brightness: 100, reasons: [] },
    bonusVotes: null,
    finalScore: null,
  };
}

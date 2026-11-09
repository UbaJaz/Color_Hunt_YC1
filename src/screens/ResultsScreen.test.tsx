import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { ResultsScreen } from './ResultsScreen';
import { makeResult, renderWithGame, SETTINGS, stubPlayerIds } from '../test/helpers';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderResults(level: 'high' | 'low', retakesLeft: number, onRetake = vi.fn()) {
  stubPlayerIds();
  renderWithGame(<ResultsScreen onContinue={vi.fn()} onRetake={onRetake} retakesLeft={retakesLeft} />, g => {
    g.addPlayer('Ann');
    g.startGame(SETTINGS);
    g.recordResult(makeResult('p1', 60, level));
  });
  return onRetake;
}

describe('ResultsScreen retakes', () => {
  it('offers a retake with the remaining count when lighting is poor', () => {
    const onRetake = renderResults('low', 2);
    fireEvent.click(screen.getByText(/Retake \(2 left\)/));
    expect(onRetake).toHaveBeenCalledOnce();
  });

  it('hides the retake button once all retakes are used', () => {
    renderResults('low', 0);
    expect(screen.queryByText(/Retake/)).toBeNull();
  });

  it('never offers a retake when lighting is good', () => {
    renderResults('high', 3);
    expect(screen.queryByText(/Retake/)).toBeNull();
  });
});

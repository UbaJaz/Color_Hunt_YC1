import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { VotingScreen } from './VotingScreen';
import { makeResult, renderWithGame, SETTINGS, stubPlayerIds } from '../test/helpers';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VotingScreen', () => {
  it('passes the phone voter by voter and hides each voter\'s own object', () => {
    stubPlayerIds();
    const done = vi.fn();
    renderWithGame(<VotingScreen onVotingComplete={done} />, g => {
      g.addPlayer('Ann');
      g.addPlayer('Bo');
      g.startGame(SETTINGS);
      g.recordResult(makeResult('p1', 60));
      g.recordResult(makeResult('p2', 40));
    });

    expect(screen.getByText(/Pass the phone to Ann/)).toBeTruthy();
    fireEvent.click(screen.getByText("I'm Ann"));
    expect(screen.queryByText("Ann's Object")).toBeNull();
    expect(screen.getByText("Bo's Object")).toBeTruthy();
    fireEvent.click(screen.getByText('👍 Unlikely'));
    fireEvent.click(screen.getByText(/Done/));

    expect(done).not.toHaveBeenCalled();
    expect(screen.getByText(/Pass the phone to Bo/)).toBeTruthy();
    fireEvent.click(screen.getByText("I'm Bo"));
    expect(screen.queryByText("Bo's Object")).toBeNull();
    fireEvent.click(screen.getByText('Calculate Final Scores'));
    expect(done).toHaveBeenCalledOnce();
  });
});

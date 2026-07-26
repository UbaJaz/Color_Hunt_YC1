import { useState } from 'react';
import { CaptureScreen } from './screens/CaptureScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { VotingScreen } from './screens/VotingScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { GameStateProvider, useGameState } from './state/GameStateContext';
import type { GameSettings } from './types/game';

type ScreenId = 'lobby' | 'calibration' | 'capture' | 'results' | 'voting' | 'leaderboard' | 'final';

function AppShell() {
  const { currentRound, state, startGame, startRound } = useGameState();
  const [screen, setScreen] = useState<ScreenId>('lobby');

  const handleStartGame = (settings: GameSettings) => {
    startGame(settings);
    // If not calibrated, go to calibration. Else go straight to capture.
    if (!state.calibrationMatrix) {
      setScreen('calibration');
    } else {
      setScreen('capture');
    }
  };

  const handleCalibrationComplete = () => {
    setScreen('capture');
  };

  const handleNextPlayerTurnOrVoting = () => {
    // Check if there is another player after current turn advances
    if (currentRound && currentRound.currentPlayerIndex + 1 < state.players.length) {
      setScreen('capture');
    } else {
      // Everyone has played, go to voting
      setScreen('voting');
    }
  };

  /**
   * Day 7d: Retake handler — called when a player taps "Retake" on the Results
   * screen (e.g. poor lighting). Goes back to CaptureScreen for the same player
   * without advancing the turn index. Timer resets because CaptureScreen is
   * keyed by round+playerIndex, so React remounts it fresh.
   */
  const handleRetake = () => {
    setScreen('capture');
  };

  const handleVotingComplete = () => {
    setScreen('leaderboard');
  };

  const handleNextRound = () => {
    // Guard: if the configured round limit is reached, go to the final screen
    // rather than starting another round. state.rounds.length at this point equals
    // the number of rounds already completed (the round that just finished is included).
    const roundLimit = state.settings?.roundCount ?? 0;
    if (roundLimit > 0 && state.rounds.length >= roundLimit) {
      setScreen('final');
      return;
    }
    startRound();
    setScreen('capture');
  };

  // Sorted players for the final screen — computed once here so the JSX stays clean.
  const sortedForFinal = [...state.players].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="h-dvh w-dvw overflow-hidden bg-black" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {screen === 'lobby' && <LobbyScreen onStartGame={handleStartGame} />}
      {screen === 'calibration' && <CalibrationScreen onCalibrationComplete={handleCalibrationComplete} />}
      {screen === 'capture' && (
        <CaptureScreen key={`${currentRound?.roundNumber}-${currentRound?.currentPlayerIndex}`} onRoundResultReady={() => setScreen('results')} />
      )}
      {screen === 'results' && <ResultsScreen onContinue={handleNextPlayerTurnOrVoting} onRetake={handleRetake} />}
      {screen === 'voting' && <VotingScreen onVotingComplete={handleVotingComplete} />}
      {screen === 'leaderboard' && <LeaderboardScreen onNextRound={handleNextRound} />}
      {screen === 'final' && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-neutral-950 p-6 text-white overflow-y-auto">
          <div className="text-center">
            <p className="text-5xl mb-3">🏆</p>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              Game Over!
            </h1>
            <p className="text-neutral-400 mt-2 text-sm">
              {state.settings?.roundCount ?? 0} rounds complete
            </p>
          </div>
          <div className="w-full max-w-sm flex flex-col gap-3">
            {sortedForFinal.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between bg-white/10 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
                  <span className="font-bold text-lg">{player.name}</span>
                </div>
                <span className="font-bold text-xl text-yellow-400">{player.totalScore} pts</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setScreen('lobby')}
            className="rounded-full bg-white px-8 py-3 font-bold text-black shadow-lg transition-transform active:scale-95"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <GameStateProvider>
      <AppShell />
    </GameStateProvider>
  );
}

export default App;

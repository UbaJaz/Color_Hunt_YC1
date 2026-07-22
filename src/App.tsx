import { useState } from 'react';
import { CaptureScreen } from './screens/CaptureScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { VotingScreen } from './screens/VotingScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { GameStateProvider, useGameState } from './state/GameStateContext';
import type { GameSettings } from './types/game';

type ScreenId = 'lobby' | 'calibration' | 'capture' | 'results' | 'voting' | 'leaderboard';

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
    // If there are more players in this round, go back to capture screen
    if (currentRound && currentRound.currentPlayerIndex < state.players.length) {
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
    startRound();
    setScreen('capture');
  };

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

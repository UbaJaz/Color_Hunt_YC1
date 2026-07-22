import { useState } from 'react';
import { CaptureScreen } from './screens/CaptureScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { VotingScreen } from './screens/VotingScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { GameStateProvider, useGameState } from './state/GameStateContext';

type ScreenId = 'lobby' | 'calibration' | 'capture' | 'results' | 'voting' | 'leaderboard';

function AppShell() {
  const { currentRound, state, startRound } = useGameState();
  const [screen, setScreen] = useState<ScreenId>('lobby');

  const handleStartGame = () => {
    // If not calibrated, go to calibration. Else skip.
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
      {screen === 'results' && <ResultsScreen onContinue={handleNextPlayerTurnOrVoting} />}
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

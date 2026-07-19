import { useState } from 'react';
import { CaptureScreen } from './screens/CaptureScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { GameStateProvider, useGameState } from './state/GameStateContext';

type ScreenId = 'capture' | 'results';

function AppShell() {
  const { currentRound } = useGameState();
  const [screen, setScreen] = useState<ScreenId>('capture');

  return (
    <div className="h-dvh w-dvw overflow-hidden bg-black" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {screen === 'capture' && (
        // Keyed on round number so a new round always mounts a fresh
        // CaptureScreen (clears any leftover captured photo/selection state).
        <CaptureScreen key={currentRound.roundNumber} onRoundResultReady={() => setScreen('results')} />
      )}
      {screen === 'results' && <ResultsScreen onPlayAgain={() => setScreen('capture')} />}
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

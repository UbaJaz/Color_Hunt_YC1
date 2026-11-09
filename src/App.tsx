import { useEffect, useState } from 'react';
import { CaptureScreen } from './screens/CaptureScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { VotingScreen } from './screens/VotingScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { GameStateProvider, useGameState } from './state/GameStateContext';
import type { GameSettings } from './types/game';
import { finalizeResults } from './utils/voting';
import { clearSave, loadSave, writeSave } from './utils/save';
import { OnlineGame, loadOnlineSession } from './screens/OnlineGame';

const MAX_RETAKES = 3;

type ScreenId = 'online' | 'lobby' | 'howto' | 'calibration' | 'capture' | 'results' | 'voting' | 'leaderboard' | 'final';

function AppShell() {
  const { currentRound, state, startGame, startRound, resetGame, recordVotes, loadState } = useGameState();
  const [screen, setScreen] = useState<ScreenId>(() => (loadOnlineSession() ? 'online' : 'lobby'));
  const [retakesUsed, setRetakesUsed] = useState(0); // per turn; the capture screen remounts per retake so the timer restarts

  const [saved, setSaved] = useState(loadSave); // a game interrupted by a reload or closed tab

  useEffect(() => {
    if (screen === 'final') clearSave();
    else if (screen !== 'lobby' && screen !== 'howto' && screen !== 'online') writeSave({ state, screen, retakesUsed });
  }, [state, screen, retakesUsed]);

  const handleResume = () => {
    if (!saved) return;
    loadState(saved.state);
    setRetakesUsed(saved.retakesUsed);
    setScreen(saved.screen as ScreenId);
    setSaved(null);
  };

  const handleDiscardSave = () => {
    clearSave();
    setSaved(null);
  };

  const handleStartGame = (settings: GameSettings) => {
    startGame(settings);
    setScreen('howto');
  };

  const handleHowToDone = () => {
    // If not calibrated, go to calibration. Else go straight to capture.
    setScreen(state.calibrationMatrix ? 'capture' : 'calibration');
  };

  const handleCalibrationComplete = () => {
    setScreen('capture');
  };

  const handleNextPlayerTurnOrVoting = () => {
    setRetakesUsed(0);
    // Check if there is another player after current turn advances
    if (currentRound && currentRound.currentPlayerIndex + 1 < state.players.length) {
      setScreen('capture');
    } else {
      // Everyone has played. Voting needs someone besides the owner, so solo play skips it.
      if (state.players.length < 2 && currentRound) {
        recordVotes(finalizeResults(currentRound.results, {}));
        setScreen('leaderboard');
      } else {
        setScreen('voting');
      }
    }
  };

  /**
   * Day 7d: Retake handler — called when a player taps "Retake" on the Results
   * screen (e.g. poor lighting). Goes back to CaptureScreen for the same player
   * without advancing the turn index. Timer resets because CaptureScreen is
   * keyed by round+playerIndex, so React remounts it fresh.
   */
  const handleRetake = () => {
    setRetakesUsed(n => n + 1);
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
      {screen === 'lobby' && saved && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-neutral-950 p-6 text-center text-white">
          <h1 className="text-2xl font-bold">Resume your game?</h1>
          <p className="text-sm text-neutral-400">
            {saved.state.players.map(p => p.name).join(', ')} · round {saved.state.rounds.length}
          </p>
          <button onClick={handleResume} className="rounded-full bg-pink-600 px-8 py-3 font-bold">Resume</button>
          <button onClick={handleDiscardSave} className="text-sm text-neutral-400 underline">Start a new game</button>
        </div>
      )}
      {screen === 'online' && <OnlineGame onExit={() => setScreen('lobby')} />}
      {screen === 'lobby' && !saved && <LobbyScreen onStartGame={handleStartGame} onPlayOnline={() => setScreen('online')} />}
      {screen === 'howto' && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-neutral-950 p-6 text-center text-white">
          <h1 className="text-3xl font-bold">How to play</h1>
          <ol className="max-w-xs list-decimal space-y-3 pl-5 text-left text-neutral-200">
            <li>You get a target colour and 45 seconds.</li>
            <li>Find a real object that matches it and take a photo.</li>
            <li>Tap the object, then confirm. Closer colour, higher score.</li>
            <li>Everyone votes on each other's finds for up to 15 bonus points.</li>
          </ol>
          <button onClick={handleHowToDone} className="rounded-full bg-pink-600 px-8 py-3 font-bold">Got it</button>
        </div>
      )}
      {screen === 'calibration' && <CalibrationScreen onCalibrationComplete={handleCalibrationComplete} />}
      {screen === 'capture' && (
        <CaptureScreen key={`${currentRound?.roundNumber}-${currentRound?.currentPlayerIndex}-${retakesUsed}`} onRoundResultReady={() => setScreen('results')} />
      )}
      {screen === 'results' && <ResultsScreen onContinue={handleNextPlayerTurnOrVoting} onRetake={handleRetake} retakesLeft={MAX_RETAKES - retakesUsed} />}
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
            onClick={() => { resetGame(); setScreen('lobby'); }}
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

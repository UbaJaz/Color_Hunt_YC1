import { useGameState } from '../state/GameStateContext';
import { ColorSwatch } from '../components/ui/ColorSwatch';
import type { RGB } from '../types/color';

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function LeaderboardScreen({ onNextRound }: { onNextRound: () => void }) {
  const { state, currentRound } = useGameState();

  if (!currentRound) return null;

  // Sort players by total score descending
  const sortedPlayers = [...state.players].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-neutral-950 p-6 text-white py-12">
      <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
        Leaderboard
      </h1>

      <div className="w-full max-w-sm flex flex-col gap-8">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-neutral-400 mb-4 text-center">Round {currentRound.roundNumber} Results</h2>
          <div className="flex flex-col gap-3">
            {currentRound.results.sort((a,b) => (b.finalScore || 0) - (a.finalScore || 0)).map(result => {
              const player = state.players.find(p => p.id === result.playerId);
              if (!player) return null;
              
              return (
                <div key={result.playerId} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    {result.extractedRgb ? (
                      <div className="scale-75 origin-left">
                        <ColorSwatch hex={rgbToHex(result.extractedRgb)} label="" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-neutral-800" />
                    )}
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-lg text-pink-400">{result.finalScore}</span>
                    {result.bonusVotes && (result.bonusVotes.thumbsUp > result.bonusVotes.thumbsDown) && (
                      <span className="text-[10px] text-green-400 font-bold uppercase tracking-wide">Bonus!</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-wider text-neutral-400 mb-4 text-center">Total Score</h2>
          <div className="flex flex-col gap-3">
            {sortedPlayers.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between bg-white/10 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-neutral-500 text-lg w-4">{index + 1}</span>
                  <span className="font-bold text-lg">{player.name}</span>
                </div>
                <span className="font-bold text-xl text-yellow-400">{player.totalScore}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onNextRound}
        className="mt-12 rounded-full bg-white px-8 py-3 font-bold text-black shadow-lg"
      >
        Start Next Round
      </button>
    </div>
  );
}

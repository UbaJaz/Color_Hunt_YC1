import { useState } from 'react';
import { useGameState } from '../state/GameStateContext';
import { ColorSwatch } from '../components/ui/ColorSwatch';
import { calculateBonusMultiplier } from '@color-science';
import type { RGB } from '../types/color';

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function VotingScreen({ onVotingComplete }: { onVotingComplete: () => void }) {
  const { state, currentRound, recordVotes } = useGameState();
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({});

  if (!currentRound) return null;

  const handleVote = (playerId: string, vote: 'up' | 'down') => {
    setVotes(prev => ({ ...prev, [playerId]: vote }));
  };

  const handleSubmit = () => {
    const resultsWithVotes = currentRound.results.map(result => {
      // Fix 2: Default unvoted items to a neutral tally {0,0} so
      // calculateBonusMultiplier returns 1.0x — no penalty for forgotten votes.
      const vote = votes[result.playerId];
      const tally = vote === 'up'
        ? { thumbsUp: 1, thumbsDown: 0 }
        : vote === 'down'
          ? { thumbsUp: 0, thumbsDown: 1 }
          : { thumbsUp: 0, thumbsDown: 0 }; // neutral — no vote cast
      const multiplier = calculateBonusMultiplier(tally);
      const finalScore = Math.min(100, Math.round((result.score || 0) * multiplier));

      return {
        ...result,
        bonusVotes: tally,
        finalScore,
      };
    });

    recordVotes(resultsWithVotes);
    onVotingComplete();
  };

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-neutral-950 p-6 text-white py-12">
      <h1 className="text-2xl font-bold mb-2">Bonus Voting</h1>
      <p className="text-sm text-neutral-400 mb-8 text-center max-w-sm">
        Vote on whether each object is a "most unlikely item". Thumbs up grants a score multiplier!
      </p>

      <div className="w-full max-w-sm flex flex-col gap-6">
        {currentRound.results.map(result => {
          const player = state.players.find(p => p.id === result.playerId);
          if (!player || !result.extractedRgb) return null;
          
          const currentVote = votes[result.playerId];

          return (
            <div key={result.playerId} className="bg-white/10 p-4 rounded-2xl flex flex-col items-center gap-4">
              <h2 className="font-semibold text-lg">{player.name}'s Object</h2>
              <ColorSwatch hex={rgbToHex(result.extractedRgb)} label="Extracted" />
              
              <div className="flex gap-4 mt-2">
                <button
                  onClick={() => handleVote(result.playerId, 'up')}
                  className={`px-6 py-2 rounded-full font-bold transition-colors ${currentVote === 'up' ? 'bg-green-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  👍 Unlikely
                </button>
                <button
                  onClick={() => handleVote(result.playerId, 'down')}
                  className={`px-6 py-2 rounded-full font-bold transition-colors ${currentVote === 'down' ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  👎 Common
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        className="mt-8 rounded-full bg-pink-600 px-8 py-3 font-bold text-white shadow-lg"
      >
        Calculate Final Scores
      </button>
    </div>
  );
}

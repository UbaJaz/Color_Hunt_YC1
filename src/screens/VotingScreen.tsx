import { useState } from 'react';
import { useGameState } from '../state/GameStateContext';
import { ColorSwatch } from '../components/ui/ColorSwatch';
import { finalizeResults, type Ballots, type Vote } from '../utils/voting';
import type { RGB } from '../types/color';

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Pass-and-play voting: each player takes the phone in turn and votes on everyone
 * else's object (never their own). Votes are tallied across all voters.
 */
export function VotingScreen({ onVotingComplete }: { onVotingComplete: () => void }) {
  const { state, currentRound, recordVotes } = useGameState();
  const [voterIndex, setVoterIndex] = useState(0);
  const [ballots, setBallots] = useState<Ballots>({});
  const [ready, setReady] = useState(false); // hand-off gate so voters don't see the previous voter's phone state

  if (!currentRound) return null;
  const voter = state.players[voterIndex];
  if (!voter) return null;

  const myVotes = ballots[voter.id] ?? {};
  const targets = currentRound.results.filter(r => r.playerId !== voter.id && r.extractedRgb);

  const handleVote = (ownerId: string, vote: Vote) => {
    setBallots(prev => ({ ...prev, [voter.id]: { ...prev[voter.id], [ownerId]: vote } }));
  };

  const handleDone = () => {
    if (voterIndex + 1 < state.players.length) {
      setVoterIndex(voterIndex + 1);
      setReady(false);
      return;
    }
    recordVotes(finalizeResults(currentRound.results, ballots, state.rounds.slice(0, -1).map(r => r.results)));
    onVotingComplete();
  };

  if (!ready) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-neutral-950 p-6 text-white">
        <p className="text-sm uppercase tracking-wide text-neutral-400">Bonus voting</p>
        <h1 className="text-3xl font-bold">Pass the phone to {voter.name}</h1>
        <button onClick={() => setReady(true)} className="rounded-full bg-pink-600 px-8 py-3 font-bold">
          I'm {voter.name}
        </button>
      </div>
    );
  }

  const isLast = voterIndex + 1 >= state.players.length;

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-neutral-950 p-6 py-12 text-white">
      <h1 className="mb-2 text-2xl font-bold">{voter.name}, cast your votes</h1>
      <p className="mb-8 max-w-sm text-center text-sm text-neutral-400">
        Is each object a "most unlikely item"? A thumbs up from most of the group adds up to 15 bonus points. Skipping counts as no vote.
      </p>

      <div className="flex w-full max-w-sm flex-col gap-6">
        {targets.map(result => {
          const owner = state.players.find(p => p.id === result.playerId);
          if (!owner || !result.extractedRgb) return null;
          const current = myVotes[result.playerId];
          return (
            <div key={result.playerId} className="flex flex-col items-center gap-4 rounded-2xl bg-white/10 p-4">
              <h2 className="text-lg font-semibold">{owner.name}'s Object</h2>
              <div className="flex gap-4">
                <ColorSwatch hex={rgbToHex(result.extractedRgb)} label="Extracted" />
                {result.pair?.[1]?.extractedRgb && <ColorSwatch hex={rgbToHex(result.pair[1].extractedRgb)} label="Second" />}
              </div>
              <div className="mt-2 flex gap-4">
                <button
                  onClick={() => handleVote(result.playerId, 'up')}
                  className={`rounded-full px-6 py-2 font-bold transition-colors ${current === 'up' ? 'bg-green-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  👍 Unlikely
                </button>
                <button
                  onClick={() => handleVote(result.playerId, 'down')}
                  className={`rounded-full px-6 py-2 font-bold transition-colors ${current === 'down' ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  👎 Common
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={handleDone} className="mt-8 rounded-full bg-pink-600 px-8 py-3 font-bold text-white shadow-lg">
        {isLast ? 'Calculate Final Scores' : 'Done — pass the phone'}
      </button>
    </div>
  );
}

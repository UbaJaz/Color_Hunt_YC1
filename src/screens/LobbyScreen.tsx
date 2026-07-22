import { useState } from 'react';
import { useGameState } from '../state/GameStateContext';

export function LobbyScreen({ onStartGame }: { onStartGame: () => void }) {
  const { state, addPlayer } = useGameState();
  const [name, setName] = useState('');

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      addPlayer(name.trim());
      setName('');
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-neutral-950 p-6 text-white">
      <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">ColorHunt</h1>
      
      <div className="w-full max-w-sm rounded-2xl bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-semibold">Players</h2>
        <ul className="mb-6 flex flex-col gap-2">
          {state.players.length === 0 ? (
            <li className="text-sm text-neutral-500">No players yet. Add at least one!</li>
          ) : (
            state.players.map(p => (
              <li key={p.id} className="flex items-center rounded-lg bg-white/10 px-4 py-2">
                {p.name}
              </li>
            ))
          )}
        </ul>

        <form onSubmit={handleAddPlayer} className="flex gap-2">
          <input
            type="text"
            placeholder="Player name..."
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 rounded-lg bg-black px-4 py-2 text-white outline-none focus:ring-2 focus:ring-pink-500"
          />
          <button type="submit" className="rounded-lg bg-pink-600 px-4 py-2 font-medium">Add</button>
        </form>
      </div>

      <button
        onClick={onStartGame}
        disabled={state.players.length === 0}
        className="rounded-full bg-white px-8 py-3 font-semibold text-black disabled:opacity-50"
      >
        Start Game
      </button>
    </div>
  );
}

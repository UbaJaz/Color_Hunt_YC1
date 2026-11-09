import { useState } from 'react';
import { useGameState } from '../state/GameStateContext';
import { PACKS, type GameSettings, type Pack } from '../types/game';
import type { Difficulty } from '../types/color';
import { buildChallengeUrl, dailySeed, makeSeed, parseChallenge } from '../utils/challenge';
import { activeDailyStreak, loadStats } from '../utils/stats';

interface LobbyScreenProps {
  onStartGame: (settings: GameSettings) => void;
  onPlayOnline?: () => void;
}

const DIFFICULTY_OPTIONS: { label: string; value: Difficulty; description: string }[] = [
  { label: '🟢 Easy', value: 'easy', description: 'Vivid, saturated colours' },
  { label: '🟡 Medium', value: 'medium', description: 'Pastels & darker tones' },
  { label: '🔴 Hard', value: 'hard', description: 'Greys, browns & extremes' },
];

const ROUND_OPTIONS = [3, 5, 7];
const MAX_PLAYERS = 8;

export function LobbyScreen({ onStartGame, onPlayOnline }: LobbyScreenProps) {
  const { state, addPlayer, removePlayer } = useGameState();
  const [name, setName] = useState('');

  // Game settings state — lives here until the host taps Start
  const [challenge] = useState(() => parseChallenge(window.location.search)); // opened from a friend's challenge link
  const [roundCount, setRoundCount] = useState(challenge?.roundCount ?? 3);
  const [difficulty, setDifficulty] = useState<Difficulty>(challenge?.difficulty ?? 'medium');
  const [useRandomColor, setUseRandomColor] = useState(challenge?.useRandomColor ?? false);
  const [memoryMode, setMemoryMode] = useState(challenge?.memoryMode ?? false);
  const [themes, setThemes] = useState(challenge?.themes ?? false);
  const [twoColor, setTwoColor] = useState(challenge?.twoColor ?? false);
  const [pack, setPack] = useState<Pack>(challenge?.pack ?? 'all');
  const [seed, setSeed] = useState(challenge?.seed);
  const [copied, setCopied] = useState(false);

  const copyChallenge = () => {
    const s = seed ?? makeSeed();
    setSeed(s);
    void navigator.clipboard?.writeText(buildChallengeUrl(window.location.origin + window.location.pathname, { seed: s, roundCount, difficulty, useRandomColor, memoryMode, themes, twoColor, pack }));
    setCopied(true);
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const duplicate = state.players.some(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (trimmed && !duplicate && state.players.length < MAX_PLAYERS) {
      addPlayer(trimmed);
      setName('');
    }
  };

  const handleStart = () => {
    if (state.players.length === 0) return;
    onStartGame({ roundCount, difficulty, useRandomColor, memoryMode, themes, twoColor, pack, seed });
  };

  const today = dailySeed();
  const stats = loadStats();
  const todaysBest = stats.daily[today];
  const streak = activeDailyStreak(stats, today);
  const handleDaily = () => {
    if (state.players.length === 0) return;
    onStartGame({ roundCount: 3, difficulty: 'medium', useRandomColor: false, memoryMode: false, seed: today });
  };

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-neutral-950 p-6 text-white py-10 gap-6">
      <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        ColorHunt
      </h1>

      {/* Players */}
      <div className="w-full max-w-sm rounded-2xl bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-semibold">Players</h2>
        <ul className="mb-6 flex flex-col gap-2">
          {state.players.length === 0 ? (
            <li className="text-sm text-neutral-500">No players yet. Add at least one!</li>
          ) : (
            state.players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-2">
                <span className="text-neutral-400 text-sm font-mono">{i + 1}</span>
                <span className="flex-1">{p.name}</span>
                <button onClick={() => removePlayer(p.id)} aria-label={`Remove ${p.name}`} className="px-2 text-neutral-400">✕</button>
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

      {/* Game Settings — Day 6 */}
      <div className="w-full max-w-sm rounded-2xl bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-semibold">Game Settings</h2>

        {/* Round count */}
        <div className="mb-5">
          <p className="text-sm text-neutral-400 mb-2">Rounds</p>
          <div className="flex gap-2">
            {ROUND_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setRoundCount(n)}
                className={`flex-1 rounded-lg py-2 font-semibold text-sm transition-colors ${
                  roundCount === n ? 'bg-pink-600 text-white' : 'bg-white/10 text-neutral-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Random colour toggle */}
        <div className="mb-5 flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Random Colour Mode</p>
            <p className="text-xs text-neutral-400">Procedurally generated targets</p>
          </div>
          <button
            onClick={() => setUseRandomColor(v => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${useRandomColor ? 'bg-pink-600' : 'bg-neutral-700'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                useRandomColor ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Memory mode */}
        <div className="mb-5 flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Memory Mode</p>
            <p className="text-xs text-neutral-400">Target hides after 4 seconds</p>
          </div>
          <button
            onClick={() => setMemoryMode(v => !v)}
            aria-label="Memory mode"
            className={`relative h-6 w-11 rounded-full transition-colors ${memoryMode ? 'bg-pink-600' : 'bg-neutral-700'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                memoryMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Two-colour rounds */}
        <div className="mb-5 flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Two-Colour Rounds</p>
            <p className="text-xs text-neutral-400">Find a warm and a cool object (60s)</p>
          </div>
          <button
            onClick={() => setTwoColor(v => !v)}
            aria-label="Two-colour rounds"
            className={`relative h-6 w-11 rounded-full transition-colors ${twoColor ? 'bg-pink-600' : 'bg-neutral-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${twoColor ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Colour pack */}
        <div className="mb-5">
          <p className="text-sm text-neutral-400 mb-2">
            Colour pack{useRandomColor && <span className="ml-1 text-xs opacity-50">(not used in Random mode)</span>}
          </p>
          <div className="flex gap-2">
            {PACKS.map(p => (
              <button
                key={p}
                onClick={() => setPack(p)}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize ${pack === p ? 'bg-pink-600 text-white' : 'bg-white/10 text-neutral-300'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Theme prompts */}
        <div className="mb-5 flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Theme Prompts</p>
            <p className="text-xs text-neutral-400">Each round says where to hunt</p>
          </div>
          <button
            onClick={() => setThemes(v => !v)}
            aria-label="Theme prompts"
            className={`relative h-6 w-11 rounded-full transition-colors ${themes ? 'bg-pink-600' : 'bg-neutral-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${themes ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Difficulty — only relevant when Random Colour Mode is on */}
        <div>
          <p className="text-sm text-neutral-400 mb-2">
            Difficulty{!useRandomColor && <span className="ml-1 text-xs opacity-50">(applies in Random mode)</span>}
          </p>
          <div className="flex flex-col gap-2">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`flex items-center justify-between rounded-lg px-4 py-3 text-left transition-colors ${
                  difficulty === opt.value
                    ? 'bg-pink-600/30 border border-pink-500/50 text-white'
                    : 'bg-white/5 text-neutral-300'
                }`}
              >
                <span className="font-medium text-sm">{opt.label}</span>
                <span className="text-xs text-neutral-400">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {seed && <p className="text-sm font-semibold text-yellow-400">Challenge mode: everyone gets the same colours</p>}
      <button onClick={copyChallenge} className="text-sm text-neutral-300 underline">
        {copied ? 'Link copied' : 'Copy challenge link'}
      </button>

      <p className="max-w-sm text-center text-xs text-neutral-400">
        House rule: real objects only. No pointing the camera at another screen.
      </p>

      <button
        onClick={handleStart}
        disabled={state.players.length === 0}
        className="rounded-full bg-white px-8 py-3 font-semibold text-black disabled:opacity-50 transition-transform active:scale-95"
      >
        Start Game
      </button>
      <button
        onClick={handleDaily}
        disabled={state.players.length === 0}
        className="rounded-full border border-yellow-400/60 px-6 py-2 text-sm font-semibold text-yellow-300 disabled:opacity-50"
      >
        Daily challenge{todaysBest != null && ` · your best ${todaysBest}`}{streak > 0 && ` · 🔥 ${streak} day${streak === 1 ? '' : 's'}`}
      </button>
      {onPlayOnline && (
        <button onClick={onPlayOnline} className="text-sm text-neutral-400 underline">Play online with friends</button>
      )}
    </div>
  );
}

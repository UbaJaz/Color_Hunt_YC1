import { ColorSwatch } from '../components/ui/ColorSwatch';
import { CelebrationOverlay } from '../components/ui/CelebrationOverlay';
import { useGameState } from '../state/GameStateContext';
import { getRarityTier, isSuccessfulUnlock, RARITY_DISPLAY } from '@color-science';
import { useCelebration } from '../hooks/useCelebration';
import type { RGB } from '../types/color';

interface ResultsScreenProps {
  onContinue: () => void;
  /** Day 7d: Called when a player chooses to retake due to poor lighting.
   *  Returns to CaptureScreen for the same player without advancing the turn. */
  onRetake: () => void;
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function ResultsScreen({ onContinue, onRetake }: ResultsScreenProps) {
  const { state, currentRound, nextTurn } = useGameState();
  const player = state.players[currentRound!.currentPlayerIndex];

  // The latest result for the current player
  const result = currentRound?.results.find(r => r.playerId === player?.id);

  // Day 7a: Rarity tier for the captured colour
  const rarityTier = result?.extractedRgb ? getRarityTier(result.extractedRgb) : null;
  const rarityDisplay = rarityTier ? RARITY_DISPLAY[rarityTier] : null;

  // Day 7b: Celebration hook — auto-fires confetti + haptic for high scores / rare finds
  const { isCelebrating } = useCelebration({
    score: result?.score ?? null,
    rarityTier,
  });

  // Day 7c: Unlock eligibility banner
  const unlockEligible =
    result?.score != null &&
    result.confidence != null &&
    isSuccessfulUnlock(result.score, result.confidence.level);

  const handleContinue = () => {
    nextTurn();
    onContinue();
  };

  // Day 7d: Retake — do NOT advance turn so the same player goes again
  const handleRetake = () => {
    onRetake();
  };

  if (!currentRound || !player || !result) return null;

  const isPoorLighting = result.confidence?.level === 'low';

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 bg-neutral-950 p-6 text-white overflow-y-auto">
      {/* Day 7b: Confetti overlay — absolute, pointer-events-none */}
      <CelebrationOverlay active={isCelebrating} />

      <div>
        <p className="text-center text-xs uppercase tracking-wide text-neutral-400">Round {currentRound.roundNumber}</p>
        <h1 className="text-center text-2xl font-semibold">{player.name}'s Result</h1>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-6">
          <ColorSwatch hex={currentRound.targetColor.hex} label="Target" sublabel={currentRound.targetColor.name} />
          <span className="text-2xl text-neutral-500">vs</span>
          {result.extractedRgb ? (
            <div className="flex flex-col items-center gap-2">
              <ColorSwatch
                hex={rgbToHex(result.extractedRgb)}
                label="Your pick"
                sublabel={rgbToHex(result.extractedRgb)}
              />
              {/* Day 7c: Rarity badge */}
              {rarityDisplay && (
                <span className={`text-xs font-semibold ${rarityDisplay.color}`}>
                  {rarityDisplay.emoji} {rarityDisplay.label}
                </span>
              )}
            </div>
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-white/30 text-center text-xs text-neutral-500">
              No pick
            </div>
          )}
        </div>

        {/* Day 7c: Unlock eligibility banner */}
        {unlockEligible && (
          <div className="flex items-center gap-2 rounded-full bg-purple-900/40 border border-purple-500/50 px-4 py-2">
            <span className="text-purple-300 text-sm font-semibold">🎉 Bonus unlock eligible!</span>
          </div>
        )}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex gap-4 rounded-2xl bg-white/5 px-6 py-4 justify-around">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Score</p>
            <p className="text-xl font-semibold text-pink-400">
              {result.score != null ? `${Math.round(result.score)}%` : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Delta E</p>
            <p className="text-xl font-semibold">
              {result.deltaE != null ? result.deltaE.toFixed(2) : '—'}
            </p>
          </div>
        </div>

        {result.confidence && (
          <div className={`rounded-2xl px-6 py-4 flex flex-col gap-2 border ${isPoorLighting ? 'bg-orange-950/30 border-orange-500/50 text-orange-200' : 'bg-green-950/30 border-green-500/50 text-green-200'}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm uppercase">Lighting Quality</span>
              <span className="font-bold">{isPoorLighting ? 'POOR' : 'GOOD'}</span>
            </div>
            {result.confidence.reasons.length > 0 && (
              <ul className="text-xs space-y-1 list-disc list-inside opacity-80">
                {result.confidence.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
            {/* Day 7d: Retake button for poor lighting */}
            {isPoorLighting && (
              <button
                onClick={handleRetake}
                className="mt-1 self-start rounded-full bg-orange-500/20 border border-orange-400/50 px-4 py-1.5 text-xs font-semibold text-orange-200 transition-opacity active:opacity-70"
              >
                ↩ Retake
              </button>
            )}
          </div>
        )}
      </div>

      <button onClick={handleContinue} className="mt-4 rounded-full bg-white px-8 py-3 text-sm font-bold text-neutral-900 transition-transform active:scale-95">
        Continue
      </button>
    </div>
  );
}

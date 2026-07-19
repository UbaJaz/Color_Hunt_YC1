import { ColorSwatch } from '../components/ui/ColorSwatch';
import { useGameState } from '../state/GameStateContext';
import type { RGB } from '../types/color';

interface ResultsScreenProps {
  onPlayAgain: () => void;
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Results screen: swatch comparison, score, and Delta E readout
 * (ColorHunt_Build_Plan_Split.md, Day 3 — Friend track / Day 4 JOINT).
 *
 * Score and Delta E are computed in `CaptureScreen` from @color-science's
 * `extractColorFromCanvas()` output and CIEDE2000 scoring — this screen only
 * renders them.
 */
export function ResultsScreen({ onPlayAgain }: ResultsScreenProps) {
  const { currentRound, startRound } = useGameState();
  const latestResult = currentRound.results[currentRound.results.length - 1];

  const handlePlayAgain = () => {
    startRound();
    onPlayAgain();
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-neutral-950 p-6 text-white">
      <div>
        <p className="text-center text-xs uppercase tracking-wide text-neutral-400">Round {currentRound.roundNumber}</p>
        <h1 className="text-center text-2xl font-semibold">Swatch Comparison</h1>
      </div>

      <div className="flex items-center gap-6">
        <ColorSwatch hex={currentRound.targetColor.hex} label="Target" sublabel={currentRound.targetColor.name} />
        <span className="text-2xl text-neutral-500">vs</span>
        {latestResult?.extractedRgb ? (
          <ColorSwatch
            hex={rgbToHex(latestResult.extractedRgb)}
            label="Your pick"
            sublabel={rgbToHex(latestResult.extractedRgb)}
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-white/30 text-center text-xs text-neutral-500">
            No pick
          </div>
        )}
      </div>

      <div className="flex gap-6 rounded-2xl bg-white/5 px-8 py-4">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Score</p>
          <p className="text-xl font-semibold">
            {latestResult?.score != null ? (
              `${Math.round(latestResult.score)}%`
            ) : (
              <span className="text-sm font-normal text-neutral-500">—</span>
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Delta E</p>
          <p className="text-xl font-semibold">
            {latestResult?.deltaE != null ? (
              latestResult.deltaE.toFixed(2)
            ) : (
              <span className="text-sm font-normal text-neutral-500">—</span>
            )}
          </p>
        </div>
      </div>

      <button onClick={handlePlayAgain} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-neutral-900">
        Play Next Round
      </button>
    </div>
  );
}

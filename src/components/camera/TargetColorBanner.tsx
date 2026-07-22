import { ColorSwatch } from '../ui/ColorSwatch';
import type { TargetColor } from '../../types/color';

interface TargetColorBannerProps {
  targetColor: TargetColor;
  roundNumber: number;
}

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Hard',
};

/** Shows the color the player needs to find, overlaid on the camera view.
 *  Day 6b: includes a difficulty badge so players immediately know how hard
 *  the round is before they start hunting. */
export function TargetColorBanner({ targetColor, roundNumber }: TargetColorBannerProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-black/60 px-4 py-3 backdrop-blur-sm">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Round {roundNumber} · Find</p>
          {targetColor.difficulty && (
            <span className="text-xs rounded-full bg-white/10 px-2 py-0.5 text-neutral-300">
              {DIFFICULTY_BADGE[targetColor.difficulty] ?? targetColor.difficulty}
            </span>
          )}
        </div>
        <p className="text-lg font-semibold text-white">{targetColor.name}</p>
      </div>
      <ColorSwatch hex={targetColor.hex} label={targetColor.hex.toUpperCase()} size="sm" />
    </div>
  );
}

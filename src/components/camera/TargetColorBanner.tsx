import { ColorSwatch } from '../ui/ColorSwatch';
import type { TargetColor } from '../../types/color';

interface TargetColorBannerProps {
  targetColor: TargetColor;
  roundNumber: number;
}

/** Shows the color the player needs to find, overlaid on the camera view. */
export function TargetColorBanner({ targetColor, roundNumber }: TargetColorBannerProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-black/60 px-4 py-3 backdrop-blur-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-400">Round {roundNumber} · Find</p>
        <p className="text-lg font-semibold text-white">{targetColor.name}</p>
      </div>
      <ColorSwatch hex={targetColor.hex} label={targetColor.hex.toUpperCase()} size="sm" />
    </div>
  );
}

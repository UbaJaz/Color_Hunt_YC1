import { useTapSelection } from '../../hooks/useTapSelection';
import { TapRegionOverlay } from './TapRegionOverlay';
import type { TapSelection } from '../../hooks/useTapSelection';

interface PhotoPreviewProps {
  imageSrc: string;
  /** Natural pixel dimensions of the captured frame (matches the capture canvas). */
  width: number;
  height: number;
  onRetake: () => void;
  /** Fired when the player confirms their tapped color pick. */
  onConfirmSelection: (selection: TapSelection) => void;
}

export function PhotoPreview({ imageSrc, width, height, onRetake, onConfirmSelection }: PhotoPreviewProps) {
  const { selection, handleImageClick, reset } = useTapSelection(width, height);

  const handleRetake = () => {
    reset();
    onRetake();
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Kept `relative` so the tap-to-select crosshair/region overlay can be
          absolutely positioned on top without restructuring this component. */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <img src={imageSrc} alt="Captured" onClick={handleImageClick} className="h-full w-full object-cover" />
        {selection && <TapRegionOverlay point={selection.displayPoint} region={selection.displayRegion} />}
        {!selection && (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-white/80">
            Tap the color you want to match
          </p>
        )}
      </div>
      <div className="flex justify-center gap-3 bg-neutral-900 p-4">
        <button
          onClick={handleRetake}
          className="rounded-full bg-white/10 px-6 py-3 text-sm font-medium text-white"
        >
          Retake
        </button>
        <button
          onClick={() => selection && onConfirmSelection(selection)}
          disabled={!selection}
          className="rounded-full bg-white px-6 py-3 text-sm font-medium text-neutral-900 disabled:opacity-40"
        >
          Use This Color
        </button>
      </div>
    </div>
  );
}

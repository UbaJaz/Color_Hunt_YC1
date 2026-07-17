interface PhotoPreviewProps {
  imageSrc: string;
  onRetake: () => void;
}

export function PhotoPreview({ imageSrc, onRetake }: PhotoPreviewProps) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Kept `relative` so Day 2's tap-to-select crosshair/region overlay can be
          absolutely positioned on top without restructuring this component. */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <img src={imageSrc} alt="Captured" className="h-full w-full object-cover" />
      </div>
      <div className="flex justify-center bg-neutral-900 p-4">
        <button
          onClick={onRetake}
          className="rounded-full bg-white px-6 py-3 text-sm font-medium text-neutral-900"
        >
          Retake
        </button>
      </div>
    </div>
  );
}

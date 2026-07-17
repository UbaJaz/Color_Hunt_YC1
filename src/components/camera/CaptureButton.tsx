interface CaptureButtonProps {
  onCapture: () => void;
  disabled?: boolean;
}

export function CaptureButton({ onCapture, disabled }: CaptureButtonProps) {
  return (
    <button
      onClick={onCapture}
      disabled={disabled}
      aria-label="Capture photo"
      className="h-16 w-16 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm transition active:scale-95 disabled:opacity-40"
    />
  );
}

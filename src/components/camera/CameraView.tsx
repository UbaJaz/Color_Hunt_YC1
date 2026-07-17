import { useEffect } from 'react';
import { useCamera } from '../../hooks/useCamera';

interface CameraViewProps {
  /** Lets the parent grab the <video> element for capture without CameraView knowing about canvases. */
  onStreamReady?: (video: HTMLVideoElement) => void;
}

export function CameraView({ onStreamReady }: CameraViewProps) {
  const { status, videoRef, error, requestCamera } = useCamera();

  useEffect(() => {
    if (status === 'granted' && videoRef.current) {
      onStreamReady?.(videoRef.current);
    }
  }, [status, videoRef, onStreamReady]);

  if (status === 'unsupported') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-900 p-6 text-center text-white">
        <p className="text-lg font-semibold">Camera not supported</p>
        <p className="text-sm text-neutral-300">
          This browser doesn't support camera access. Try opening this page in Safari or Chrome.
        </p>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-neutral-900 p-6 text-center text-white">
        <p className="text-lg font-semibold">Camera access denied</p>
        <p className="text-sm text-neutral-300">
          {error ?? 'Enable camera permission for this site in your browser settings, then retry.'}
        </p>
        <button
          onClick={requestCamera}
          className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-900"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      {status === 'requesting' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-white">
          <p className="text-sm">Requesting camera access…</p>
        </div>
      )}
      {/* playsInline + muted + autoPlay are required for iOS Safari to render
          a live getUserMedia stream inline instead of blocking/fullscreening it. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="h-full w-full object-cover"
      />
    </div>
  );
}

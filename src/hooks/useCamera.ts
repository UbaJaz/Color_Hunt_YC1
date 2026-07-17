import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported';

interface UseCameraResult {
  status: CameraStatus;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  error: string | null;
  /** Re-request camera access (used for a "retry" affordance after denial). */
  requestCamera: () => void;
}

/**
 * Encapsulates getUserMedia lifecycle: permission request, stream attach/detach,
 * and cleanup on unmount. Rear camera is requested as an "ideal" constraint
 * (not hard) so devices without an exact match fall back gracefully instead of
 * throwing OverconstrainedError.
 */
export function useCamera(): UseCameraResult {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const requestCamera = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError('Camera access is not supported in this browser.');
      return;
    }

    setStatus('requesting');
    setError(null);

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      .then((mediaStream) => {
        stopStream();
        streamRef.current = mediaStream;
        setStream(mediaStream);
        setStatus('granted');
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown camera error';
        setStatus('denied');
        setError(message);
      });
  }, [stopStream]);

  // Attach the stream to the video element and explicitly call .play(),
  // since iOS Safari is inconsistent about implicit autoplay even with the
  // correct playsInline/muted/autoPlay attributes set on the element.
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.play().catch(() => {
        // Swallow play() rejection here; the element still shows the feed
        // once the user interacts with the page if autoplay is blocked.
      });
    }
  }, [stream]);

  // Request camera on mount.
  useEffect(() => {
    requestCamera();
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, stream, videoRef, error, requestCamera };
}

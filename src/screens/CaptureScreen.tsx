import { useCallback, useRef, useState } from 'react';
import { CameraView } from '../components/camera/CameraView';
import { CaptureButton } from '../components/camera/CaptureButton';
import { PhotoPreview } from '../components/camera/PhotoPreview';
import type { CapturedPhoto } from '../types/capture';

/**
 * Orchestrates the camera -> capture -> preview -> retake flow.
 *
 * The canvas lives here as a ref (not converted to a data URL for storage) so
 * the Day 2 color-science module can call canvasRef.current
 *   .getContext('2d').getImageData(...)
 * directly on the same element that produced the capture, with no
 * encode/decode round-trip. `capturedPhoto` state only drives which UI shows
 * (live feed vs. preview) — it is not the source of truth for pixel data.
 */
export function CaptureScreen() {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  // Gate the capture button on the video actually having usable dimensions,
  // so we never draw a blank/black frame before metadata has loaded.
  const [videoReady, setVideoReady] = useState(false);

  const handleStreamReady = useCallback((video: HTMLVideoElement) => {
    videoElRef.current = video;
    const markReady = () => setVideoReady(video.videoWidth > 0 && video.videoHeight > 0);
    if (video.readyState >= video.HAVE_METADATA) {
      markReady();
    }
    video.addEventListener('loadedmetadata', markReady);
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoElRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !videoReady) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setCapturedPhoto({
      previewSrc: canvas.toDataURL('image/jpeg', 0.92),
      width: canvas.width,
      height: canvas.height,
    });
  }, [videoReady]);

  const handleRetake = useCallback(() => {
    setCapturedPhoto(null);
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Canvas stays mounted (hidden) at all times so its ref is stable and
          reachable by future pixel-extraction code regardless of which UI
          branch below is showing. */}
      <canvas ref={canvasRef} className="hidden" />

      {capturedPhoto ? (
        <PhotoPreview imageSrc={capturedPhoto.previewSrc} onRetake={handleRetake} />
      ) : (
        <div className="relative flex-1">
          <CameraView onStreamReady={handleStreamReady} />
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-8 pt-4">
            <CaptureButton onCapture={handleCapture} disabled={!videoReady} />
          </div>
        </div>
      )}
    </div>
  );
}

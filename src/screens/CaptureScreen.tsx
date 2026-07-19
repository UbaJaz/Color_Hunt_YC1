import { useCallback, useRef, useState } from 'react';
import { CameraView } from '../components/camera/CameraView';
import { CaptureButton } from '../components/camera/CaptureButton';
import { PhotoPreview } from '../components/camera/PhotoPreview';
import { TargetColorBanner } from '../components/camera/TargetColorBanner';
import { useGameState } from '../state/GameStateContext';
import { extractColorFromCanvas, rgbToLab, deltaE2000, deltaEToScore } from '@color-science';
import type { CapturedPhoto } from '../types/capture';
import type { TapSelection } from '../hooks/useTapSelection';

interface CaptureScreenProps {
  /** Fired once a round result has been recorded, so the parent can navigate to the results screen. */
  onRoundResultReady: () => void;
}

/**
 * Orchestrates the camera -> capture -> tap-to-select -> confirm flow.
 *
 * The canvas lives here as a ref (not converted to a data URL for storage) so
 * @color-science's `extractColorFromCanvas()` can call
 *   canvasRef.current.getContext('2d').getImageData(...)
 * directly on the same element that produced the capture, with no
 * encode/decode round-trip. `capturedPhoto` state only drives which UI shows
 * (live feed vs. preview) — it is not the source of truth for pixel data.
 */
export function CaptureScreen({ onRoundResultReady }: CaptureScreenProps) {
  const { currentRound, state, recordResult } = useGameState();
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

  const handleConfirmSelection = useCallback(
    (selection: TapSelection) => {
      const canvas = canvasRef.current;
      const player = state.players[0];
      if (!canvas || !player) return;

      // Real dominant-color extraction: k-means + outlier rejection, run in
      // Lab space, via @color-science's extractColorFromCanvas(). This reads
      // pixels directly from the capture canvas at the tapped point — the
      // region it samples matches selection.naturalRegion (both derive from
      // the same selectRegion() default proportion).
      const extraction = extractColorFromCanvas(canvas, selection.naturalPoint.x, selection.naturalPoint.y);

      // CIEDE2000 scoring against the round's target color (Jaswin's
      // algorithm — consumed as-is, not duplicated here).
      const targetLab = rgbToLab(currentRound.targetColor.rgb);
      const deltaE = deltaE2000(extraction.extractedLab, targetLab);
      const score = deltaEToScore(deltaE);

      recordResult({
        playerId: player.id,
        region: extraction.region,
        extractedRgb: extraction.extractedRgb,
        deltaE,
        score,
      });

      onRoundResultReady();
    },
    [state.players, currentRound.targetColor, recordResult, onRoundResultReady]
  );

  return (
    <div className="flex h-full w-full flex-col">
      {/* Canvas stays mounted (hidden) at all times so its ref is stable and
          reachable by pixel-extraction code regardless of which UI branch below
          is showing. */}
      <canvas ref={canvasRef} className="hidden" />

      {capturedPhoto ? (
        <PhotoPreview
          imageSrc={capturedPhoto.previewSrc}
          width={capturedPhoto.width}
          height={capturedPhoto.height}
          onRetake={handleRetake}
          onConfirmSelection={handleConfirmSelection}
        />
      ) : (
        <div className="relative flex-1">
          <TargetColorBanner targetColor={currentRound.targetColor} roundNumber={currentRound.roundNumber} />
          <CameraView onStreamReady={handleStreamReady} />
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-8 pt-4">
            <CaptureButton onCapture={handleCapture} disabled={!videoReady} />
          </div>
        </div>
      )}
    </div>
  );
}

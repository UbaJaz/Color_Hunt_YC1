import { useCallback, useRef, useState } from 'react';
import { CameraView } from '../components/camera/CameraView';
import { CaptureButton } from '../components/camera/CaptureButton';
import { PhotoPreview } from '../components/camera/PhotoPreview';
import { TargetColorBanner } from '../components/camera/TargetColorBanner';
import { useGameState } from '../state/GameStateContext';
import { extractColorFromCanvas, rgbToLab, deltaE2000, deltaEToScore, calculateConfidence } from '@color-science';
import type { CapturedPhoto } from '../types/capture';
import type { TapSelection } from '../hooks/useTapSelection';
import { Timer } from '../components/ui/Timer';

interface CaptureScreenProps {
  onRoundResultReady: () => void;
}

export function CaptureScreen({ onRoundResultReady }: CaptureScreenProps) {
  const { state, currentRound, recordResult } = useGameState();
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const player = state.players[currentRound!.currentPlayerIndex];

  const handleStreamReady = useCallback((video: HTMLVideoElement) => {
    videoElRef.current = video;
    const markReady = () => setVideoReady(video.videoWidth > 0 && video.videoHeight > 0);
    if (video.readyState >= video.HAVE_METADATA) markReady();
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
      if (!canvas || !player || !currentRound) return;

      const extraction = extractColorFromCanvas(
        canvas, 
        selection.naturalPoint.x, 
        selection.naturalPoint.y,
        3, 2, 0.20,
        state.calibrationMatrix || undefined
      );

      const targetLab = rgbToLab(currentRound.targetColor.rgb);
      const deltaE = deltaE2000(extraction.extractedLab, targetLab);
      const score = deltaEToScore(deltaE);
      
      const confidence = calculateConfidence(extraction.extractedRgb, extraction.sampledPixels);

      recordResult({
        playerId: player.id,
        region: extraction.region,
        extractedRgb: extraction.extractedRgb,
        deltaE,
        score,
        confidence,
        bonusVotes: null,
        finalScore: null,
      });

      onRoundResultReady();
    },
    [state.calibrationMatrix, player, currentRound, recordResult, onRoundResultReady]
  );

  const handleTimeExpire = useCallback(() => {
    if (!capturedPhoto) {
      handleCapture();
    }
  }, [capturedPhoto, handleCapture]);

  if (!currentRound) return null;

  return (
    <div className="flex h-full w-full flex-col">
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
        <div className="relative flex-1 bg-black">
          <TargetColorBanner targetColor={currentRound.targetColor} roundNumber={currentRound.roundNumber} />
          <div className="absolute top-24 inset-x-0 z-10 flex justify-center">
            <div className="bg-black/50 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-4">
              <span className="text-white font-medium">{player?.name}'s Turn</span>
              <Timer durationSeconds={60} onExpire={handleTimeExpire} />
            </div>
          </div>
          <CameraView onStreamReady={handleStreamReady} />
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-8 pt-4">
            <CaptureButton onCapture={handleCapture} disabled={!videoReady} />
          </div>
        </div>
      )}
    </div>
  );
}

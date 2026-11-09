import { useCallback, useRef, useState } from 'react';
import { CameraView } from '../components/camera/CameraView';
import { CaptureButton } from '../components/camera/CaptureButton';
import { useGameState } from '../state/GameStateContext';
import { extractColorFromCanvas, estimateWhiteBalance, validateCalibrationCard } from '@color-science';
import { PhotoPreview } from '../components/camera/PhotoPreview';
import type { CapturedPhoto } from '../types/capture';
import type { TapSelection } from '../hooks/useTapSelection';

export function CalibrationScreen({ onCalibrationComplete }: { onCalibrationComplete: () => void }) {
  const { setCalibrationMatrix } = useGameState();
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleConfirmSelection = useCallback(
    (selection: TapSelection) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const extraction = extractColorFromCanvas(canvas, selection.naturalPoint.x, selection.naturalPoint.y);
      const check = validateCalibrationCard(extraction.extractedRgb);
      if (!check.ok) {
        setError(check.reason ?? 'Pick a plain white or grey paper.');
        setCapturedPhoto(null);
        return;
      }
      const matrix = estimateWhiteBalance(extraction.extractedRgb);
      
      setCalibrationMatrix(matrix);
      onCalibrationComplete();
    },
    [setCalibrationMatrix, onCalibrationComplete]
  );

  return (
    <div className="flex h-full w-full flex-col">
      <canvas ref={canvasRef} className="hidden" />

      {capturedPhoto ? (
        <PhotoPreview
          imageSrc={capturedPhoto.previewSrc}
          width={capturedPhoto.width}
          height={capturedPhoto.height}
          onRetake={() => setCapturedPhoto(null)}
          onConfirmSelection={handleConfirmSelection}
        />
      ) : (
        <div className="relative flex-1 bg-black">
          <div className="absolute inset-x-0 top-12 z-10 flex flex-col items-center text-center text-white text-shadow px-4 pointer-events-none">
             <h2 className="text-xl font-bold">Calibration</h2>
             <p className="text-sm opacity-80">Photograph a white/grey piece of paper</p>
             {error && <p className="mt-2 rounded-lg bg-red-600/80 px-3 py-1 text-sm">{error}</p>}
          </div>
          <button
            onClick={onCalibrationComplete}
            className="absolute right-4 top-4 z-20 rounded-full bg-black/60 px-3 py-1 text-xs text-white"
          >
            Skip, use default
          </button>
          <CameraView onStreamReady={handleStreamReady} />
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-8 pt-4">
            <CaptureButton onCapture={handleCapture} disabled={!videoReady} />
          </div>
        </div>
      )}
    </div>
  );
}

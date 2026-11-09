import { useCallback, useMemo, useRef, useState } from 'react';
import { CameraView } from '../components/camera/CameraView';
import { CaptureButton } from '../components/camera/CaptureButton';
import { PhotoPreview } from '../components/camera/PhotoPreview';
import { TargetColorBanner } from '../components/camera/TargetColorBanner';
import { useGameState } from '../state/GameStateContext';
import { extractColorFromCanvas, rgbToLab, deltaE2000, deltaEToMatchScore, calculateConfidence } from '@color-science';
import type { CapturedPhoto } from '../types/capture';
import type { TapSelection } from '../hooks/useTapSelection';
import { Timer } from '../components/ui/Timer';
import type { RGB, TargetColor } from '../types/color';
import type { PairPart } from '../types/game';
import { combineParts } from '../utils/pair';

const TURN_SECONDS = 45;
const PAIR_TURN_SECONDS = 60;

type Extraction = ReturnType<typeof extractColorFromCanvas>;

function partOf(ex: Extraction, target: RGB): PairPart {
  const deltaE = deltaE2000(ex.extractedLab, rgbToLab(target));
  return { extractedRgb: ex.extractedRgb, deltaE, score: deltaEToMatchScore(deltaE) };
}

/** Online play: the host scores, so this screen only reports the extracted colour (null = timed out). */
export interface OnlineCapture {
  targetColor: TargetColor;
  /** Two-colour rounds: the cool colour, captured after the warm one. */
  targetColor2?: TargetColor;
  roundNumber: number;
  theme?: string;
  playerName: string;
  memoryMode: boolean;
  onSubmit: (extractedRgb: RGB | null, extractedRgb2?: RGB | null) => void;
}

interface CaptureScreenProps {
  onRoundResultReady: () => void;
  online?: OnlineCapture;
}

export function CaptureScreen({ onRoundResultReady, online }: CaptureScreenProps) {
  const { state, currentRound: localRound, recordResult } = useGameState();
  const currentRound = useMemo(() => (online ? { targetColor: online.targetColor, targetColor2: online.targetColor2, roundNumber: online.roundNumber, theme: online.theme, currentPlayerIndex: 0 } : localRound), [online, localRound]);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [first, setFirst] = useState<{ extraction: Extraction } | null>(null); // two-colour rounds: the warm capture, waiting for the cool one

  const player = useMemo(() => (online ? { id: 'me', name: online.playerName } : state.players[currentRound!.currentPlayerIndex]), [online, state.players, currentRound]);

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

  /** Camera denied: load a picked photo into the same canvas the camera path uses. */
  const handleUpload = useCallback((file: File) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      setCapturedPhoto({ previewSrc: canvas.toDataURL('image/jpeg', 0.92), width: canvas.width, height: canvas.height });
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, []);

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
      const second = currentRound.targetColor2;

      // Two-colour round: keep the warm capture and go back to the camera for the cool one.
      if (second && !first) {
        setFirst({ extraction });
        setCapturedPhoto(null);
        return;
      }

      if (online) {
        online.onSubmit(first ? first.extraction.extractedRgb : extraction.extractedRgb, first ? extraction.extractedRgb : undefined);
        return;
      }

      const lastConfidence = calculateConfidence(extraction.extractedRgb, extraction.sampledPixels);
      const firstConfidence = first && calculateConfidence(first.extraction.extractedRgb, first.extraction.sampledPixels);
      // One poor-lighting capture is enough to offer a retake.
      const confidence = firstConfidence?.level === 'low' ? firstConfidence : lastConfidence;
      // Smooth curve (dE 5 -> 90, 15 -> 50, 30 -> 20, 60 -> ~6). The old `100 - deltaE`
      // gave ~40 points for a completely wrong hue, so every match looked okay.
      const scores = first && second
        ? combineParts([partOf(first.extraction, currentRound.targetColor.rgb), partOf(extraction, second.rgb)])
        : (({ extractedRgb, deltaE, score }) => ({ extractedRgb, deltaE, score }))(partOf(extraction, currentRound.targetColor.rgb));

      recordResult({
        playerId: player.id,
        region: extraction.region,
        confidence,
        bonusVotes: null,
        finalScore: null,
        ...scores,
        debugData: {
          naturalPoint: selection.naturalPoint,
          region: extraction.region,
          rawAverageRgb: extraction.rawAverageRgb,
          dominantClusterLab: extraction.dominantClusterLab,
          dominantClusterRgb: extraction.dominantClusterRgb,
          allClusterSizes: extraction.allClusterSizes,
          extractedRgb: extraction.extractedRgb,
          confidenceLevel: confidence.level,
          confidenceReasons: confidence.reasons,
        },
      });

      onRoundResultReady();
    },
    [state.calibrationMatrix, player, currentRound, recordResult, onRoundResultReady, online, first]
  );

  /** Out of time: no capture means no points (auto-scoring the frame centre rewarded doing nothing). A finished warm capture still counts. */
  const handleTimeExpire = useCallback(() => {
    if (!player || !currentRound) return;
    const second = currentRound.targetColor2;
    if (online) {
      online.onSubmit(first?.extraction.extractedRgb ?? null, second ? null : undefined);
      return;
    }
    const missing = { extractedRgb: null, deltaE: null, score: 0 };
    const scores = second
      ? combineParts([first ? partOf(first.extraction, currentRound.targetColor.rgb) : missing, missing])
      : missing;
    recordResult({
      playerId: player.id,
      region: null,
      confidence: null,
      bonusVotes: null,
      finalScore: null,
      ...scores,
    });
    onRoundResultReady();
  }, [player, currentRound, recordResult, onRoundResultReady, online, first]);

  if (!currentRound || !player) return null;

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
          <TargetColorBanner key={first ? 2 : 1} targetColor={first && currentRound.targetColor2 ? currentRound.targetColor2 : currentRound.targetColor} part={currentRound.targetColor2 ? (first ? 'cool colour 2 of 2' : 'warm colour 1 of 2') : undefined} roundNumber={currentRound.roundNumber} theme={currentRound.theme} hideSwatchAfterMs={(online ? online.memoryMode : state.settings?.memoryMode) ? 4000 : undefined} />
          <div className="absolute top-24 inset-x-0 z-10 flex justify-center">
            <div className="bg-black/50 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-4">
              <span className="text-white font-medium">{player?.name}'s Turn</span>
              <Timer durationSeconds={currentRound.targetColor2 ? PAIR_TURN_SECONDS : TURN_SECONDS} onExpire={handleTimeExpire} />
            </div>
          </div>
          <CameraView onStreamReady={handleStreamReady} onUpload={handleUpload} />
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-8 pt-4">
            <CaptureButton onCapture={handleCapture} disabled={!videoReady} />
          </div>
        </div>
      )}
    </div>
  );
}

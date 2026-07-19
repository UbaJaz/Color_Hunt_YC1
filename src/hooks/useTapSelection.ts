import { useCallback, useState, type MouseEvent } from 'react';
import type { Region } from '../types/color';
import { selectRegion } from '@color-science';
import { mapClientPointToImagePixel } from '../utils/imageCoordinates';

export interface TapSelection {
  /** Position in CSS pixels relative to the rendered <img>, for overlay placement. */
  displayPoint: { x: number; y: number };
  /** Position in natural image pixel space (matches the capture canvas), for pixel sampling. */
  naturalPoint: { x: number; y: number };
  /** Sample region in natural pixel space — matches the documented Region shape. */
  naturalRegion: Region;
  /** Sample region in CSS pixel space, for drawing the overlay rectangle. */
  displayRegion: Region;
}

interface UseTapSelectionResult {
  selection: TapSelection | null;
  handleImageClick: (event: MouseEvent<HTMLImageElement>) => void;
  reset: () => void;
}

/**
 * Turns a click/tap on the captured photo into a region selection.
 *
 * Region sizing/clipping is delegated to @color-science's `selectRegion()` —
 * the same function `extractColorFromCanvas()` uses internally — so the
 * crosshair/region overlay always matches exactly what will be sampled.
 */
export function useTapSelection(
  naturalWidth: number,
  naturalHeight: number,
  regionProportion = 0.2
): UseTapSelectionResult {
  const [selection, setSelection] = useState<TapSelection | null>(null);

  const handleImageClick = useCallback(
    (event: MouseEvent<HTMLImageElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();

      const naturalPoint = mapClientPointToImagePixel(
        event.clientX,
        event.clientY,
        rect,
        naturalWidth,
        naturalHeight
      );
      const displayPoint = {
        x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
        y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
      };

      setSelection({
        displayPoint,
        naturalPoint,
        naturalRegion: selectRegion(naturalPoint.x, naturalPoint.y, naturalWidth, naturalHeight, regionProportion),
        displayRegion: selectRegion(displayPoint.x, displayPoint.y, rect.width, rect.height, regionProportion),
      });
    },
    [naturalWidth, naturalHeight, regionProportion]
  );

  const reset = useCallback(() => setSelection(null), []);

  return { selection, handleImageClick, reset };
}

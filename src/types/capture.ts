/**
 * Minimal shape for representing a captured photo.
 *
 * The raw pixel buffer lives on a <canvas> reached via ref (see CaptureScreen),
 * not in this type or in React state — that's a deliberate Day 1 decision so the
 * color-science module (Day 2+) can call getImageData() on the same canvas
 * without any encode/decode round-trip. This type only tracks *whether* a
 * capture exists and how to preview it.
 */
export interface CapturedPhoto {
  /** Data URL used purely for <img> preview rendering — not for pixel analysis. */
  previewSrc: string;
  /** Pixel dimensions of the captured frame. */
  width: number;
  height: number;
}

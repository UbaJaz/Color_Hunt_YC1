export interface ImagePoint {
  x: number;
  y: number;
}

/**
 * Converts a click/tap position (viewport coordinates) into natural pixel
 * coordinates on the underlying image, accounting for the `object-fit:
 * cover` scaling and centering used by `PhotoPreview`'s <img>.
 *
 * `object-cover` scales the image up until it fills the container on both
 * axes, then centers and crops the overflow — so a naive ratio of
 * click-position-in-container to container-size does not match the
 * underlying pixel unless that scale/offset is undone first.
 */
export function mapClientPointToImagePixel(
  clientX: number,
  clientY: number,
  imgRect: DOMRect,
  naturalWidth: number,
  naturalHeight: number
): ImagePoint {
  const scale = Math.max(imgRect.width / naturalWidth, imgRect.height / naturalHeight);
  const displayedWidth = naturalWidth * scale;
  const displayedHeight = naturalHeight * scale;
  const offsetX = (displayedWidth - imgRect.width) / 2;
  const offsetY = (displayedHeight - imgRect.height) / 2;

  const localX = clientX - imgRect.left;
  const localY = clientY - imgRect.top;

  const naturalX = (localX + offsetX) / scale;
  const naturalY = (localY + offsetY) / scale;

  return {
    x: Math.min(Math.max(naturalX, 0), naturalWidth),
    y: Math.min(Math.max(naturalY, 0), naturalHeight),
  };
}

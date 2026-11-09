/**
 * A small JPEG of the whole captured frame, with a ring where the colour was sampled, so voters see the real object
 * and not just the extracted swatch. Returns undefined where canvas is unavailable (tests, very old browsers).
 */
export function makeThumbnail(source: HTMLCanvasElement, point?: { x: number; y: number }, maxSide = 360): string | undefined {
  try {
    if (!source.width || !source.height) return undefined;
    const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(source.width * scale));
    out.height = Math.max(1, Math.round(source.height * scale));
    const ctx = out.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(source, 0, 0, out.width, out.height);
    if (point) {
      const x = point.x * scale;
      const y = point.y * scale;
      const r = Math.max(8, Math.min(out.width, out.height) * 0.06);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const url = out.toDataURL('image/jpeg', 0.7);
    return url.startsWith('data:image/jpeg') ? url : undefined;
  } catch {
    return undefined;
  }
}

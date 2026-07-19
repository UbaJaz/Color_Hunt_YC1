import type { Region } from '../../types/color';

interface TapRegionOverlayProps {
  point: { x: number; y: number };
  region: Region;
}

/** Visual crosshair + sample-region rectangle drawn over the tapped point, in the same coordinate space as the underlying <img>. */
export function TapRegionOverlay({ point, region }: TapRegionOverlayProps) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <rect
        x={region.x}
        y={region.y}
        width={region.width}
        height={region.height}
        rx={4}
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      <line x1={point.x - 12} y1={point.y} x2={point.x + 12} y2={point.y} stroke="white" strokeWidth={2} />
      <line x1={point.x} y1={point.y - 12} x2={point.x} y2={point.y + 12} stroke="white" strokeWidth={2} />
      <circle cx={point.x} cy={point.y} r={4} fill="white" />
    </svg>
  );
}

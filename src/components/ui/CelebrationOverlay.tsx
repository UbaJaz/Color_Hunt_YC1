/**
 * CelebrationOverlay
 *
 * Pure-CSS confetti burst — zero runtime dependencies. Rendered as an
 * absolutely-positioned overlay. When `active` is true, 12 coloured dots
 * animate outward from the centre and fade. The animation is driven entirely
 * by the `animate-confetti` keyframe defined in index.css.
 *
 * Usage:
 *   import { CelebrationOverlay } from '../components/ui/CelebrationOverlay';
 *   <CelebrationOverlay active={isCelebrating} />
 */

interface CelebrationOverlayProps {
  active: boolean;
}

const CONFETTI_COLORS = [
  '#FF69B4', '#9932CC', '#FFD700', '#00CED1',
  '#FF6347', '#7FFF00', '#FF1493', '#00BFFF',
  '#FFA500', '#ADFF2F', '#FF69B4', '#BA55D3',
];

/** Spread angles in degrees for each particle */
const ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

export function CelebrationOverlay({ active }: CelebrationOverlayProps) {
  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      {ANGLES.map((angle, i) => (
        <div
          key={i}
          className="absolute h-3 w-3 rounded-full"
          style={{
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animation: `confettiBurst 1.4s ease-out forwards`,
            animationDelay: `${i * 30}ms`,
            '--angle': `${angle}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

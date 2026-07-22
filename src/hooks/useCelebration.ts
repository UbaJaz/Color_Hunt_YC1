import { useCallback, useEffect, useRef, useState } from 'react';
import type { RarityTier } from '@color-science';

export interface CelebrationOptions {
  /** Final score 0–100. Confetti fires if score ≥ 90. */
  score: number | null;
  /** Rarity tier of the captured colour. Confetti fires for rare / ultra-rare. */
  rarityTier: RarityTier | null;
}

export interface UseCelebrationResult {
  /** True while the confetti animation is active. */
  isCelebrating: boolean;
  /** Call to manually trigger a celebration (e.g. on-mount when score is known). */
  celebrate: () => void;
}

/** Minimum score that earns a confetti burst. */
const HIGH_SCORE_THRESHOLD = 90;

/**
 * Day 7b: useCelebration
 *
 * Fires confetti (CSS-keyframe burst via class toggle — zero npm dependencies)
 * and a short haptic pulse when the player earns a high score or captures a
 * rare / ultra-rare colour.
 *
 * The confetti element is rendered by <CelebrationOverlay /> in ResultsScreen.
 * The hook only manages *when* to fire; the visual is pure CSS.
 */
export function useCelebration({ score, rarityTier }: CelebrationOptions): UseCelebrationResult {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrate = useCallback(() => {
    setIsCelebrating(true);
    // Haptic feedback — silently ignored on non-supporting browsers
    if ('vibrate' in navigator) navigator.vibrate(250);
    // Auto-stop after animation completes (1.5s CSS duration)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsCelebrating(false), 1600);
  }, []);

  // Auto-trigger on mount / when score or tier becomes available
  useEffect(() => {
    const isHighScore = score !== null && score >= HIGH_SCORE_THRESHOLD;
    const isRareFind = rarityTier === 'rare' || rarityTier === 'ultra-rare';
    if (isHighScore || isRareFind) {
      celebrate();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, rarityTier]); // intentionally omit celebrate — stable ref

  return { isCelebrating, celebrate };
}

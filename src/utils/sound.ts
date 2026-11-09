import { getPrefs } from './prefs';

let ctx: AudioContext | null = null;

/** Short synthesized beep, no audio assets. Silently does nothing where Web Audio is unavailable or blocked, or when sound is off. */
export function beep(freq = 880, ms = 120, volume = 0.08) {
  if (!getPrefs().sound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    // autoplay policy or no Web Audio: sound is optional
  }
}

/** Vibrate where the browser supports it (not iOS Safari), unless haptics are off. */
export function haptic(pattern: number | number[] = 30) {
  if (getPrefs().haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}

const later = (fn: () => void, ms: number) => setTimeout(fn, ms);

/** Rising two-note chime for great scores and rare finds. */
export function chime() {
  beep(660, 120);
  later(() => beep(990, 220), 130);
}

/** Light click for taps that matter (capture, confirm, vote). */
export function tick() {
  beep(520, 40, 0.05);
  haptic(15);
}

/** Time ran out. */
export function buzz() {
  beep(180, 260, 0.1);
  haptic([80, 40, 80]);
}

/** Three rising notes for the final results. */
export function fanfare() {
  [523, 659, 784].forEach((f, i) => later(() => beep(f, i === 2 ? 380 : 150), i * 160));
  haptic([60, 40, 60, 40, 140]);
}

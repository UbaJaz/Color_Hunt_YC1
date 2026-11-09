let ctx: AudioContext | null = null;

/** Short synthesized beep, no audio assets. Silently does nothing where Web Audio is unavailable or blocked. */
export function beep(freq = 880, ms = 120, volume = 0.08) {
  try {
    ctx ??= new AudioContext();
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

/** Rising two-note chime for great scores and rare finds. */
export function chime() {
  beep(660, 120);
  setTimeout(() => beep(990, 220), 130);
}

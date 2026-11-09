import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { haptic, tick } from './sound';
import { setPref } from './prefs';

describe('haptics and sound preferences', () => {
  const vibrate = vi.fn();
  beforeEach(() => {
    localStorage.clear();
    vibrate.mockClear();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  });
  afterEach(() => localStorage.clear());

  it('vibrates by default and stays quiet when haptics are turned off', () => {
    haptic(20);
    expect(vibrate).toHaveBeenCalledWith(20);
    setPref('haptics', false);
    vibrate.mockClear();
    haptic(20);
    tick();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('never throws where Web Audio is missing', () => {
    expect(() => tick()).not.toThrow();
  });
});

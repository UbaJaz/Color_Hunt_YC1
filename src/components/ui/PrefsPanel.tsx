import { useState } from 'react';
import { getPrefs, setPref } from '../../utils/prefs';

/** Device-level options that outlive a game. */
export function PrefsPanel() {
  const [prefs, setPrefs] = useState(getPrefs);
  return (
    <label className="flex w-full max-w-sm items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm text-white">
      <span>
        Colour-blind aid
        <span className="block text-xs text-neutral-400">Show colour names and how a pick differs</span>
      </span>
      <input type="checkbox" checked={prefs.colourBlind} onChange={e => setPrefs(setPref('colourBlind', e.target.checked))} />
    </label>
  );
}

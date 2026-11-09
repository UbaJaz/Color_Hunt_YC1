import { useState } from 'react';
import { getPrefs, setPref, type Prefs } from '../../utils/prefs';

const ROWS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: 'colourBlind', label: 'Colour-blind aid', hint: 'Show colour names and how a pick differs' },
  { key: 'sound', label: 'Sound', hint: 'Beeps, chimes and the final fanfare' },
  { key: 'haptics', label: 'Vibration', hint: 'Taps and big scores (phones only)' },
];

/** Device-level options that outlive a game. */
export function PrefsPanel() {
  const [prefs, setPrefs] = useState(getPrefs);
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      {ROWS.map(row => (
        <label key={row.key} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm text-white">
          <span>
            {row.label}
            <span className="block text-xs text-neutral-400">{row.hint}</span>
          </span>
          <input type="checkbox" checked={prefs[row.key]} onChange={e => setPrefs(setPref(row.key, e.target.checked))} />
        </label>
      ))}
    </div>
  );
}

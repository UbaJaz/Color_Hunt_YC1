import { nearestColorName } from '../../utils/colorName';
import { getPrefs } from '../../utils/prefs';

interface ColorSwatchProps {
  hex: string;
  label: string;
  sublabel?: string;
  size?: 'sm' | 'lg';
}

/** A colored square with a label, used for target-color display and swatch comparisons. */
export function ColorSwatch({ hex, label, sublabel, size = 'lg' }: ColorSwatchProps) {
  const hexToRgb = (h: string) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
  const named = getPrefs().colourBlind && /^#[0-9a-f]{6}$/i.test(hex) ? nearestColorName(hexToRgb(hex)) : null;
  const dimensionClass = size === 'lg' ? 'h-24 w-24' : 'h-12 w-12';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${dimensionClass} rounded-2xl border border-white/20 shadow-inner`}
        style={{ backgroundColor: hex }}
      />
      <div className="text-center">
        <p className="text-sm font-medium text-white">{label}</p>
        {sublabel && <p className="text-xs uppercase tracking-wide text-neutral-400">{sublabel}</p>}
        {named && named.toLowerCase() !== sublabel?.toLowerCase() && <p className="text-xs font-semibold text-yellow-200">{named}</p>}
      </div>
    </div>
  );
}

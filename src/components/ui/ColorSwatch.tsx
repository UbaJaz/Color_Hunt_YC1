interface ColorSwatchProps {
  hex: string;
  label: string;
  sublabel?: string;
  size?: 'sm' | 'lg';
}

/** A colored square with a label, used for target-color display and swatch comparisons. */
export function ColorSwatch({ hex, label, sublabel, size = 'lg' }: ColorSwatchProps) {
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
      </div>
    </div>
  );
}

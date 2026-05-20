type Props = {
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
};

/**
 * Color picker baseado em `<input type="color">`. Renderiza um swatch quadrado
 * que abre o picker nativo do SO. O valor de entrada/saída é sempre `#rrggbb`.
 */
export function ColorPicker({ value, onChange, ariaLabel, disabled }: Props) {
  const safe = normalizeHex(value);
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white pl-1 pr-2 py-1',
        disabled ? 'opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      <input
        type="color"
        aria-label={ariaLabel}
        value={safe}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <span className="font-mono text-xs uppercase text-slate-600">{safe}</span>
    </span>
  );
}

function normalizeHex(input: string): string {
  if (!input) return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return input.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(input)) {
    const [, r, g, b] = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(input)!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return '#000000';
}

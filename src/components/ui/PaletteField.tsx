import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown } from 'lucide-react';
import { ColorPicker } from './ColorPicker';

const PALETTE = [
  '#1e293b', '#334155', '#1d4ed8', '#0369a1', '#0f766e',
  '#047857', '#b45309', '#c2410c', '#b91c1c', '#6d28d9',
];

/** Seletor compartilhado por botões de tarefa e tags. */
export function PaletteField({ value, onChange, label = 'Selecionar cor primária', disabled = false, compact = false }: {
  value: string; onChange: (value: string) => void; label?: string; disabled?: boolean; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  function select(color: string) { onChange(color); setOpen(false); }
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger disabled={disabled} aria-label={label} data-testid="cor-primaria-trigger"
      className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50">
      <span className="h-5 w-5 shrink-0 rounded border border-black/10" style={{ backgroundColor: value }} />
      {!compact && <span className="uppercase">{value}</span>}
      <ChevronDown size={13} />
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner sideOffset={4} collisionPadding={8} className="z-[1100]">
        <Popover.Popup aria-label={label} className="w-60 rounded-md border border-slate-200 bg-white p-3 shadow-lg" data-testid="cor-paleta">
          <Popover.Title className="mb-3 text-sm font-medium text-slate-800">Cores predefinidas</Popover.Title>
          <div className="grid grid-cols-5 gap-2">
            {PALETTE.map(color => <button key={color} type="button" aria-label={`Cor ${color}`} aria-pressed={value.toLowerCase() === color}
              data-testid="cor-swatch" onClick={() => select(color)} style={{ backgroundColor: color }}
              className={`h-8 w-8 rounded-full border border-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${value.toLowerCase() === color ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`} />)}
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <span className="mb-2 block text-xs font-medium text-slate-600">Cor personalizada</span>
            <ColorPicker value={value} onChange={select} ariaLabel={label === 'Selecionar cor primária' ? 'Cor personalizada' : `Cor personalizada: ${label}`} />
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

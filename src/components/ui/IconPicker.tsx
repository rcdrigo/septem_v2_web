import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { ICON_CATALOG, ICON_NAMES, renderIcon } from '@/lib/icon-catalog';

type Props = {
  value?: string;
  onChange: (next: string | undefined) => void;
};

/**
 * Seletor de ícone: botão compacto mostrando o ícone atual; abre um `Dialog`
 * com a grade curada (`ICON_CATALOG`). Permite limpar a seleção.
 */
export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {value && ICON_CATALOG[value] ? (
          <>
            {renderIcon(value, 16)}
            <span className="text-xs text-slate-500">{value}</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-slate-400"><ImageOff size={14} /> Sem ícone</span>
        )}
      </button>

      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Escolher ícone"
          footer={
            <>
              <button
                type="button"
                onClick={() => { onChange(undefined); setOpen(false); }}
                className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm"
              >
                Remover ícone
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm"
              >
                Fechar
              </button>
            </>
          }
        >
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {ICON_NAMES.map((name) => {
              const active = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => { onChange(name); setOpen(false); }}
                  className={[
                    'flex aspect-square items-center justify-center rounded-md border',
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {renderIcon(name, 18)}
                </button>
              );
            })}
          </div>
        </Dialog>
      )}
    </>
  );
}

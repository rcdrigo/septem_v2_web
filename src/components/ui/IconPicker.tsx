import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { ICON_NAMES, renderIcon } from '@/lib/icon-catalog';
import { FA_ALL_ICON_NAMES, FA_REGULAR_ICON_NAMES } from '@/lib/fa-icon-names';

const ALL_ICONS = [...ICON_NAMES, ...FA_ALL_ICON_NAMES.map(name => `fa-solid fa-${name}`), ...[...FA_REGULAR_ICON_NAMES].map(name => `fa-regular fa-${name}`)];

type Props = {
  value?: string;
  onChange: (next: string | undefined) => void;
  catalog?: 'actions' | 'all';
};

/**
 * Seletor de ícone: botão compacto mostrando o ícone atual; abre um `Dialog`
 * com ações comuns ou busca no catálogo completo, mantendo os ícones já salvos.
 */
export function IconPicker({ value, onChange, catalog = 'actions' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(96);
  const currentIcon = renderIcon(value, 16);
  const names = catalog === 'all' ? ALL_ICONS : ICON_NAMES;
  const filtered = names.filter(name => name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setQuery(''); setLimit(96); }}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {currentIcon ? (
          <>
            {currentIcon}
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
          {catalog === 'all' && <div className="mb-4 space-y-2">
            <label className="flex flex-col gap-2 text-sm text-slate-700">Buscar ícone
              <input type="search" autoFocus value={query} onChange={e => { setQuery(e.target.value); setLimit(96); }} placeholder="Nome do ícone, como building, heart ou envelope" className="w-full rounded-md border border-slate-300 px-3 py-2 text-base placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-slate-700" />
            </label>
            <p role="status" className="text-sm text-slate-600">{filtered.length} {filtered.length === 1 ? 'ícone encontrado' : 'ícones encontrados'} no catálogo completo.</p>
          </div>}
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {filtered.slice(0, limit).map((name) => {
              const active = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  aria-pressed={active}
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
          {filtered.length === 0 && <p className="py-4 text-sm text-slate-600">Nenhum ícone encontrado. Tente outro nome.</p>}
          {filtered.length > limit && <button type="button" className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2" onClick={() => setLimit(n => n + 96)}>Mostrar mais ícones</button>}
        </Dialog>
      )}
    </>
  );
}

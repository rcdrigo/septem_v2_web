import { useState } from 'react';
import { X } from 'lucide-react';
import { FA_ICON_NAMES, FA_STYLES, faClass } from '@/lib/fa-icons';
import { FA_ALL_ICON_NAMES, FA_REGULAR_ICON_NAMES } from '@/lib/fa-icon-names';

/** Quantos renderizar de uma vez (o catálogo completo tem ~1400). */
const MAX_RENDER = 300;

type Props = {
  /** Classe FontAwesome atual (ex.: "fa-solid fa-building"). */
  value?: string;
  onChange: (next: string | undefined) => void;
};

/**
 * Seletor de ícone FontAwesome: botão mostra o ícone atual; abre um painel com
 * caixa de pesquisa que filtra os ícones, exibindo preview + a classe
 * (fas-building / far-building).
 */
export function IconSearchPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [prefix, setPrefix] = useState<string>(value?.split(' ')[0] || 'fa-solid');

  const term = query.trim().toLowerCase();
  // Sem busca: lista curada de comuns (rápida). Com busca: catálogo COMPLETO (~1400).
  // No estilo "regular", só entram os que têm regular free (senão renderiza sólido).
  const hasRegular = prefix === 'fa-regular';
  const pool = term ? FA_ALL_ICON_NAMES : FA_ICON_NAMES;
  const filtered = pool.filter((n) => (!term || n.includes(term)) && (!hasRegular || FA_REGULAR_ICON_NAMES.has(n)));
  const names = filtered.slice(0, MAX_RENDER);
  const truncated = filtered.length > names.length;
  const shortOf = (p: string) => FA_STYLES.find((s) => s.prefix === p)?.short ?? p;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {value ? <><i className={`${value} text-slate-700`} /><span className="text-xs text-slate-500">{`${shortOf(value.split(' ')[0])}-${value.split(' fa-')[1] ?? ''}`}</span></> : <span className="text-slate-400">Sem ícone</span>}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-1 border-b border-slate-100 p-1.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Pesquisar em ${FA_ALL_ICON_NAMES.length} ícones…`}
              className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
            />
            <div className="flex overflow-hidden rounded border border-slate-200">
              {FA_STYLES.map((s) => (
                <button key={s.prefix} type="button" onClick={() => setPrefix(s.prefix)}
                  className={`px-1.5 py-1 text-[11px] font-medium ${prefix === s.prefix ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
                  {s.short}
                </button>
              ))}
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => { onChange(undefined); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50">
                <X size={13} /> Sem ícone
              </button>
            </li>
            {names.map((name) => {
              const cls = faClass(prefix, name);
              const active = cls === value;
              return (
                <li key={name}>
                  <button type="button" onClick={() => { onChange(cls); setOpen(false); }}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-50 ${active ? 'bg-slate-100' : ''}`}>
                    <i className={`${cls} w-4 text-center text-slate-700`} />
                    <span className="font-mono text-[11px] text-slate-500">{shortOf(prefix)}-{name}</span>
                  </button>
                </li>
              );
            })}
            {names.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">Nenhum ícone encontrado.</li>}
            {truncated && <li className="px-3 py-1.5 text-[11px] text-slate-400" data-testid="icon-truncado">Refine a busca para ver mais ({filtered.length} resultados).</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

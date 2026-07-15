import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { EXTENSION_CATALOG, ALL_EXTENSIONS, parseExtCsv, extCsv } from '@/lib/extensions';

/**
 * Seletor de extensões permitidas (campo de anexo): chips do que está escolhido +
 * busca pesquisável no catálogo (incl. CAD/arquitetura). Aceita digitar uma
 * extensão fora do catálogo e confirmar com Enter. Guarda como CSV.
 */
export function ExtensionPicker({ value, onChange }: { value: string | undefined; onChange: (csv: string) => void }) {
  const selected = parseExtCsv(value);
  const [q, setQ] = useState('');

  const sugestoes = useMemo(() => {
    const termo = q.trim().replace(/^\./, '').toLowerCase();
    const base = termo ? ALL_EXTENSIONS.filter((e) => e.includes(termo)) : ALL_EXTENSIONS;
    return base.filter((e) => !selected.includes(e)).slice(0, 12);
  }, [q, selected]);

  const add = (ext: string) => {
    const clean = ext.trim().replace(/^\./, '').toLowerCase();
    if (!clean || selected.includes(clean)) return;
    onChange(extCsv([...selected, clean]));
    setQ('');
  };
  const remove = (ext: string) => onChange(extCsv(selected.filter((e) => e !== ext)));

  return (
    <div className="flex flex-col gap-1.5" data-testid="ext-picker">
      <span className="text-xs font-medium text-slate-600">Extensões permitidas</span>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((e) => (
            <span key={e} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700" data-testid="ext-chip">
              .{e}
              <button type="button" onClick={() => remove(e)} className="text-slate-400 hover:text-rose-600" aria-label={`Remover ${e}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(q); } }}
        placeholder="Buscar ou digitar (ex.: dwg) e Enter…"
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />
      {q.trim() && (
        <div className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-1.5">
          {sugestoes.length === 0 && <span className="px-1 text-xs text-slate-400">Enter para adicionar “.{q.trim().replace(/^\./, '')}”.</span>}
          {sugestoes.map((e) => (
            <button key={e} type="button" onClick={() => add(e)} className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100">.{e}</button>
          ))}
        </div>
      )}
      {!q.trim() && selected.length === 0 && (
        <p className="text-[11px] text-slate-400">Vazio = aceita qualquer extensão (menos as bloqueadas nos Parâmetros). Ex.: {EXTENSION_CATALOG[5].exts.slice(0, 4).join(', ')}…</p>
      )}
    </div>
  );
}

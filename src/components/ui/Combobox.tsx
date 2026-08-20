import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsUpDown, Check, X } from 'lucide-react';

export type ComboOption = { value: string; label: string };

type Props = {
  value: string;
  options: ComboOption[];
  onChange: (next: string) => void;
  placeholder?: string;
  /** Texto do item que limpa a seleção (value ''). Se omitido, não exibe. */
  clearLabel?: string;
  disabled?: boolean;
  /**
   * Avisa quem chama que o texto de busca mudou. Use quando a lista é grande
   * demais para caber no cliente (ex.: usuários de uma prefeitura): o dono da
   * página busca no servidor e devolve `options` já filtradas.
   */
  onQueryChange?: (q: string) => void;
};

/**
 * Combobox pesquisável: botão mostra o rótulo atual; ao abrir, um input filtra
 * a lista por texto. Fecha no Esc / clique fora / seleção. Valor controlado.
 */
export function Combobox({ value, options, onChange, placeholder, clearLabel, disabled, onQueryChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  // Posiciona o painel (fixed) sob o botão — recalcula em scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      // Sem espaço abaixo (campo no fim de um diálogo alto, ou mobile), o painel
      // abriria fora da tela e ficaria inalcançável — nesse caso, abre para cima.
      const alturaPainel = Math.min(panelRef.current?.offsetHeight || 260, 260);
      const cabeAbaixo = r.bottom + 4 + alturaPainel <= window.innerHeight - 8;
      setRect({
        left: r.left,
        top: cabeAbaixo ? r.bottom + 4 : Math.max(8, r.top - 4 - alturaPainel),
        width: r.width,
      });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Com busca no servidor, `options` já vem filtrada — não filtrar de novo aqui
  // (o texto digitado pode não casar com o rótulo exato devolvido pelo backend).
  const filtered = query.trim() && !onQueryChange
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

  const fieldCls = 'flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-left focus:border-slate-500 focus:outline-none disabled:bg-slate-50';

  return (
    <div ref={rootRef} className="relative">
      <button type="button" disabled={disabled} className={fieldCls} onClick={() => setOpen((o) => !o)}>
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? selected.label : (placeholder ?? 'Selecione…')}
        </span>
        <ChevronsUpDown size={14} className="shrink-0 text-slate-400" />
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          // A lista abre em PORTAL (fora do contêiner do campo), então não dá para
          // alcançá-la escopando pelo pai. Como só um combobox fica aberto por vez,
          // este identificador endereça a lista aberta sem ambiguidade.
          data-testid="combobox-popover"
          style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, zIndex: 1010 }}
          className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 p-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onQueryChange?.(e.target.value);
              }}
              placeholder="Pesquisar…"
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1 text-sm">
            {clearLabel !== undefined && (
              <li>
                <button type="button" onClick={() => pick('')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-500 hover:bg-slate-50">
                  <X size={13} /> {clearLabel}
                </button>
              </li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-slate-50 ${o.value === value ? 'text-slate-900' : 'text-slate-700'}`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check size={13} className="shrink-0 text-slate-900" />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-2 text-slate-400">Nenhum resultado.</li>}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}

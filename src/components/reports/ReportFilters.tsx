import { useId, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { ArrowLeft, CalendarDays, Check, ChevronRight, Hash, Search, SlidersHorizontal, X } from 'lucide-react';
import '../execution/execution-filters.css';

export type ReportFilterItem = {
  id: string; label: string; type: 'text' | 'number' | 'date' | 'select';
  value: string; max?: string; range?: boolean; required?: boolean; options?: string[];
  onChange: (value: string, max?: string) => void;
};

export function ReportFilters({ items, onClear, busy }: { items: ReportFilterItem[]; onClear: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [mobileEditor, setMobileEditor] = useState(false);
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const categories = useRef(new Map<string, HTMLButtonElement>());
  const selected = items.find(item => item.id === selectedId) ?? items[0];
  const active = items.filter(item => item.value || item.max);
  const summary = (item: ReportFilterItem) => item.range ? `${item.value || 'Qualquer início'} – ${item.max || 'Sem limite'}` : item.value;
  function choose(key: string) {
    setSelectedId(key); setMobileEditor(true);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return <div className="execution-filters min-w-0 w-full sm:w-auto sm:flex-1">
    <Popover.Root open={open} triggerId={id} onOpenChange={value => { setOpen(value); if (!value) setMobileEditor(false); }}>
      <div className="flex flex-wrap items-center gap-2">
        <Popover.Trigger id={id} className="ef-trigger" disabled={!items.length}><SlidersHorizontal size={14} />Filtros{active.length > 0 && <span className="ef-count">{active.length}</span>}</Popover.Trigger>
        {active.map(item => <span key={item.id} className="ef-chip">
          <button type="button" className="ef-chip-label" title={`${item.label}: ${summary(item)}`} aria-label={`Editar filtro ${item.label}: ${summary(item)}`} onClick={() => { choose(item.id); setOpen(true); }}>{item.label}: {summary(item)}</button>
          <button type="button" className="ef-chip-remove" aria-label={`Remover filtro ${item.label}`} onClick={() => item.onChange('', '')}><X size={14} /></button>
        </span>)}
        {active.length > 0 && <button type="button" className="ef-link" onClick={onClear}>Limpar filtros</button>}
      </div>
      <Popover.Portal><Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={12} className="z-[1010]">
        <Popover.Popup className="ef-popup" data-testid="report-filters">
          <header className="ef-header"><div><Popover.Title className="font-semibold text-slate-900">Filtros</Popover.Title><Popover.Description className="mt-0.5 text-xs text-slate-600">As alterações são aplicadas automaticamente.</Popover.Description></div><Popover.Close className="ef-icon-button" aria-label="Fechar filtros"><X size={18} /></Popover.Close></header>
          <div className={`ef-body ${mobileEditor ? 'ef-editing' : ''}`}>
            <nav className="ef-categories" aria-label="Categorias de filtro">{items.map(item => {
              const Icon = item.value || item.max ? Check : item.type === 'date' ? CalendarDays : item.type === 'number' ? Hash : Search;
              return <button type="button" key={item.id} ref={node => { if (node) categories.current.set(item.id, node); else categories.current.delete(item.id); }} className="ef-category" aria-current={selected?.id === item.id ? 'true' : undefined} onClick={() => choose(item.id)}><Icon size={16} /><span className="min-w-0 break-words">{item.label}</span><ChevronRight size={14} className="ml-auto" /></button>;
            })}</nav>
            {selected && <section className="ef-editor" aria-labelledby={`${id}-heading`}>
              <button type="button" className="ef-back" onClick={() => { setMobileEditor(false); requestAnimationFrame(() => categories.current.get(selected.id)?.focus()); }}><ArrowLeft size={15} />Todos os filtros</button>
              <h3 id={`${id}-heading`} ref={heading} tabIndex={-1} className="mb-4 font-semibold text-slate-900 outline-none">{selected.label}</h3>
              {selected.type === 'select' ? <fieldset><legend className="sr-only">{selected.label}</legend>{['', ...(selected.options ?? [])].map(value => <label key={value} className="ef-option"><input type="radio" name={`${id}-choice`} checked={selected.value === value} onChange={() => selected.onChange(value)} /><span>{value || 'Qualquer valor'}</span></label>)}</fieldset> : selected.range ? <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">{selected.type === 'date' ? 'De' : 'Mínimo'}<input className="ef-input mt-2" type={selected.type} aria-label={`Mínimo de ${selected.label}`} value={selected.value} max={selected.max || undefined} onChange={e => selected.onChange(e.target.value, selected.max)} /></label>
                <label className="text-sm">{selected.type === 'date' ? 'Até' : 'Máximo'}<input className="ef-input mt-2" type={selected.type} aria-label={`Máximo de ${selected.label}`} value={selected.max ?? ''} min={selected.value || undefined} onChange={e => selected.onChange(selected.value, e.target.value)} /></label>
              </div> : <label className="block text-sm">{selected.type === 'text' ? 'Contém' : 'Valor'}<input className="ef-input mt-2" type={selected.type} aria-label={selected.label} value={selected.value} onChange={e => selected.onChange(e.target.value)} /></label>}
              {selected.required && <p className="mt-4 text-xs text-slate-600">Obrigatório para executar o relatório.</p>}
            </section>}
          </div>
          <footer className="ef-footer"><span role="status" className="text-xs text-slate-600">{busy ? 'Atualizando resultados…' : `${active.length} filtros ativos`}</span><button type="button" className="ef-link" disabled={!active.length} onClick={onClear}>Limpar filtros</button></footer>
        </Popover.Popup>
      </Popover.Positioner></Popover.Portal>
    </Popover.Root>
  </div>;
}

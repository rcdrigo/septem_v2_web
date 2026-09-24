import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Popover } from '@base-ui/react/popover';
import { ArrowLeft, ArrowUpDown, CalendarDays, Check, ChevronRight, CircleUserRound, Hash, Search, SlidersHorizontal, Tags, Workflow, X, CircleDot } from 'lucide-react';
import type { ProcessFacet, TagNameFacet, TaskFilters } from '@/lib/api/execution';
import './execution-filters.css';

export type ExecutionFilterValues = TaskFilters & {
  endedFrom?: string;
  endedTo?: string;
  relationship?: 'requester' | 'participant';
  status?: 'em_andamento' | 'concluido' | 'cancelado';
};
export type FilterChanges = Record<string, string | string[] | undefined>;
const filterKeys = ['q', 'number', 'process', 'processes', 'tagNames', 'requestedFrom', 'requestedTo', 'receivedFrom', 'receivedTo', 'endedFrom', 'endedTo', 'sort', 'dir', 'relationship', 'status'];
export const sameTagName = (a: string, b: string) => a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'accent' }) === 0;

/** A URL guarda todas as seleções, inclusive em navegação voltar/avançar. */
export function useExecutionFilters(kind: 'tasks' | 'requests', canUseTags: boolean) {
  const [params, setParams] = useSearchParams();
  const filters = useMemo<ExecutionFilterValues>(() => {
    const values: ExecutionFilterValues = {};
    for (const key of ['q', 'number', 'requestedFrom', 'requestedTo'] as const) values[key] = params.get(key) || undefined;
    const processes = [...params.getAll('processes'), ...params.getAll('process')].filter(value => value && value !== 'todos');
    values.processes = [...new Set(processes)];
    values.tagNames = canUseTags ? params.getAll('tagNames').map(v => v.trim()).filter((v, i, all) => v && all.findIndex(x => sameTagName(x, v)) === i) : [];
    if (params.get('sort') === 'numero' || (kind === 'tasks' && params.get('sort') === 'prazo')) {
      values.sort = params.get('sort') as TaskFilters['sort'];
      values.dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
    }
    if (kind === 'tasks') {
      values.receivedFrom = params.get('receivedFrom') || undefined;
      values.receivedTo = params.get('receivedTo') || undefined;
    } else {
      values.endedFrom = params.get('endedFrom') || undefined;
      values.endedTo = params.get('endedTo') || undefined;
      const status = params.get('status');
      if (status === 'em_andamento' || status === 'concluido' || status === 'cancelado') values.status = status;
      const relationship = params.get('relationship');
      if (relationship === 'requester' || relationship === 'participant') values.relationship = relationship;
    }
    return values;
  }, [params, kind, canUseTags]);
  const patch = (changes: FilterChanges) => setParams(current => {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach(item => { if (item.trim()) next.append(key, item.trim()); });
      else if (value) next.set(key, value);
    }
    if ('processes' in changes) next.delete('process');
    if (kind === 'tasks') next.delete('status');
    else next.set('page', '1');
    return next;
  }, { flushSync: true });
  // Links antigos de tarefas concluídas agora abrem a caixa de tarefas em andamento.
  useEffect(() => {
    if (kind === 'tasks' && params.has('status')) setParams(current => {
      const next = new URLSearchParams(current); next.delete('status'); return next;
    }, { replace: true });
  }, [kind, params, setParams]);
  const clear = () => patch(Object.fromEntries(filterKeys.map(key => [key, undefined])));
  return { filters, patch, clear };
}

type Category = { key: string; label: string; icon: typeof Search; summary?: string; clear: FilterChanges };
type Props = {
  kind: 'tasks' | 'requests';
  filters: ExecutionFilterValues;
  processes: ProcessFacet[];
  tagNames?: TagNameFacet[];
  busy?: boolean;
  onChange: (changes: FilterChanges) => void;
  onClear: () => void;
};
const situations = [{ key: 'em_andamento', label: 'Em andamento' }, { key: 'concluido', label: 'Concluídas' }, { key: 'cancelado', label: 'Canceladas' }];
const dateLabel = (v: string) => v.split('-').reverse().join('/');
const rangeLabel = (from?: string, to?: string) => from && to ? `${dateLabel(from)} – ${dateLabel(to)}` : from ? `Desde ${dateLabel(from)}` : to ? `Até ${dateLabel(to)}` : undefined;

export function ExecutionFilters({ kind, filters, processes, tagNames, busy, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('processes');
  const [mobileEditor, setMobileEditor] = useState(false);
  const [search, setSearch] = useState('');
  const triggerId = useId();
  const editorRef = useRef<HTMLHeadingElement>(null);
  const categoryRefs = useRef(new Map<string, HTMLButtonElement>());
  const names = useRef(new Map<string, string>());
  processes.forEach(p => names.current.set(p.key, p.name));
  const chosenProcesses = filters.processes ?? [];
  const chosenTags = filters.tagNames ?? [];
  const categories: Category[] = [
    { key: 'processes', label: 'Processos', icon: Workflow, summary: chosenProcesses.length ? chosenProcesses.map(key => names.current.get(key) ?? key).join(', ') : undefined, clear: { processes: undefined } },
    { key: 'q', label: 'Palavra-chave', icon: Search, summary: filters.q, clear: { q: undefined } },
    { key: 'number', label: 'Nº da requisição', icon: Hash, summary: filters.number, clear: { number: undefined } },
    { key: 'requested', label: kind === 'tasks' ? 'Data da requisição' : 'Data de abertura', icon: CalendarDays, summary: rangeLabel(filters.requestedFrom, filters.requestedTo), clear: { requestedFrom: undefined, requestedTo: undefined } },
    kind === 'tasks'
      ? { key: 'received', label: 'Data de recebimento', icon: CalendarDays, summary: rangeLabel(filters.receivedFrom, filters.receivedTo), clear: { receivedFrom: undefined, receivedTo: undefined } }
      : { key: 'ended', label: 'Data de encerramento', icon: CalendarDays, summary: rangeLabel(filters.endedFrom, filters.endedTo), clear: { endedFrom: undefined, endedTo: undefined } },
    ...(tagNames ? [{ key: 'tagNames', label: 'Tags', icon: Tags, summary: chosenTags.length ? chosenTags.join(', ') : undefined, clear: { tagNames: undefined } }] : []),
    ...(kind === 'requests' ? [
      { key: 'relationship', label: 'Meu vínculo', icon: CircleUserRound, summary: filters.relationship === 'requester' ? 'Feitas por mim' : filters.relationship === 'participant' ? 'Participei' : undefined, clear: { relationship: undefined } },
      { key: 'status', label: 'Situação', icon: CircleDot, summary: situations.find(s => s.key === filters.status)?.label, clear: { status: undefined } },
    ] : []),
    { key: 'sort', label: 'Ordenação', icon: ArrowUpDown, summary: filters.sort ? `${filters.sort === 'prazo' ? 'Prazo' : 'Número'} · ${filters.dir === 'asc' ? 'crescente' : 'decrescente'}` : undefined, clear: { sort: undefined, dir: undefined } },
  ];
  const active = categories.filter(c => c.summary);
  const selected = categories.find(c => c.key === category) ?? categories[0];
  const chooseCategory = (key: string) => {
    setCategory(key); setSearch(''); setMobileEditor(true);
    requestAnimationFrame(() => editorRef.current?.focus());
  };
  const processOptions = [...processes, ...chosenProcesses.filter(key => !processes.some(p => p.key === key)).map(key => ({ key, name: names.current.get(key) ?? key, count: 0 }))];
  const tagOptions = [...(tagNames ?? []), ...chosenTags.filter(name => !tagNames?.some(t => sameTagName(t.name, name))).map(name => ({ name, count: 0, available: false }))];
  const invalid = !busy && (chosenProcesses.some(key => !processes.some(p => p.key === key && p.count > 0)) || chosenTags.some(name => !tagNames?.some(t => sameTagName(t.name, name) && t.available)));
  const toggle = (key: 'processes' | 'tagNames', value: string) => {
    const values = filters[key] ?? [];
    const equals = key === 'tagNames' ? sameTagName : (a: string, b: string) => a === b;
    onChange({ [key]: values.some(v => equals(v, value)) ? values.filter(v => !equals(v, value)) : [...values, value] });
  };
  const choices = selected.key === 'processes'
    ? processOptions.map(p => ({ key: p.key, label: p.name, count: p.count, checked: chosenProcesses.includes(p.key), disabled: false }))
    : tagOptions.map(t => ({ key: t.name, label: t.name, count: t.count, checked: chosenTags.some(n => sameTagName(n, t.name)), disabled: !t.available && !chosenTags.some(n => sameTagName(n, t.name)) }));
  const visibleChoices = choices.filter(c => c.label.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));

  return <div className="execution-filters">
    <Popover.Root open={open} triggerId={triggerId} onOpenChange={next => { setOpen(next); if (!next) setMobileEditor(false); }}>
      <div className="flex flex-wrap items-center gap-2">
        <Popover.Trigger id={triggerId} data-testid="abrir-filtros" className="ef-trigger"><SlidersHorizontal size={14} />Filtros{active.length > 0 && <span className="ef-count">{active.length}</span>}</Popover.Trigger>
        {active.map(c => <span className="ef-chip" key={c.key}>
          <button type="button" title={`${c.label}: ${c.summary}`} aria-label={`Editar filtro ${c.label}: ${c.summary}`} onClick={() => { chooseCategory(c.key); setOpen(true); }} className="ef-chip-label">{c.label}: {c.summary}</button>
          <button type="button" aria-label={`Remover filtro ${c.label}`} className="ef-chip-remove" onClick={() => onChange(c.clear)}><X size={14} /></button>
        </span>)}
        {active.length > 0 && <button type="button" data-testid="limpar-filtros" onClick={onClear} className="ef-link">Limpar filtros</button>}
      </div>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={12} className="z-[1010]">
          <Popover.Popup data-testid="painel-filtros" className="ef-popup">
            <header className="ef-header"><div><Popover.Title className="font-semibold text-slate-900">Filtros</Popover.Title><Popover.Description className="mt-0.5 text-xs text-slate-600">As alterações são aplicadas automaticamente.</Popover.Description></div><Popover.Close aria-label="Fechar filtros" className="ef-icon-button"><X size={18} /></Popover.Close></header>
            <div className={`ef-body ${mobileEditor ? 'ef-editing' : ''}`}>
              <nav className="ef-categories" aria-label="Categorias de filtro">{categories.map(c => {
                const Icon = c.icon;
                return <button type="button" key={c.key} aria-label={c.label} title={c.summary ? `${c.label}: ${c.summary}` : undefined} ref={node => { if (node) categoryRefs.current.set(c.key, node); else categoryRefs.current.delete(c.key); }} aria-current={c.key === selected.key ? 'true' : undefined} onClick={() => chooseCategory(c.key)} className="ef-category">
                  {c.summary ? <Check size={16} className="text-sky-700" aria-label="Filtro ativo" /> : <Icon size={16} />}<span>{c.label}</span><ChevronRight size={14} className="ml-auto shrink-0" />
                </button>;
              })}</nav>
              <section className="ef-editor" aria-labelledby={`${triggerId}-editor`}>
                <button type="button" className="ef-back" onClick={() => { setMobileEditor(false); requestAnimationFrame(() => categoryRefs.current.get(selected.key)?.focus()); }}><ArrowLeft size={15} />Todos os filtros</button>
                <h3 id={`${triggerId}-editor`} ref={editorRef} tabIndex={-1} className="mb-4 font-semibold text-slate-900 outline-none">{selected.label}</h3>
                {(selected.key === 'processes' || selected.key === 'tagNames') && <>
                  <label className="ef-search"><Search size={16} /><input type="search" aria-label={selected.key === 'processes' ? 'Buscar processo' : 'Buscar tag'} placeholder={selected.key === 'processes' ? 'Buscar processo…' : 'Buscar tag…'} value={search} onChange={e => setSearch(e.target.value)} /></label>
                  <div className="my-3 flex items-center justify-between gap-3 text-xs text-slate-600"><span>{selected.key === 'processes' ? 'Qualquer processo selecionado' : 'Todas as tags selecionadas'}</span><button type="button" className="ef-link" onClick={() => onChange(selected.clear)}>Limpar seleção</button></div>
                  <div className="ef-options" data-testid={selected.key === 'tagNames' ? 'filtro-tags' : 'filtro-processos'}>{visibleChoices.map(c => <label key={c.key} className={`ef-option ${c.disabled ? 'ef-option-disabled' : ''}`}>
                    <input type="checkbox" checked={c.checked} disabled={c.disabled} onChange={() => toggle(selected.key as 'processes' | 'tagNames', c.key)} /><span className="min-w-0 flex-1 break-words">{c.label}</span><span className="text-xs tabular-nums text-slate-600">{c.count}</span>
                  </label>)}{visibleChoices.length === 0 && <p className="py-6 text-sm text-slate-600">{busy ? 'Carregando opções…' : search ? 'Nenhuma opção encontrada para esta busca.' : 'Nenhuma opção disponível para os filtros atuais.'}</p>}</div>
                </>}
                {(selected.key === 'q' || selected.key === 'number') && <label className="block text-sm text-slate-700">{selected.key === 'q' ? (kind === 'tasks' ? 'Processo, tarefa ou palavra-chave' : 'Processo ou palavra-chave') : 'Número exato da requisição'}<input className="ef-input mt-2" type={selected.key === 'q' ? 'search' : 'text'} inputMode={selected.key === 'number' ? 'numeric' : undefined} data-testid={selected.key === 'q' ? 'filtro-q' : 'filtro-numero'} value={filters[selected.key] ?? ''} placeholder={selected.key === 'q' ? 'Ex.: compra de material' : 'Ex.: 184'} onChange={e => onChange({ [selected.key]: e.target.value || undefined })} /></label>}
                {(['requested', 'received', 'ended'].includes(selected.key)) && <DateRange key={selected.key} category={selected.key as 'requested' | 'received' | 'ended'} filters={filters} onChange={onChange} />}
                {selected.key === 'relationship' && <fieldset><legend className="mb-3 text-sm text-slate-600">Mostrar requisições vinculadas a você</legend>{[{ key: 'requester', label: 'Feitas por mim' }, { key: 'participant', label: 'Participei' }].map(option => <label className="ef-option" key={option.key}><input type="checkbox" checked={!filters.relationship || filters.relationship === option.key} onChange={() => onChange({ relationship: !filters.relationship ? (option.key === 'requester' ? 'participant' : 'requester') : undefined })} /><span>{option.label}</span></label>)}<p className="mt-4 text-xs leading-relaxed text-slate-600">“Participei” inclui requisições em que você concluiu uma tarefa. Ao remover a última seleção, os dois vínculos são restaurados.</p></fieldset>}
                {selected.key === 'status' && <fieldset><legend className="sr-only">Situação da requisição</legend>{[{ key: '', label: 'Todas as situações' }, ...situations].map(option => <label className="ef-option" key={option.key}><input type="radio" name={`${triggerId}-status`} checked={(filters.status ?? '') === option.key} onChange={() => onChange({ status: option.key || undefined })} /><span>{option.label}</span></label>)}</fieldset>}
                {selected.key === 'sort' && <div className="space-y-4"><label className="block text-sm text-slate-700">Ordenar por<select className="ef-input mt-2" data-testid="filtro-ordenar" value={filters.sort ?? ''} onChange={e => onChange({ sort: e.target.value || undefined, dir: e.target.value ? (filters.dir ?? 'asc') : undefined })}><option value="">Mais recentes</option>{kind === 'tasks' && <option value="prazo">Prazo</option>}<option value="numero">Nº da requisição</option></select></label>{filters.sort && <fieldset><legend className="mb-2 text-sm text-slate-700">Direção</legend>{[{ key: 'asc', label: 'Crescente' }, { key: 'desc', label: 'Decrescente' }].map(o => <label className="ef-option" key={o.key}><input type="radio" name={`${triggerId}-dir`} checked={filters.dir === o.key} onChange={() => onChange({ dir: o.key })} /><span>{o.label}</span></label>)}</fieldset>}</div>}
              </section>
            </div>
            <footer className="ef-footer"><span role="status" className="text-xs text-slate-600">{busy ? 'Atualizando resultados…' : `${active.length} ${active.length === 1 ? 'filtro ativo' : 'filtros ativos'}`}</span><button type="button" onClick={onClear} disabled={active.length === 0} className="ef-link disabled:opacity-50">Limpar filtros</button></footer>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    {invalid && <p role="status" className="mt-3 text-sm text-amber-800">Uma seleção não possui resultados disponíveis. Revise os filtros ou remova a seleção.</p>}
  </div>;
}

function DateRange({ category, filters, onChange }: { category: 'requested' | 'received' | 'ended'; filters: ExecutionFilterValues; onChange: Props['onChange'] }) {
  const fromKey = `${category}From` as const;
  const toKey = `${category}To` as const;
  const from = filters[fromKey];
  const to = filters[toKey];
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const preset = (value: string) => {
    if (!value) { onChange({ [fromKey]: undefined, [toKey]: undefined }); return; }
    const end = new Date(); const start = new Date();
    if (value === 'week') start.setDate(start.getDate() - 6);
    if (value === 'month') start.setDate(1);
    onChange({ [fromKey]: iso(start), [toKey]: iso(end) });
  };
  return <div>
    <div className="mb-5 flex flex-wrap gap-2" aria-label="Períodos rápidos">{[{ key: '', label: 'Todo o período' }, { key: 'today', label: 'Hoje' }, { key: 'week', label: 'Últimos 7 dias' }, { key: 'month', label: 'Este mês' }].map(p => <button type="button" className="ef-preset" key={p.key} onClick={() => preset(p.key)}>{p.label}</button>)}</div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="block min-w-0 text-sm text-slate-700">De<input type="date" className="ef-input mt-2" aria-label={`${category === 'requested' ? 'Requisição' : category === 'received' ? 'Recebimento' : 'Encerramento'} de`} value={from ?? ''} max={to} onChange={e => { const value = e.target.value; onChange({ [fromKey]: value || undefined, ...(value && to && value > to ? { [toKey]: value } : {}) }); }} /></label><label className="block min-w-0 text-sm text-slate-700">Até<input type="date" className="ef-input mt-2" aria-label={`${category === 'requested' ? 'Requisição' : category === 'received' ? 'Recebimento' : 'Encerramento'} até`} value={to ?? ''} min={from} onChange={e => { const value = e.target.value; onChange({ [toKey]: value || undefined, ...(value && from && value < from ? { [fromKey]: value } : {}) }); }} /></label></div>
    <p className="mt-4 text-xs leading-relaxed text-slate-600">O intervalo inclui o primeiro e o último dia.{category === 'ended' && ' Requisições ainda abertas não aparecem neste intervalo.'}</p>
  </div>;
}

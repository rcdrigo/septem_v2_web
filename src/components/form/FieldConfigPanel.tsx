import { useEffect, useState } from 'react';
import { MousePointerClick } from 'lucide-react';

type Opt = { value: string; label: string };
type MaskOpt = Opt & { regex: string; shouldValidate: boolean };
type Tab = 'geral' | 'aparencia' | 'validacao' | 'septem' | 'eventos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'validacao', label: 'Validação' },
  { id: 'septem', label: 'Septem' },
  { id: 'eventos', label: 'Eventos' },
];

const EVENT_TYPES: Opt[] = [
  { value: 'change', label: 'Alteração (change)' },
  { value: 'click', label: 'Clique (click)' },
  { value: 'blur', label: 'Saída de foco (blur)' },
  { value: 'focus', label: 'Foco (focus)' },
];

const OPTION_TYPES = new Set(['select', 'radio', 'checklist', 'taglist']);
const MASKABLE = new Set(['textfield', 'number', 'textarea', 'datetime']);
const PRESENTATION = new Set(['text', 'html', 'image', 'spacer', 'separator', 'table', 'iframe']);
const CONTAINER = new Set(['group', 'dynamiclist']);
const VALIDATABLE = new Set(['textfield', 'textarea', 'number', 'datetime']);
/** Tipos sem "rótulo" (conteúdo vem de outras propriedades, ou nenhum). */
const NO_LABEL = new Set(['text', 'html', 'image', 'spacer', 'separator']);

/** Divide as abas em linhas que sempre preenchem 100% (no máx. 3 por linha). */
function chunkTabs<T>(arr: T[]): T[][] {
  const n = arr.length;
  if (n <= 3) return [arr];
  if (n === 4) return [arr.slice(0, 2), arr.slice(2)];
  const rows: T[][] = [];
  for (let i = 0; i < n; i += 3) rows.push(arr.slice(i, i + 3));
  return rows;
}

/** Ids das abas relevantes para o tipo do campo (áudio: "reorganizar conforme o tipo"). */
function availableTabIds(field: any): Tab[] {
  const type = field?.type;
  const isPresentation = PRESENTATION.has(type);
  const isContainer = CONTAINER.has(type);
  const isInput = !!field?.key && !isPresentation && !isContainer;
  return TABS.filter((t) => {
    switch (t.id) {
      case 'validacao': return VALIDATABLE.has(type);
      case 'septem': return isInput || isContainer;
      case 'eventos': return isInput;
      default: return true; // geral, aparencia
    }
  }).map((t) => t.id);
}

/**
 * Painel de configuração do CAMPO selecionado, agrupado por categoria em abas
 * (cockpit). Lê/edita o campo via a engine do form-js (`editField`).
 */
export function FieldConfigPanel({ field, editField, masks, dataSources }: {
  field: any | null;
  editField: (field: any, path: string[], value: unknown) => void;
  masks: MaskOpt[];
  dataSources: Opt[];
}) {
  const [tab, setTab] = useState<Tab>('geral');
  const [, force] = useState(0);

  // Se o tipo do campo mudou e a aba ativa não existe mais, volta pra Geral.
  // (Hook ANTES de qualquer early return — senão a contagem de hooks varia.)
  useEffect(() => {
    if (field && !availableTabIds(field).includes(tab)) setTab('geral');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.type]);

  if (!field) {
    return (
      <aside className="hidden w-80 shrink-0 flex-col border-l border-slate-200 bg-white lg:flex">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-slate-400">
          <MousePointerClick size={26} />
          <p className="text-sm">Selecione um campo no formulário para configurá-lo.</p>
        </div>
      </aside>
    );
  }

  const set = (path: string[], value: unknown) => { editField(field, path, value); force((n) => n + 1); };
  const merge = (key: string, patch: Record<string, unknown>) => set([key], { ...(field[key] || {}), ...patch });
  const props: Record<string, string> = field.properties || {};
  const validate: Record<string, unknown> = field.validate || {};
  const appearance: Record<string, string> = field.appearance || {};
  const isInput = !!field.key && !PRESENTATION.has(field.type) && !CONTAINER.has(field.type);
  const supportsOptions = OPTION_TYPES.has(field.type);

  const ids = availableTabIds(field);
  const availableTabs = TABS.filter((t) => ids.includes(t.id));

  // events: persistido como JSON em properties.septemEvents (array de {type, action}).
  const events: { type: string; action: string }[] = (() => {
    try { return props.septemEvents ? JSON.parse(props.septemEvents) : []; } catch { return []; }
  })();
  const setEvents = (arr: { type: string; action: string }[]) =>
    merge('properties', { septemEvents: arr.length ? JSON.stringify(arr) : undefined });

  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white lg:flex">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">Configurações do campo</h2>
        <p className="text-xs text-slate-400">{labelOfType(field.type)}{field.key ? ` · ${field.key}` : ''}</p>
      </div>

      {/* Abas dinâmicas por tipo; cada linha preenche 100% (no máx. 3 por linha). */}
      <div className="m-3 flex flex-col gap-1 rounded-md bg-slate-100 p-1">
        {chunkTabs(availableTabs).map((row, ri) => (
          <div key={ri} className="flex gap-1">
            {row.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`flex-1 rounded px-1 py-1 text-center text-xs font-medium transition ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-200/70 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'geral' && (
          <div className="flex flex-col gap-3">
            {/* Conteúdo dos elementos de apresentação (não têm "rótulo"). */}
            {field.type === 'text' && <TextArea label="Conteúdo (Markdown)" value={field.text ?? ''} onChange={(v) => set(['text'], v)} />}
            {field.type === 'html' && <TextArea label="Conteúdo (HTML)" value={field.content ?? ''} onChange={(v) => set(['content'], v)} />}
            {field.type === 'image' && <Text label="Origem (URL ou expressão)" value={field.source ?? ''} onChange={(v) => set(['source'], v)} />}
            {field.type === 'image' && <Text label="Texto alternativo" value={field.alt ?? ''} onChange={(v) => set(['alt'], v)} />}
            {!NO_LABEL.has(field.type) && <Text label="Rótulo" value={field.label ?? ''} onChange={(v) => set(['label'], v)} />}
            {isInput && <Text label="Chave (identificador)" value={field.key ?? ''} readOnly hint="Gerado a partir do rótulo." />}
            {isInput && <Check label="Obrigatório" checked={!!validate.required} onChange={(b) => merge('validate', { required: b })} />}
            {isInput && <TextArea label="Descrição (ajuda inline)" value={field.description ?? ''} onChange={(v) => set(['description'], v)} />}
            {(field.type === 'spacer' || field.type === 'separator') && (
              <p className="text-sm text-slate-400">Este elemento não tem configurações em Geral.</p>
            )}
          </div>
        )}

        {tab === 'aparencia' && (
          <div className="flex flex-col gap-3">
            {isInput && <Text label="Prefixo" value={appearance.prefixAdorner ?? ''} onChange={(v) => merge('appearance', { prefixAdorner: v || undefined })} />}
            {isInput && <Text label="Sufixo" value={appearance.suffixAdorner ?? ''} onChange={(v) => merge('appearance', { suffixAdorner: v || undefined })} />}
            <NumberInput label="Colunas (no container)" value={field.layout?.columns}
              onChange={(n) => merge('layout', { columns: n })} hint="Quantas colunas do grid o campo ocupa." />
            <NumberInput label="Largura (px)" value={props.septemWidth}
              onChange={(n) => merge('properties', { septemWidth: n != null ? String(n) : undefined })} hint="Vazio = largura da coluna." />
          </div>
        )}

        {tab === 'validacao' && (
          <div className="flex flex-col gap-3">
            <NumberInput label="Mín. caracteres" value={validate.minLength} onChange={(n) => merge('validate', { minLength: n })} />
            <NumberInput label="Máx. caracteres" value={validate.maxLength} onChange={(n) => merge('validate', { maxLength: n })} />
            {field.type === 'number' && <NumberInput label="Valor mínimo" value={validate.min} onChange={(n) => merge('validate', { min: n })} />}
            {field.type === 'number' && <NumberInput label="Valor máximo" value={validate.max} onChange={(n) => merge('validate', { max: n })} />}
            {!isInput && <p className="text-sm text-slate-400">Este elemento não tem validação.</p>}
          </div>
        )}

        {tab === 'septem' && (
          <div className="flex flex-col gap-3">
            {MASKABLE.has(field.type) && (
              <Select label="Máscara" value={props.septemMaskId ?? ''} options={[{ value: '', label: '— nenhuma —' }, ...masks]}
                onChange={(v) => {
                  const m = masks.find((o) => o.value === v);
                  merge('properties', { septemMaskId: v || undefined, septemMaskRegex: m?.regex, septemMaskValidate: m?.shouldValidate ? 'true' : undefined });
                }} />
            )}
            {supportsOptions && (
              <Select label="Fonte de dados (opções)" value={props.septemDataSourceId ?? ''} options={[{ value: '', label: '— nenhuma —' }, ...dataSources]}
                onChange={(v) => merge('properties', { septemDataSourceId: v || undefined })} />
            )}
            <Select label="Tipo de ajuda" value={props.septemHelpType ?? 'inline'} options={[{ value: 'inline', label: 'Inline' }, { value: 'popover', label: 'Popover' }]}
              onChange={(v) => merge('properties', { septemHelpType: v })} />
            <TextArea label="Texto de ajuda" value={props.septemHelpText ?? ''} onChange={(v) => merge('properties', { septemHelpText: v || undefined })} />
            <Select label="Visível no relatório" value={props.septemVisReport === 'no' ? 'no' : 'yes'} options={YESNO}
              onChange={(v) => merge('properties', { septemVisReport: v === 'no' ? 'no' : undefined })} />
            <Select label="Visível ao requisitante" value={props.septemVisRequester === 'no' ? 'no' : 'yes'} options={YESNO}
              onChange={(v) => merge('properties', { septemVisRequester: v === 'no' ? 'no' : undefined })} />
          </div>
        )}

        {tab === 'eventos' && (
          <div className="flex flex-col gap-3">
            {events.length === 0 && <p className="text-sm text-slate-400">Nenhum evento. Adicione abaixo.</p>}
            {events.map((ev, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2">
                <Select label="Evento" value={ev.type} options={EVENT_TYPES}
                  onChange={(v) => setEvents(events.map((e, j) => (j === i ? { ...e, type: v } : e)))} />
                <TextArea label="Ação" value={ev.action}
                  onChange={(v) => setEvents(events.map((e, j) => (j === i ? { ...e, action: v } : e)))} />
                <button type="button" className="self-end text-xs font-medium text-red-600 hover:underline"
                  onClick={() => setEvents(events.filter((_, j) => j !== i))}>Remover</button>
              </div>
            ))}
            <button type="button" className="rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              onClick={() => setEvents([...events, { type: 'change', action: '' }])}>+ Adicionar evento</button>
            <p className="text-[11px] text-slate-400">
              Ação: função a chamar com seus parâmetros — pode ser o próprio campo, variáveis ou outros campos do formulário.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

const YESNO: Opt[] = [{ value: 'yes', label: 'Sim' }, { value: 'no', label: 'Não' }];
const TYPE_LABELS: Record<string, string> = {
  textfield: 'Texto', textarea: 'Área de texto', number: 'Número', datetime: 'Data/Hora',
  select: 'Lista', radio: 'Opções', checkbox: 'Caixa de seleção', checklist: 'Múltipla escolha',
  filepicker: 'Upload', group: 'Grupo', dynamiclist: 'Lista dinâmica',
};
function labelOfType(t: string) { return TYPE_LABELS[t] ?? t; }

// ── controles ────────────────────────────────────────────────────────────────
const fieldCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none read-only:bg-slate-50 read-only:text-slate-500';

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-600">{children}</label>;
}
function Text({ label, value, onChange, readOnly, hint }: { label: string; value: string; onChange?: (v: string) => void; readOnly?: boolean; hint?: string }) {
  return <div><Lbl>{label}</Lbl><input className={fieldCls} value={value} readOnly={readOnly} onChange={(e) => onChange?.(e.target.value)} />{hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}</div>;
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><Lbl>{label}</Lbl><textarea rows={2} className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function NumberInput({ label, value, onChange, hint }: { label: string; value: unknown; onChange: (n: number | undefined) => void; hint?: string }) {
  return <div><Lbl>{label}</Lbl><input type="number" className={fieldCls} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />{hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}</div>;
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: Opt[]; onChange: (v: string) => void }) {
  return <div><Lbl>{label}</Lbl><select className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}

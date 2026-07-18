import { useEffect, useState } from 'react';
import { MousePointerClick, Pencil, ExternalLink } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { DataSourceSelect } from '@/components/modelador/fields/DataSourceSelect';
import { IconSearchPicker } from '@/components/ui/IconSearchPicker';
import { slugify } from '@/lib/slugify';
import { DOC_KIND_OPTIONS } from '@/lib/documento';
import { DATE_MODE_OPTIONS, DATE_LIMIT_OPTIONS } from '@/lib/datafield';
import { ExtensionPicker } from '@/components/form/ExtensionPicker';
import { DocumentGenConfig, parseDocGen } from '@/components/form/DocumentGenConfig';
import { useFormStore } from '@/stores/form';
import { fetchDataSourceOptions } from '@/lib/api/catalog';
import { openTab } from '@/lib/nav';
import { toast } from '@/stores/toast';
import { Switch } from '@/components/ui/Field';
import { HelpPopover } from '@/components/ui/HelpPopover';

type Opt = { value: string; label: string };
type MaskOpt = Opt & { regex: string; template?: string | null; shouldValidate: boolean };
type Tab = 'geral' | 'validacao' | 'aparencia' | 'eventos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'validacao', label: 'Validação' },
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
/** Tipos que exibem o seletor de Fonte de dados na aba Geral. */
const FONTE_DADOS_TYPES = new Set(['textfield', 'number', 'datetime', 'select', 'radio', 'checklist', 'taglist', 'text', 'image']);

/** Divide as abas em linhas que sempre preenchem 100% (no máx. 3 por linha). */
function chunkTabs<T>(arr: T[]): T[][] {
  const n = arr.length;
  if (n <= 3) return [arr];
  if (n === 4) return [arr.slice(0, 2), arr.slice(2)];
  const rows: T[][] = [];
  for (let i = 0; i < n; i += 3) rows.push(arr.slice(i, i + 3));
  return rows;
}

/** Ids das abas relevantes para o tipo do campo. */
function availableTabIds(field: any): Tab[] {
  const type = field?.type;
  const isInput = !!field?.key && !PRESENTATION.has(type) && !CONTAINER.has(type);
  return TABS.filter((t) => {
    switch (t.id) {
      case 'validacao': return type === 'number' || type === 'datetime';
      case 'eventos': return isInput;
      default: return true; // geral, aparencia
    }
  }).map((t) => t.id);
}

/**
 * Painel de configuração do CAMPO selecionado, em 3 abas (Geral, Validação,
 * Aparência). Lê/edita o campo via a engine do form-js (`editField`).
 */
export function FieldConfigPanel({ field, editField, masks }: {
  field: any | null;
  editField: (field: any, path: string[], value: unknown) => void;
  masks: MaskOpt[];
}) {
  const [tab, setTab] = useState<Tab>('geral');
  const [helpOpen, setHelpOpen] = useState(false);
  // Campos do formulário — alimentam as regras da parametrização do documento (6f).
  const formFields = useFormStore((s) => s.fields);
  const [, force] = useState(0);
  // Drafts de Nome/Chave commitados no blur — evita re-render por tecla (que
  // tirava o foco, ex.: título da lista dinâmica).
  const [draftLabel, setDraftLabel] = useState('');
  const [draftKey, setDraftKey] = useState('');
  // Orientações também via draft (commit no blur/fechar) — evita re-render por
  // tecla que tirava o foco do editor/textarea.
  const [helpDraft, setHelpDraft] = useState('');

  // Se o tipo do campo mudou e a aba ativa não existe mais, volta pra Geral.
  // (Hook ANTES de qualquer early return — senão a contagem de hooks varia.)
  useEffect(() => {
    if (field && !availableTabIds(field).includes(tab)) setTab('geral');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.type]);

  // Sincroniza os drafts quando troca o campo selecionado.
  useEffect(() => {
    // O campo de data (form-js datetime) NÃO usa `label`: seu nome visível vem de
    // `dateLabel`/`timeLabel`. Semeia o draft a partir deles nesse caso.
    setDraftLabel(
      field?.type === 'datetime'
        ? (field?.dateLabel ?? field?.timeLabel ?? field?.label ?? '')
        : (field?.label ?? ''),
    );
    setDraftKey(field?.key ?? '');
    setHelpDraft(field?.properties?.septemHelpText ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.id]);

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
  const isContainer = CONTAINER.has(field.type);
  const supportsOptions = OPTION_TYPES.has(field.type);
  const helpType = props.septemHelpType ?? 'inline';

  const ids = availableTabIds(field);
  const availableTabs = TABS.filter((t) => ids.includes(t.id));

  /** Commit do Nome (label) no blur; se a Chave ainda era derivada do nome, sincroniza. */
  function changeLabel(v: string) {
    const prevAuto = slugify(field.label ?? '');
    const keyFollows = isInput && (!field.key || field.key === prevAuto);
    editField(field, ['label'], v);
    // O canvas do form-js exibe o nome do campo de data por `dateLabel`/`timeLabel`
    // (não por `label`). Grava os três para o nome mudar no editor E no runtime (ReactForm).
    if (field.type === 'datetime') {
      editField(field, ['dateLabel'], v);
      editField(field, ['timeLabel'], v);
    }
    if (keyFollows) {
      const nextKey = slugify(v);
      if (nextKey && nextKey !== field.key) {
        try { editField(field, ['key'], nextKey); setDraftKey(nextKey); } catch { /* unicidade — ignora */ }
      }
    }
    force((n) => n + 1);
  }

  /** Commit da Chave no blur (slug). form-js valida unicidade. */
  function changeKey(v: string) {
    const slug = slugify(v);
    setDraftKey(slug);
    try { editField(field, ['key'], slug); } catch { /* dup — ignora */ }
    force((n) => n + 1);
  }

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

      {/* Abas (sempre 3, no máx). */}
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

            {!NO_LABEL.has(field.type) && <Text label="Nome" value={draftLabel} onChange={setDraftLabel} onBlur={() => changeLabel(draftLabel)} />}
            {isInput && <Text label="Chave (identificador)" value={draftKey} onChange={setDraftKey} onBlur={() => changeKey(draftKey)} hint="Sincroniza com o nome; pode ser editada." />}

            {isContainer && (
              <>
                <div>
                  <Lbl>Ícone do {field.type === 'dynamiclist' ? 'lista' : 'grupo'}</Lbl>
                  <IconSearchPicker value={props.septemGroupIcon} onChange={(cls) => merge('properties', { septemGroupIcon: cls || undefined })} />
                </div>
                {field.type === 'group' && (
                  <Switch label="Exibir contador de pendências" checked={props.septemShowPending !== 'no'}
                    onChange={(b) => merge('properties', { septemShowPending: b ? undefined : 'no' })} />
                )}
              </>
            )}

            {(isInput || isContainer) && (
              <div>
                <Lbl>Tipo de ajuda</Lbl>
                <select className={fieldCls} value={helpType} onChange={(e) => merge('properties', { septemHelpType: e.target.value })}>
                  <option value="inline">Inline</option>
                  <option value="popover">Popover</option>
                </select>
                {helpType === 'popover' ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <button type="button" onClick={() => setHelpOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <Pencil size={13} /> Editar orientações
                    </button>
                    <span className="text-[11px] text-slate-400">{helpDraft ? 'definidas' : 'vazias'}</span>
                  </div>
                ) : (
                  <textarea rows={2} className={`${fieldCls} mt-1.5`} value={helpDraft}
                    onChange={(e) => setHelpDraft(e.target.value)}
                    onBlur={() => merge('properties', { septemHelpText: helpDraft.trim() || undefined })}
                    placeholder="Orientações exibidas abaixo do campo." />
                )}
              </div>
            )}

            {FONTE_DADOS_TYPES.has(field.type) && (
              <div>
                <Lbl>Fonte de dados</Lbl>
                <DataSourceSelect value={props.septemDataSourceId ?? ''}
                  onChange={(v) => {
                    merge('properties', { septemDataSourceId: v || undefined });
                    // Campos de opção: carrega as opções da fonte direto no campo.
                    if (v && supportsOptions) {
                      fetchDataSourceOptions(v)
                        .then((opts) => { set(['values'], opts); toast.success(`${opts.length} opç${opts.length === 1 ? 'ão' : 'ões'} carregada${opts.length === 1 ? '' : 's'}.`); })
                        .catch(() => toast.error('Não foi possível carregar as opções da fonte.'));
                    }
                  }} />
                {props.septemDataSourceId && (
                  <button type="button"
                    onClick={() => openTab(`/fonte-dados/${encodeURIComponent(props.septemDataSourceId)}`)}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
                    <ExternalLink size={12} /> Editar fonte de dados
                  </button>
                )}
              </div>
            )}

            {field.type === 'filepicker' && (
              <>
                <ExtensionPicker value={props.septemAllowedExts} onChange={(csv) => merge('properties', { septemAllowedExts: csv || undefined })} />

                {/* Fase 6f (:50-:53): o campo de anexo pode ser alimentado por um
                    documento GERADO a partir de um modelo. Desmarcado por padrão. */}
                <Switch
                  label="Gera documento?"
                  checked={props.septemDocGen === 'yes'}
                  onChange={(b) => merge('properties', { septemDocGen: b ? 'yes' : undefined })}
                />
                {props.septemDocGen === 'yes' && (
                  <>
                    <Switch
                      label="Permitir anexar documento manualmente?"
                      checked={props.septemDocManual === 'yes'}
                      onChange={(b) => merge('properties', { septemDocManual: b ? 'yes' : undefined })}
                    />
                    <DocumentGenConfig
                      value={parseDocGen(props.septemDocGenConfig)}
                      onChange={(next) => merge('properties', { septemDocGenConfig: JSON.stringify(next) })}
                      camposDoForm={formFields.map((f) => ({ key: f.id, label: f.label }))}
                    />
                  </>
                )}
              </>
            )}

            {isInput && <Switch label="Obrigatório" checked={!!validate.required} onChange={(b) => merge('validate', { required: b })} help="Exige o preenchimento antes de concluir a tarefa." />}
            {(isInput || isContainer) && <Switch label="Visível no relatório" checked={props.septemVisReport !== 'no'} onChange={(b) => merge('properties', { septemVisReport: b ? undefined : 'no' })} help="Controla a exibição deste conteúdo no relatório do processo." />}
            {(isInput || isContainer) && <Switch label="Visível ao requisitante" checked={props.septemVisRequester !== 'no'} onChange={(b) => merge('properties', { septemVisRequester: b ? undefined : 'no' })} help="Controla a exibição deste conteúdo para quem iniciou a requisição." />}

            {(field.type === 'spacer' || field.type === 'separator') && (
              <p className="text-sm text-slate-400">Este elemento não tem configurações em Geral.</p>
            )}
          </div>
        )}

        {tab === 'aparencia' && (
          <div className="flex flex-col gap-3">
            {field.type === 'textfield' && (
              <Select label="Documento" value={props.septemDocKind ?? ''} options={DOC_KIND_OPTIONS}
                hint="CPF/CNPJ com validação de dígito verificador (máscara dinâmica). Bloqueia concluir com documento inválido."
                onChange={(v) => merge('properties', { septemDocKind: v || undefined })} />
            )}
            {field.type === 'datetime' && (
              <Select label="Tipo" value={props.septemDateMode ?? field.subtype ?? 'datetime'} options={DATE_MODE_OPTIONS}
                hint="Escolhe o seletor: data e hora, só data ou só hora."
                onChange={(v) => {
                  // `subtype` controla o próprio form-js; a propriedade Septem é
                  // preservada para schemas e consumidores já publicados.
                  editField(field, ['subtype'], v);
                  editField(field, ['properties'], {
                    ...(field.properties || {}),
                    septemDateMode: v === 'datetime' ? undefined : v,
                  });
                  force((n) => n + 1);
                }} />
            )}
            {MASKABLE.has(field.type) && field.type !== 'datetime' && !props.septemDocKind && (
              <Select label="Máscara" value={props.septemMaskId ?? ''} options={[{ value: '', label: '— nenhuma —' }, ...masks]}
                onChange={(v) => {
                  const m = masks.find((o) => o.value === v);
                  merge('properties', { septemMaskId: v || undefined, septemMaskRegex: m?.regex, septemMaskTemplate: m?.template || undefined, septemMaskValidate: m?.shouldValidate ? 'true' : undefined });
                }} />
            )}
            {isInput && <Text label="Prefixo" value={appearance.prefixAdorner ?? ''} onChange={(v) => merge('appearance', { prefixAdorner: v || undefined })} />}
            {isInput && <Text label="Sufixo" value={appearance.suffixAdorner ?? ''} onChange={(v) => merge('appearance', { suffixAdorner: v || undefined })} />}
            <NumberInput label="Colunas (no container)" value={field.layout?.columns}
              onChange={(n) => merge('layout', { columns: n })} hint="Quantas colunas do grid o campo ocupa." />
            <NumberInput label="Largura (px)" value={props.septemWidth}
              onChange={(n) => merge('properties', { septemWidth: n != null ? String(n) : undefined })} hint="Vazio = largura da coluna." />
            {VALIDATABLE.has(field.type) && <NumberInput label="Mín. caracteres" value={validate.minLength} onChange={(n) => merge('validate', { minLength: n })} />}
            {VALIDATABLE.has(field.type) && <NumberInput label="Máx. caracteres" value={validate.maxLength} onChange={(n) => merge('validate', { maxLength: n })} />}
          </div>
        )}

        {tab === 'validacao' && (
          <div className="flex flex-col gap-3">
            {field.type === 'number' && <NumberInput label="Valor mínimo" value={validate.min} onChange={(n) => merge('validate', { min: n })} />}
            {field.type === 'number' && <NumberInput label="Valor máximo" value={validate.max} onChange={(n) => merge('validate', { max: n })} />}
            {field.type === 'datetime' && (
              <Select label="Restrição de data" value={props.septemDateLimit ?? ''} options={DATE_LIMIT_OPTIONS}
                hint="A regra é conferida com a data do SERVIDOR ao salvar/concluir."
                onChange={(v) => merge('properties', { septemDateLimit: v || undefined })} />
            )}
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
          </div>
        )}
      </div>

      {helpOpen && (() => {
        const commitHelp = () => merge('properties', { septemHelpText: helpDraft.trim() || undefined });
        return (
          <Dialog open onClose={() => { commitHelp(); setHelpOpen(false); }} width="lg" title="Orientações do campo (popover)"
            footer={<button type="button" onClick={() => { commitHelp(); setHelpOpen(false); }} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>}>
            <RichTextEditor value={helpDraft} onChange={setHelpDraft} onBlur={commitHelp} />
          </Dialog>
        );
      })()}
    </aside>
  );
}

const TYPE_LABELS: Record<string, string> = {
  textfield: 'Texto', textarea: 'Área de texto', number: 'Número', datetime: 'Data/Hora',
  select: 'Lista', radio: 'Opções', checkbox: 'Caixa de seleção', checklist: 'Múltipla escolha',
  filepicker: 'Upload', group: 'Grupo', dynamiclist: 'Lista dinâmica',
};
function labelOfType(t: string) { return TYPE_LABELS[t] ?? t; }

// ── controles ────────────────────────────────────────────────────────────────
const fieldCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none read-only:bg-slate-50 read-only:text-slate-500';

function Lbl({ children, help }: { children: React.ReactNode; help?: string }) {
  return <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">{children}{help && <HelpPopover html={help} ariaLabel={`Ajuda: ${String(children)}`} />}</label>;
}
function Text({ label, value, onChange, onBlur, readOnly, hint }: { label: string; value: string; onChange?: (v: string) => void; onBlur?: () => void; readOnly?: boolean; hint?: string }) {
  return <div><Lbl help={hint}>{label}</Lbl><input className={fieldCls} value={value} readOnly={readOnly} onChange={(e) => onChange?.(e.target.value)} onBlur={onBlur} /></div>;
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><Lbl>{label}</Lbl><textarea rows={2} className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function NumberInput({ label, value, onChange, hint }: { label: string; value: unknown; onChange: (n: number | undefined) => void; hint?: string }) {
  return <div><Lbl help={hint}>{label}</Lbl><input type="number" className={fieldCls} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></div>;
}
function Select({ label, value, options, onChange, hint }: { label: string; value: string; options: Opt[]; onChange: (v: string) => void; hint?: string }) {
  return <div><Lbl help={hint}>{label}</Lbl><select className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}

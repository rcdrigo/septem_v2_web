import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, HelpCircle, Plus, Trash2, Paperclip, X, Loader2, FileText } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { regexToTemplate, applyMask, isAllDigits } from '@/lib/mask';
import { maskDocumento, validateDocumento, type DocKind } from '@/lib/documento';
import { inputTypeForDateMode, validateDateClient, type DateMode, type DateLimit } from '@/lib/datafield';
import { uploadAttachment, parseAttachments, fetchDocumentOptions, generateDocument, type Attachment, type UploadContext } from '@/lib/upload';

/** Mesmo contrato do FormFill (form-js), para ser intercambiável. */
export type FormFillResult = { data: Record<string, unknown>; errors: Record<string, unknown> };
export type ReactFormHandle = {
  submit: () => FormFillResult;
  /** Lê os valores atuais SEM validar nem pintar erros — para salvar rascunho
   *  (salvar não deve exigir preenchimento de campos obrigatórios). */
  getData: () => Record<string, unknown>;
  /** Injeta erros vindos do servidor (422) no formulário, pintando os campos. */
  setServerErrors: (errs: Record<string, string>) => void;
};

type Component = {
  id?: string;
  type?: string;
  key?: string;
  label?: string;
  description?: string;
  text?: string;
  disabled?: boolean;
  prefixAdorner?: string;
  suffixAdorner?: string;
  appearance?: { prefixAdorner?: string; suffixAdorner?: string };
  values?: { label: string; value: string }[];
  validate?: { required?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number };
  components?: Component[];
  /** Layout no grid de 16 colunas do form-js (columns null/0 = linha inteira). */
  layout?: { columns?: number | null };
  /** Config rica gravada pelo painel do form-js (field.properties): septemMask*, septemDataSourceId, septemHelp*, septemEvents, septemGroupIcon, septemShowPending. */
  properties?: Record<string, string>;
};

const GRID_COLS = 16;
/** span de colunas de um componente (default = linha inteira). */
function colSpan(c: Component): number {
  const n = c.layout?.columns;
  if (!n || n < 1) return GRID_COLS;
  return Math.min(GRID_COLS, n);
}

type OptionsMap = Record<string, { value: string; label: string }[]>;
type FieldState = Record<string, { hidden?: boolean; disabled?: boolean }>;

const INPUT_TYPES = new Set(['textfield', 'textarea', 'number', 'checkbox', 'select', 'email', 'datetime', 'radio', 'password']);

function collectInputs(components: Component[] | undefined, acc: Component[]) {
  for (const c of components ?? []) {
    if (c.type === 'dynamiclist') continue; // itens da lista têm escopo próprio (array)
    if (c.key && INPUT_TYPES.has(c.type ?? '')) acc.push(c);
    if (c.components) collectInputs(c.components, acc);
  }
  return acc;
}

/** Eventos do campo, persistidos como JSON em properties.septemEvents. */
function parseEvents(raw?: string): { type: string; action: string }[] {
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}

// ── runtime compartilhado (evita prop-drilling pelos Nodes) ───────────────────
type Runtime = {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  set: (k: string, v: unknown) => void;
  dsOptions: OptionsMap;
  readOnly?: boolean;
  fieldState: FieldState;
  runEvent: (comp: Component, type: string, event: unknown) => void;
  uploadContext?: UploadContext;
};
const RuntimeCtx = createContext<Runtime | null>(null);
function useRuntime() {
  const ctx = useContext(RuntimeCtx);
  if (!ctx) throw new Error('RuntimeCtx ausente');
  return ctx;
}

/**
 * Renderizador de formulário em componentes React nativos (req. 7.1). Renderiza a
 * config rica: máscara (validação por regex), prefixo/sufixo, ajuda (inline rich-text
 * e popover), counter de min/max, opções de select via fonte de dados e o runtime de
 * eventos do campo (change/click/blur/focus → action com contexto).
 */
export type ExtraTab = { id: string; label: string; icon?: React.ReactNode; render: () => React.ReactNode };

export const ReactForm = forwardRef<ReactFormHandle, { schema: unknown; data?: Record<string, unknown>; readOnly?: boolean; optionsByField?: OptionsMap; uploadContext?: UploadContext; extraTabs?: { leading?: ExtraTab[]; trailing?: ExtraTab[] } }>(
  ({ schema, data, readOnly, optionsByField, uploadContext, extraTabs }, ref) => {
    const root = (schema ?? {}) as { components?: Component[] };
    const inputs = useMemo(() => collectInputs(root.components, []), [schema]);

    const [values, setValues] = useState<Record<string, unknown>>(() => {
      const init: Record<string, unknown> = { ...(data ?? {}) };
      for (const c of inputs) {
        if (init[c.key!] === undefined) init[c.key!] = c.type === 'checkbox' ? false : '';
      }
      return init;
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Opções resolvidas no servidor (form já populado) entram como estado inicial.
    const [dsOptions, setDsOptions] = useState<OptionsMap>(() => optionsByField ?? {});
    const [fieldState, setFieldState] = useState<FieldState>({});
    // #28: só exibe o form depois que as fontes pendentes (não embutidas) carregarem.
    const needsFetch = (c: Component) =>
      !!c.properties?.septemDataSourceId && (c.type === 'select' || c.type === 'radio') && !optionsByField?.[c.key!];
    const [dsLoading, setDsLoading] = useState(() => inputs.some(needsFetch));

    // Ref pro valor mais recente — o runtime de eventos lê de forma síncrona.
    const valuesRef = useRef(values);
    valuesRef.current = values;

    // Carrega as opções dos selects/radios alimentados por fonte de dados.
    useEffect(() => {
      const dsFields = inputs.filter(needsFetch);
      if (dsFields.length === 0) { setDsLoading(false); return; }
      let cancelled = false;
      setDsLoading(true);
      (async () => {
        for (const c of dsFields) {
          try {
            const res = await api.post<{ options: { value: string | null; label: string | null }[] }>(
              '/api/v1/workflow/field-options', { dataSourceId: c.properties!.septemDataSourceId });
            if (cancelled) return;
            const opts = res.options.map((o) => ({ value: String(o.value ?? ''), label: String(o.label ?? o.value ?? '') }));
            setDsOptions((prev) => ({ ...prev, [c.key!]: opts }));
          } catch { /* sem permissão/erro: degrada para as opções estáticas */ }
        }
        if (!cancelled) setDsLoading(false);
      })();
      return () => { cancelled = true; };
    }, [inputs]);

    function set(key: string, value: unknown) {
      setValues((prev) => ({ ...prev, [key]: value }));
    }

    // Executa os eventos do campo para um dado tipo (change/click/blur/focus).
    function runEvent(comp: Component, type: string, event: unknown) {
      const evs = parseEvents(comp.properties?.septemEvents).filter((e) => e.type === type && e.action?.trim());
      if (evs.length === 0) return;
      const get = (k: string) => valuesRef.current[k];
      const show = (k: string) => setFieldState((s) => ({ ...s, [k]: { ...s[k], hidden: false } }));
      const hide = (k: string) => setFieldState((s) => ({ ...s, [k]: { ...s[k], hidden: true } }));
      const setDisabled = (k: string, b: boolean) => setFieldState((s) => ({ ...s, [k]: { ...s[k], disabled: !!b } }));
      for (const e of evs) {
        try {
          // contexto exposto à action: o próprio valor, get/set de outros campos, show/hide/setDisabled, a chave e o evento DOM
          // eslint-disable-next-line no-new-func
          const fn = new Function('value', 'get', 'set', 'show', 'hide', 'setDisabled', 'field', 'event', e.action);
          fn(valuesRef.current[comp.key ?? ''], get, set, show, hide, setDisabled, comp.key, event);
        } catch (err) {
          console.warn('Evento do formulário falhou:', e.action, err);
        }
      }
    }

    function validate(): Record<string, string> {
      const errs: Record<string, string> = {};
      for (const c of inputs) {
        if (c.disabled || fieldState[c.key!]?.hidden) continue; // somente-leitura/escondido: não valida
        const v = values[c.key!];
        const req = c.validate?.required;
        const empty = v === '' || v === undefined || v === null || (c.type === 'checkbox' && v === false)
          || (c.type === 'filepicker' && parseAttachments(v).length === 0);
        if (req && empty) { errs[c.key!] = 'Campo obrigatório.'; continue; }
        if (typeof v === 'string' && v) {
          const docKind = c.type === 'textfield' ? (c.properties?.septemDocKind as DocKind | undefined) : undefined;
          if (docKind) {
            const msg = validateDocumento(v, docKind);
            if (msg) { errs[c.key!] = msg; continue; }
          }
          if (c.validate?.minLength && v.length < c.validate.minLength) errs[c.key!] = `Mínimo de ${c.validate.minLength} caracteres.`;
          if (c.validate?.maxLength && v.length > c.validate.maxLength) errs[c.key!] = `Máximo de ${c.validate.maxLength} caracteres.`;
          const regex = c.properties?.septemMaskRegex;
          if (!docKind && c.properties?.septemMaskValidate === 'true' && regex) {
            try { if (!new RegExp(regex).test(v)) errs[c.key!] = 'Formato inválido.'; } catch { /* regex inválida: ignora */ }
          }
        }
        if (c.type === 'number' && v !== '' && v !== undefined) {
          const n = Number(v);
          if (c.validate?.min !== undefined && n < c.validate.min) errs[c.key!] = `Valor mínimo ${c.validate.min}.`;
          if (c.validate?.max !== undefined && n > c.validate.max) errs[c.key!] = `Valor máximo ${c.validate.max}.`;
        }
        if (c.type === 'datetime' && typeof v === 'string' && v) {
          const msg = validateDateClient(v, c.properties?.septemDateMode as DateMode | undefined, c.properties?.septemDateLimit as DateLimit | undefined);
          if (msg) errs[c.key!] = msg;
        }
      }
      return errs;
    }

    useImperativeHandle(ref, () => ({
      submit: () => {
        const errs = validate();
        setErrors(errs);
        return { data: values, errors: errs };
      },
      getData: () => values,
      setServerErrors: (errs) => setErrors(errs),
    }), [values, inputs, fieldState]);

    const comps = root.components ?? [];
    const layout = (root as { septemGroupLayout?: string }).septemGroupLayout;
    const runtime: Runtime = { values, errors, set, dsOptions, readOnly, fieldState, runEvent, uploadContext };

    // Cada grupo de topo vira um card; os cards se distribuem no grid de 16 col
    // (8+8 = lado a lado). Em "abas", a barra fica num card e o conteúdo noutro.
    const isGroup = (c: Component) => !!(c.components && !c.key);
    // Abas quando o form pede tabs OU quando há abas extras (ex.: relatório com
    // "Visão geral"/"Tramitação"): tudo numa única barra de abas.
    const useTabs = layout === 'tabs' || !!extraTabs;
    let body: React.ReactNode;
    if (useTabs) {
      const groups = comps.filter(isGroup);
      const loose = comps.filter((c) => !isGroup(c));
      body = (
        <div className="flex flex-col gap-4">
          {loose.length > 0 && <LayoutGrid components={loose} render={(c) => <Node comp={c} />} />}
          <GroupTabsCards groups={groups} extra={extraTabs} />
        </div>
      );
    } else {
      body = <LayoutGrid components={comps} render={(c) => (isGroup(c) ? <GroupCard group={c} /> : <Node comp={c} />)} />;
    }

    if (dsLoading) return <FormSkeleton />;
    return <RuntimeCtx.Provider value={runtime}>{body}</RuntimeCtx.Provider>;
  },
);
ReactForm.displayName = 'ReactForm';

function Node({ comp }: { comp: Component }) {
  const { values, errors, set, dsOptions, readOnly, fieldState, runEvent } = useRuntime();

  if (comp.type === 'dynamiclist') return <DynamicList comp={comp} />;

  if (comp.components && !comp.key) {
    // Subgrupo = seção recolhível (título + chevron), aberta por padrão.
    return (
      <CollapsibleSection comp={comp}>
        <LayoutGrid components={comp.components} render={(c) => <Node comp={c} />} />
      </CollapsibleSection>
    );
  }

  if (comp.type === 'text' || comp.type === 'html') return <p className="text-sm text-slate-600">{comp.text}</p>;
  if (comp.type === 'separator') return <hr className="border-slate-200" />;
  if (comp.type === 'spacer') return <div className="h-2" />;

  if (!comp.key) return null;
  const key = comp.key;
  if (fieldState[key]?.hidden) return null; // escondido via runtime de eventos

  const v = values[key];
  const err = errors[key];
  const options = dsOptions[key] ?? comp.values ?? [];
  const helpType = comp.properties?.septemHelpType ?? 'inline';
  const helpText = comp.properties?.septemHelpText;
  const popoverHelp = helpType === 'popover' ? helpText : null;
  const inlineHelp = helpType !== 'popover' ? helpText : null;
  // Documento (CPF/CNPJ) tem máscara DINÂMICA própria + validação de dígito; tem
  // precedência sobre a máscara genérica por regex.
  const docKind = comp.type === 'textfield' ? (comp.properties?.septemDocKind as DocKind | undefined) : undefined;
  // Máscara: usa o Formato explícito (septemMaskTemplate) ou deriva do regex.
  const maskTemplate = docKind ? null : (comp.properties?.septemMaskTemplate
    || (comp.properties?.septemMaskRegex ? regexToTemplate(comp.properties.septemMaskRegex) : null));
  // Prefixo/sufixo: o form-js grava em `appearance`; aceitamos os dois formatos.
  const prefixAdorner = comp.prefixAdorner ?? comp.appearance?.prefixAdorner;
  const suffixAdorner = comp.suffixAdorner ?? comp.appearance?.suffixAdorner;
  const disabled = readOnly === true || comp.disabled === true || fieldState[key]?.disabled === true;

  // Counter de min/max (campos de texto).
  const { minLength, maxLength } = comp.validate ?? {};
  const showCounter = (comp.type === 'textfield' || comp.type === 'textarea') && (minLength != null || maxLength != null);
  const len = String(v ?? '').length;

  // Handlers de evento (change é disparado dentro dos onChange de cada controle).
  const evt = {
    onClick: (e: unknown) => runEvent(comp, 'click', e),
    onBlur: (e: unknown) => runEvent(comp, 'blur', e),
    onFocus: (e: unknown) => runEvent(comp, 'focus', e),
  };
  const setAndEmit = (val: unknown, e: unknown) => { set(key, val); runEvent(comp, 'change', e); };

  const reqMark = comp.validate?.required
    ? <span className="text-rose-500"> *</span>
    : <span className="ml-1 text-[11px] font-normal text-slate-400">(opcional)</span>;
  const labelEl = comp.label && (
    <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
      {comp.label}{reqMark}
      {popoverHelp && <HelpPopover html={popoverHelp} />}
    </span>
  );
  const base = `w-full rounded-md border ${err ? 'border-rose-400' : 'border-slate-300'} bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500`;

  let control: React.ReactNode;
  if (comp.type === 'filepicker') {
    control = <FilePickerControl comp={comp} value={v} disabled={disabled} onChange={(val) => set(key, val)} />;
  } else if (disabled) {
    // Campo só-leitura (visível): exibe o valor como texto (não input desabilitado).
    const optLabel = options.find((o) => o.value === String(v ?? ''))?.label;
    const display = comp.type === 'checkbox' ? (v ? 'Sim' : 'Não') : (optLabel ?? String(v ?? ''));
    control = <div className="min-h-[1.75rem] whitespace-pre-wrap py-1 text-sm text-slate-800">{display || <span className="text-slate-400">—</span>}</div>;
  } else if (comp.type === 'textarea') {
    control = <textarea rows={3} disabled={disabled} className={base} value={String(v ?? '')} {...evt} onChange={(e) => setAndEmit(e.target.value, e)} />;
  } else if (comp.type === 'select') {
    control = (
      <select disabled={disabled} className={base} value={String(v ?? '')} {...evt} onChange={(e) => setAndEmit(e.target.value, e)}>
        <option value="">Selecione…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (comp.type === 'radio') {
    control = (
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name={key} disabled={disabled} checked={String(v ?? '') === o.value} onChange={(e) => setAndEmit(o.value, e)} />
            {o.label}
          </label>
        ))}
        {options.length === 0 && <span className="text-xs text-slate-400">Sem opções.</span>}
      </div>
    );
  } else if (comp.type === 'checkbox') {
    control = (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" disabled={disabled} checked={Boolean(v)} {...evt} onChange={(e) => setAndEmit(e.target.checked, e)} />
        {comp.label}{reqMark}
        {popoverHelp && <HelpPopover html={popoverHelp} />}
      </label>
    );
  } else {
    const input = (
      <input
        type={docKind || maskTemplate ? 'text' : comp.type === 'number' ? 'number' : comp.type === 'email' ? 'email' : comp.type === 'datetime' ? inputTypeForDateMode(comp.properties?.septemDateMode as DateMode | undefined) : comp.type === 'password' ? 'password' : 'text'}
        inputMode={docKind ? 'numeric' : maskTemplate ? (isAllDigits(maskTemplate) ? 'numeric' : undefined) : undefined}
        maxLength={docKind ? 18 : maskTemplate ? maskTemplate.length : maxLength}
        disabled={disabled}
        className={prefixAdorner || suffixAdorner ? `${base} rounded-none border-0 focus:ring-0` : base}
        value={String(v ?? '')}
        {...evt}
        onFocus={(e) => {
          // Campo de data: abre o calendário já ao FOCAR (não só no ícone). showPicker()
          // exige ativação do usuário e pode lançar — protege sem quebrar o runEvent.
          if (comp.type === 'datetime') {
            try { (e.currentTarget as HTMLInputElement).showPicker?.(); } catch { /* sem ativação */ }
          }
          evt.onFocus(e);
        }}
        onChange={(e) => {
          if (docKind) { setAndEmit(maskDocumento(e.target.value, docKind), e); return; }
          if (maskTemplate) { setAndEmit(applyMask(maskTemplate, e.target.value), e); return; }
          setAndEmit(comp.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value, e);
        }}
      />
    );
    control = (prefixAdorner || suffixAdorner) ? (
      <div className={`flex items-stretch overflow-hidden rounded-md border ${err ? 'border-rose-400' : 'border-slate-300'} bg-white`}>
        {prefixAdorner && <span className="flex items-center bg-slate-50 px-2 text-sm text-slate-500">{prefixAdorner}</span>}
        {input}
        {suffixAdorner && <span className="flex items-center bg-slate-50 px-2 text-sm text-slate-500">{suffixAdorner}</span>}
      </div>
    ) : input;
  }

  const widthPx = comp.properties?.septemWidth ? Number(comp.properties.septemWidth) : undefined;
  return (
    <div className="flex flex-col gap-1" style={widthPx && !Number.isNaN(widthPx) ? { maxWidth: widthPx } : undefined}>
      {(comp.type !== 'checkbox' || disabled) && labelEl}
      {control}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {err && <span className="text-xs text-rose-600">{err}</span>}
          {!err && inlineHelp && <span className="text-xs text-slate-400" dangerouslySetInnerHTML={{ __html: inlineHelp }} />}
          {!err && !inlineHelp && comp.description && <span className="text-xs text-slate-400">{comp.description}</span>}
        </div>
        {showCounter && (
          <span className={`shrink-0 text-[11px] tabular-nums ${maxLength != null && len > maxLength ? 'text-rose-500' : 'text-slate-400'}`}>
            {len}{maxLength != null ? `/${maxLength}` : ''}
            {minLength != null && len < minLength ? ` (mín. ${minLength})` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Lista dinâmica: repete o template de campos por linha, com botões de incluir
 * e excluir. Os dados ficam em `values[key]` como array de objetos (cada linha
 * roda num runtime com escopo próprio).
 */
/**
 * Campo de anexo (Fase 4c): upload REAL para o storage do tenant. Cada arquivo é
 * enviado na hora (o servidor aplica extensões perigosas + tamanho + extensões do
 * campo, põe timestamp e a hierarquia no bucket) e o valor guarda [{name,url,size}].
 */
function FilePickerControl({ comp, value, disabled, onChange }: { comp: Component; value: unknown; disabled?: boolean; onChange: (v: Attachment[]) => void }) {
  const { uploadContext } = useRuntime();
  const anexos = parseAttachments(value);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allowed = (comp.properties?.septemAllowedExts ?? '')
    .split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
  const accept = allowed.map((e) => `.${e}`).join(',') || undefined;

  // ── Geração de documento (Fase 6g) ──────────────────────────────────────
  // O campo gera documento quando o modelador marcou "Gera documento?"; nesse
  // caso o upload manual só aparece se também foi liberado (:52/:53).
  const geraDoc = comp.properties?.septemDocGen === 'yes';
  const permiteManual = !geraDoc || comp.properties?.septemDocManual === 'yes';
  const taskId = uploadContext?.taskId;
  const [gerando, setGerando] = useState(false);
  const [opcoes, setOpcoes] = useState<{ id: string; name: string }[]>([]);
  const [modelo, setModelo] = useState('');

  // No modo "lista" o executor escolhe entre os modelos parametrizados.
  useEffect(() => {
    if (!geraDoc || !taskId || disabled || !comp.key) return;
    let vivo = true;
    fetchDocumentOptions(taskId, comp.key)
      .then((r) => { if (vivo) setOpcoes(r.mode === 'lista' ? r.templates : []); })
      .catch(() => { /* sem opções: cai no modo fixo/regra, resolvido no servidor */ });
    return () => { vivo = false; };
  }, [geraDoc, taskId, disabled, comp.key]);

  async function gerar() {
    if (!taskId || !comp.key) return;
    setGerando(true); setErro(null);
    try {
      const novo = await generateDocument(taskId, comp.key, modelo || undefined);
      onChange([...anexos, novo]);
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { detail?: string } | undefined) : undefined;
      setErro(body?.detail ?? 'Falha ao gerar o documento.');
    } finally {
      setGerando(false);
    }
  }

  async function enviar(files: FileList | null) {
    if (!files?.length || !uploadContext) return;
    setEnviando(true); setErro(null);
    const novos: Attachment[] = [];
    try {
      for (const f of Array.from(files)) {
        try { novos.push(await uploadAttachment(uploadContext, comp.key!, f)); }
        catch (e) {
          const body = e instanceof ApiError ? (e.body as { detail?: string } | undefined) : undefined;
          setErro(body?.detail ?? `Falha ao enviar ${f.name}.`);
        }
      }
      if (novos.length) onChange([...anexos, ...novos]);
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    // min-w-0 em toda a cadeia: sem isso um nome de arquivo longo (os gerados sempre
    // são: modelo + timestamp) não deixa a coluna encolher e empurra o formulário
    // inteiro para fora da tela no mobile — o `truncate` do link só funciona se os
    // pais puderem encolher.
    <div className="flex min-w-0 flex-col gap-2" data-testid="anexo-campo">
      {anexos.length > 0 && (
        <ul className="flex min-w-0 flex-col gap-1">
          {anexos.map((a, i) => (
            <li key={i} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm" data-testid="anexo-item">
              <Paperclip size={14} className="shrink-0 text-slate-400" />
              <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-slate-700 hover:underline">{a.name}</a>
              <span className="shrink-0 text-xs text-slate-400">{Math.max(1, Math.round(a.size / 1024))} KB</span>
              {!disabled && (
                <button type="button" onClick={() => onChange(anexos.filter((_, j) => j !== i))} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-rose-600" aria-label={`Remover ${a.name}`}>
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && geraDoc && taskId && (
        <div className="flex flex-wrap items-center gap-2" data-testid="anexo-gerar-area">
          {opcoes.length > 0 && (
            <select
              value={modelo} onChange={(e) => setModelo(e.target.value)} disabled={gerando}
              aria-label="Modelo do documento" data-testid="anexo-modelo"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
            >
              <option value="">Selecione o modelo…</option>
              {opcoes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button
            type="button" onClick={gerar} disabled={gerando || (opcoes.length > 0 && !modelo)}
            data-testid="anexo-gerar"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {gerando ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {gerando ? 'Gerando…' : 'Gerar documento'}
          </button>
        </div>
      )}
      {!disabled && permiteManual && (
        <div>
          <input
            ref={inputRef} type="file" multiple accept={accept} disabled={enviando}
            data-testid="anexo-input"
            className="block w-full text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-200 disabled:opacity-60"
            onChange={(e) => enviar(e.target.files)}
          />
          {allowed.length > 0 && <p className="mt-1 text-[11px] text-slate-400">Aceita: {allowed.join(', ')}.</p>}
          {enviando && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><Loader2 size={12} className="animate-spin" /> Enviando…</p>}
        </div>
      )}
      {!disabled && erro && <p className="text-[11px] text-rose-600" data-testid="anexo-erro">{erro}</p>}
      {disabled && anexos.length === 0 && <span className="text-sm text-slate-400">—</span>}
    </div>
  );
}

function DynamicList({ comp }: { comp: Component }) {
  const rt = useRuntime();
  const key = comp.key!;
  const rows = Array.isArray(rt.values[key]) ? (rt.values[key] as Record<string, unknown>[]) : [];
  const setRows = (next: Record<string, unknown>[]) => rt.set(key, next);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          {comp.properties?.septemGroupIcon && <i className={`${comp.properties.septemGroupIcon} text-slate-500`} />}
          {comp.label || 'Lista'}
          <GroupHelp comp={comp} />
        </span>
        {!rt.readOnly && (
          <button type="button" onClick={() => setRows([...rows, {}])}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Plus size={13} /> Adicionar
          </button>
        )}
      </header>
      <div className="flex flex-col gap-3 p-4">
        {rows.length === 0 && <p className="text-sm text-slate-400">Nenhum item. Clique em "Adicionar".</p>}
        {rows.map((row, i) => (
          <div key={i} className="relative rounded-md border border-slate-200 p-3">
            {!rt.readOnly && (
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover item">
                <Trash2 size={14} />
              </button>
            )}
            <RuntimeCtx.Provider value={{ ...rt, values: row, errors: {}, set: (k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r))) }}>
              <LayoutGrid components={comp.components ?? []} render={(c) => <Node comp={c} />} />
            </RuntimeCtx.Provider>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grupo/subgrupo como seção recolhível (título + chevron), aberta por padrão. */
function CollapsibleSection({ comp, children }: { comp: Component; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const icon = comp.properties?.septemGroupIcon;
  if (!comp.label) return <div className="flex flex-col gap-3">{children}</div>;
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between bg-slate-50 px-3 py-2 text-left hover:bg-slate-100">
        <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
          {icon && <i className={`${icon} text-slate-400`} />}
          {comp.label}
          <GroupHelp comp={comp} />
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-slate-100 p-3">{children}</div>}
    </div>
  );
}

/** Skeleton simulando um formulário enquanto carrega (tarefa / fontes de dados). */
export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      {[0, 1].map((g) => (
        <div key={g} className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5"><div className="h-4 w-40 rounded bg-slate-200" /></div>
          <div className="grid grid-cols-2 gap-4 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="h-8 w-full rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grid de 16 colunas; cada item ocupa `colSpan` colunas (8+8 = lado a lado).
 * Em telas pequenas colapsa para 1 coluna (cada campo vira uma linha) — regra
 * `.septem-form-grid` em globals.css. */
function LayoutGrid({ components, render }: { components: Component[]; render: (c: Component) => React.ReactNode }) {
  return (
    <div className="septem-form-grid grid gap-3">
      {components.map((c, i) => {
        const span = colSpan(c);
        return (
          <div key={c.id ?? i} style={{ gridColumn: `span ${span} / span ${span}` }}>
            {render(c)}
          </div>
        );
      })}
    </div>
  );
}

/** Ajuda (popover/inline) de um container (grupo/lista). */
function GroupHelp({ comp }: { comp: Component }) {
  const t = comp.properties?.septemHelpType ?? 'inline';
  const txt = comp.properties?.septemHelpText;
  if (!txt) return null;
  if (t === 'popover') return <HelpPopover html={txt} />;
  return <span className="text-xs font-normal text-slate-400" dangerouslySetInnerHTML={{ __html: txt }} />;
}

/** Conta campos obrigatórios não preenchidos dentro de um grupo (pill de pendências). */
function countPendingRequired(group: Component, values: Record<string, unknown>): number {
  let n = 0;
  for (const c of collectInputs(group.components, [])) {
    if (!c.validate?.required) continue;
    const v = values[c.key!];
    const empty = v === '' || v === undefined || v === null || (c.type === 'checkbox' && v === false);
    if (empty) n++;
  }
  return n;
}

/** Grupo de topo como card próprio: ícone à esquerda + pill de pendências à direita. */
function GroupCard({ group }: { group: Component }) {
  const { values } = useRuntime();
  const icon = group.properties?.septemGroupIcon;
  const showPending = group.properties?.septemShowPending !== 'no';
  const pending = showPending ? countPendingRequired(group, values) : 0;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          {icon && <i className={`${icon} text-slate-500`} />}
          {group.label || 'Grupo'}
          <GroupHelp comp={group} />
        </span>
        {showPending && pending > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {pending} pendente{pending > 1 ? 's' : ''}
          </span>
        )}
      </header>
      <div className="p-4">
        <LayoutGrid components={group.components ?? []} render={(c) => <Node comp={c} />} />
      </div>
    </div>
  );
}

/** Abas: barra num card; conteúdo da aba ativa noutro card. Abas extras
 * (leading/trailing) entram na mesma barra (ex.: "Visão geral"/"Tramitação"). */
function GroupTabsCards({ groups, extra }: { groups: Component[]; extra?: { leading?: ExtraTab[]; trailing?: ExtraTab[] } }) {
  const { values } = useRuntime();
  const lead = extra?.leading ?? [];
  const trail = extra?.trailing ?? [];
  type Tab = { key: string; label: string; icon?: React.ReactNode; pending: number; content: React.ReactNode };
  const tabs: Tab[] = [
    ...lead.map((t) => ({ key: `x:${t.id}`, label: t.label, icon: t.icon, pending: 0, content: t.render() })),
    ...groups.map((grp, i) => ({
      key: grp.id ?? `g${i}`,
      label: grp.label || `Grupo ${i + 1}`,
      icon: grp.properties?.septemGroupIcon ? <i className={grp.properties.septemGroupIcon} /> : undefined,
      pending: grp.properties?.septemShowPending !== 'no' ? countPendingRequired(grp, values) : 0,
      content: <GroupCard group={grp} />,
    })),
    ...trail.map((t) => ({ key: `x:${t.id}`, label: t.label, icon: t.icon, pending: 0, content: t.render() })),
  ];
  const [active, setActive] = useState(0);
  const idx = Math.min(active, Math.max(0, tabs.length - 1));
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab, i) => (
            <button key={tab.key} type="button" onClick={() => setActive(i)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium uppercase tracking-wide ${i === idx ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {tab.icon}
              {tab.label}
              {tab.pending > 0 && (
                <span className={`ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${i === idx ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{tab.pending}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {tabs[idx]?.content}
    </div>
  );
}

/**
 * Ícone de ajuda com aviso no hover/foco. O balão usa `position: fixed`,
 * largura automática (limitada à janela) e é reposicionado para caber no
 * viewport: prefere acima do ícone; se não couber, vai abaixo; clampa na
 * horizontal para não cortar nas bordas.
 */
function HelpPopover({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popRef.current) return;
    const margin = 8;
    const br = btnRef.current.getBoundingClientRect();
    const pr = popRef.current.getBoundingClientRect();
    let left = br.left + br.width / 2 - pr.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - pr.width - margin));
    const fitsAbove = br.top - pr.height - margin >= 0;
    const top = fitsAbove ? br.top - pr.height - 6 : br.bottom + 6;
    setStyle({ position: 'fixed', left, top, visibility: 'visible' });
  }, [open]);

  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={btnRef}
        type="button"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-slate-400 hover:text-slate-600"
        title="Ajuda"
      >
        <HelpCircle size={14} />
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          style={style}
          className="pointer-events-none z-[1010] w-max max-w-[min(20rem,90vw)] rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-lg"
          dangerouslySetInnerHTML={{ __html: html }}
        />,
        document.body,
      )}
    </span>
  );
}

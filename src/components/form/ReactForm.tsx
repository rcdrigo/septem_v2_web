import { validateForm, fieldPath, INPUT_TYPES, type FormComponent as Component, type FieldState } from '@/lib/form-validation';
// Merge: base é a reformulação do date picker (DatePickerField/normalizeDateMode) e do
// HelpPopover; somamos o que a Fase 6 usa — o ícone e as chamadas de geração de
// documento. useLayoutEffect/createPortal/HelpCircle/inputTypeForDateMode saíram
// porque o corpo mesclado não os usa mais.
import { createContext, forwardRef, Fragment, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2, Paperclip, X, Loader2, FileText, FileSignature, FileSearch } from 'lucide-react';
import { HelpContent, HelpPopover } from '@/components/ui/HelpPopover';
import { routes } from '@/lib/routes';
import { useQueryClient } from '@tanstack/react-query';
import { signatureKeys, useDocumentCodes, useTaskSignatures } from '@/lib/api/execution';
import { api, ApiError } from '@/lib/api';
import { regexToTemplate, applyMask, isAllDigits } from '@/lib/mask';
import { maskDocumento, type DocKind } from '@/lib/documento';
import { dateModeOfComponent, dateFieldLabel, type DateMode, type DateLimit } from '@/lib/datafield';
import {
  uploadAttachment, parseAttachments, fetchDocumentOptions, generateDocument,
  estaAssinado, fetchSignaturesPreview, abrirBlobEmNovaAba, CANAL_ASSINATURAS,
  type Attachment, type UploadContext, type SignatureDoc, type TaskSignatures,
} from '@/lib/upload';
import { DatePickerField } from './DatePickerField';

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

const GRID_COLS = 16;
/** span de colunas de um componente (default = linha inteira). */
function colSpan(c: Component): number {
  const n = c.layout?.columns;
  if (!n || n < 1) return GRID_COLS;
  return Math.min(GRID_COLS, n);
}

function dateModeOf(component: Component): DateMode {
  return dateModeOfComponent(component);
}

type OptionsMap = Record<string, { value: string; label: string }[]>;
function collectInputs(components: Component[] | undefined, acc: Component[]) {
  for (const c of components ?? []) {
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
  readValues: () => Record<string, unknown>;
  prefix: string;
  removeRow: (key: string, index: number, scope?: string) => void;
  errors: Record<string, string>;
  set: (k: string, v: unknown) => void;
  dsOptions: OptionsMap;
  readOnly?: boolean;
  fieldState: FieldState;
  dateErrors: Record<string, string>;
  setDateError: (k: string, message: string | null) => void;
  runEvent: (comp: Component, type: string, event: unknown, scope?: string) => void;
  uploadContext?: UploadContext;
  /** Assinaturas da tarefa (Fase 7a), buscadas UMA vez e distribuídas por aqui. */
  assinaturas?: { dados: TaskSignatures | null; recarregar: () => void };
  /** Código verificador por campo de documento (Fase 9). */
  codigosDeDocumento?: Record<string, string>;
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

    const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...(data ?? {}) }));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [dateErrors, setDateErrors] = useState<Record<string, string>>({});
    // Opções resolvidas no servidor (form já populado) entram como estado inicial.
    const [dsOptions, setDsOptions] = useState<OptionsMap>(() => optionsByField ?? {});
    const [fieldState, setFieldState] = useState<FieldState>({});
    // #28: só exibe o form depois que as fontes pendentes (não embutidas) carregarem.
    const needsFetch = (c: Component) =>
      !!c.properties?.septemDataSourceId && (['select', 'radio', 'checklist', 'taglist'].includes(c.type ?? '')) && !optionsByField?.[c.key!];
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
      valuesRef.current = { ...valuesRef.current, [key]: value };
      setValues(valuesRef.current);
    }

    function setDateError(key: string, message: string | null) {
      setDateErrors((prev) => {
        if (!message && !(key in prev)) return prev;
        const next = { ...prev };
        if (message) next[key] = message;
        else delete next[key];
        return next;
      });
    }

    // Resolve a linha no snapshot atual, inclusive após um set no mesmo evento.
    function scopeData(scope: string): Record<string, unknown> {
      let current: any = valuesRef.current;
      for (const part of scope.split('.').filter(Boolean)) current = current?.[part];
      return current && typeof current === 'object' ? current : {};
    }
    function setScoped(scope: string, key: string, value: unknown) {
      if (!scope) { set(key, value); return; }
      const parts = scope.split('.');
      const update = (node: any, index: number): any => {
        if (index === parts.length) return { ...node, [key]: value };
        const part = parts[index];
        const copy = Array.isArray(node) ? [...node] : { ...node };
        copy[part as any] = update(node?.[part], index + 1);
        return copy;
      };
      valuesRef.current = update(valuesRef.current, 0);
      setValues(valuesRef.current);
    }
    function removeRow(key: string, index: number, scope = '') {
      const rows = scopeData(scope)[key];
      if (!Array.isArray(rows)) return;
      setScoped(scope, key, rows.filter((_, i) => i !== index));
      const prefix = `${fieldPath(scope, key)}.`;
      const reindex = <T,>(entries: Record<string, T>): Record<string, T> => {
        const result: Record<string, T> = {};
        for (const [path, value] of Object.entries(entries)) {
          if (!path.startsWith(prefix)) { result[path] = value; continue; }
          const tail = path.slice(prefix.length);
          const dot = tail.indexOf('.');
          const row = Number(dot < 0 ? tail : tail.slice(0, dot));
          if (row === index) continue;
          result[`${prefix}${row > index ? row - 1 : row}${dot < 0 ? '' : tail.slice(dot)}`] = value;
        }
        return result;
      };
      setErrors(reindex); setDateErrors(reindex); setFieldState(reindex);
    }

    function runEvent(comp: Component, type: string, event: unknown, scope = '') {
      const evs = parseEvents(comp.properties?.septemEvents).filter((e) => e.type === type && e.action?.trim());
      const get = (k: string) => scopeData(scope)[k];
      const updateState = (k: string, patch: { hidden?: boolean; disabled?: boolean }) => {
        const path = fieldPath(scope, k);
        setFieldState((s) => ({ ...s, [path]: { ...s[path], ...patch } }));
      };
      for (const e of evs) {
        try {
          const fn = new Function('value', 'get', 'set', 'show', 'hide', 'setDisabled', 'field', 'event', e.action);
          fn(get(comp.key ?? ''), get, (k: string, v: unknown) => setScoped(scope, k, v),
            (k: string) => updateState(k, { hidden: false }), (k: string) => updateState(k, { hidden: true }),
            (k: string, disabled: boolean) => updateState(k, { disabled: !!disabled }), comp.key, event);
        } catch (err) { console.warn('Evento do formulário falhou:', err); }
      }
    }

    useImperativeHandle(ref, () => ({
      submit: () => {
        const errs = validateForm(root.components ?? [], valuesRef.current, fieldState, dateErrors);
        setErrors(errs);
        return { data: valuesRef.current, errors: errs };
      },
      getData: () => valuesRef.current,
      setServerErrors: (errs) => setErrors(errs),
    }), [values, inputs, fieldState, dateErrors]);

    const comps = root.components ?? [];
    const layout = (root as { septemGroupLayout?: string }).septemGroupLayout;
    // Assinaturas da tarefa: MESMO cache que os botões de conclusão usam (Fase 7c).
    // Ler de dois lugares diferentes deixaria o ícone verde com o botão ainda bloqueado.
    const taskIdAssinatura = uploadContext?.taskId;
    const queryAssinaturas = useTaskSignatures(taskIdAssinatura);
    const qc = useQueryClient();
    const recarregarAssinaturas = useCallback(() => {
      if (taskIdAssinatura) void qc.invalidateQueries({ queryKey: signatureKeys.task(taskIdAssinatura) });
    }, [qc, taskIdAssinatura]);

    // Assinar acontece em OUTRA aba, que avisa por aqui assim que termina. Evento
    // explícito, e não `focus`/`visibilitychange`: aqueles não disparam de forma
    // confiável — nem em headless, nem em janela sem foco.
    useEffect(() => {
      if (!taskIdAssinatura) return;
      let canal: BroadcastChannel | null = null;
      try {
        canal = new BroadcastChannel(CANAL_ASSINATURAS);
        canal.onmessage = (ev: MessageEvent<{ taskId?: string }>) => {
          if (ev.data?.taskId === taskIdAssinatura) recarregarAssinaturas();
        };
      } catch { /* sem BroadcastChannel: atualiza no próximo carregamento */ }
      return () => { canal?.close(); };
    }, [taskIdAssinatura, recarregarAssinaturas]);

    // Códigos verificadores: o operador precisa vê-los para conferir com o papel
    // que o cidadão traz. Só existem em campo que GERA documento (Fase 9) — e por isso
    // a consulta só sai quando o formulário tem algum. Buscar em toda tarefa era uma
    // requisição inútil na maioria delas e, pior, quebrava telas que não esperam essa
    // chamada (a suíte `execucao-layout-mock` intercepta a API e não a conhecia).
    const temCampoDeDocumento = useMemo(() => {
      const varrer = (comps: Component[] | undefined): boolean => (comps ?? []).some(
        (c) => (c.type === 'filepicker' && c.properties?.septemDocGen === 'yes') || varrer(c.components),
      );
      return varrer(root.components);
    }, [root.components]);
    const queryCodigos = useDocumentCodes(temCampoDeDocumento ? taskIdAssinatura : null);
    const codigosDeDocumento = useMemo(() => Object.fromEntries(
      (queryCodigos.data ?? []).map((c) => [c.fieldKey, c.code])), [queryCodigos.data]);

    const runtime: Runtime = {
      values, readValues: () => valuesRef.current, prefix: '', removeRow, errors, set, dsOptions, readOnly, fieldState, dateErrors, setDateError, runEvent, uploadContext,
      assinaturas: { dados: queryAssinaturas.data ?? null, recarregar: recarregarAssinaturas },
      codigosDeDocumento,
    };

    // Cada grupo de topo vira um card; os cards se distribuem no grid de 16 col
    // (8+8 = lado a lado). Em "abas", a barra fica num card e o conteúdo noutro.
    const isGroup = (c: Component) => c.type === 'group' || !!(c.components && !c.key);
    // A configuração do formulário é autoritativa: extras entram na barra quando
    // o layout é "tabs" e viram cards antes/depois do formulário em "stacked".
    const useTabs = layout === 'tabs';
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
      body = (
        <div className="flex flex-col gap-4">
          {(extraTabs?.leading ?? []).map((extra) => <Fragment key={`x:${extra.id}`}>{extra.render()}</Fragment>)}
          <LayoutGrid components={comps} render={(c) => (isGroup(c) ? <GroupCard group={c} /> : <Node comp={c} />)} />
          {(extraTabs?.trailing ?? []).map((extra) => <Fragment key={`x:${extra.id}`}>{extra.render()}</Fragment>)}
        </div>
      );
    }

    if (dsLoading) return <FormSkeleton />;
    return <RuntimeCtx.Provider value={runtime}>{errors._form && <p role="alert" className="text-sm text-rose-600">{errors._form}</p>}{body}</RuntimeCtx.Provider>;
  },
);
ReactForm.displayName = 'ReactForm';

function Node({ comp }: { comp: Component }) {
  const { values, errors, set, dsOptions, readOnly, fieldState, runEvent, setDateError } = useRuntime();

  if (comp.type === 'dynamiclist') return <DynamicList comp={comp} />;

  if (comp.components && !comp.key) {
    // Subgrupo = seção recolhível (título + chevron), aberta por padrão.
    return (
      <CollapsibleSection comp={comp}>
        <LayoutGrid components={comp.components} render={(c) => <Node comp={c} />} />
      </CollapsibleSection>
    );
  }

  if (comp.type === 'text') return <p className="whitespace-pre-wrap text-sm text-slate-600">{comp.text}</p>;
  if (comp.type === 'html') return <StaticHtml content={comp.content ?? comp.text ?? ''} />;
  if (comp.type === 'image') return comp.source ? <img src={comp.source} alt={comp.alt ?? ''} className="max-w-full" /> : null;
  if (comp.type === 'table') return <p role="status" className="text-sm text-slate-500">Tabela não disponível neste formulário.</p>;
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
  const dateMode = comp.type === 'datetime' ? dateModeOf(comp) : undefined;

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
  const label = comp.type === 'datetime' ? dateFieldLabel(comp) : comp.label;
  const labelEl = label && (
    <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
      {label}{reqMark}
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
    const display = Array.isArray(v) ? v.map(item => options.find(o => o.value === String(item))?.label ?? String(item)).join(', ') : comp.type === 'checkbox' ? (v ? 'Sim' : 'Não') : (optLabel ?? String(v ?? ''));
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
  } else if (comp.type === 'checklist' || comp.type === 'taglist') {
    const selected = Array.isArray(v) ? v.map(String) : [];
    control = <div className="flex flex-col gap-1" role="group" aria-label={label}>
      {options.map(o => <label key={o.value} className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={selected.includes(o.value)} {...evt}
          onChange={e => setAndEmit(e.target.checked ? [...selected, o.value] : selected.filter(x => x !== o.value), e)} />
        {o.label}
      </label>)}
      {!options.length && <span className="text-xs text-slate-400">Sem opções.</span>}
    </div>;
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
        {label}{reqMark}
        {popoverHelp && <HelpPopover html={popoverHelp} />}
      </label>
    );
  } else if (comp.type === 'datetime') {
    control = (
      <DatePickerField
        value={String(v ?? '')}
        mode={dateMode}
        limit={comp.properties?.septemDateLimit as DateLimit | undefined}
        error={!!err}
        ariaLabel={label}
        required={comp.validate?.required}
        onChange={(value, event) => setAndEmit(value, event)}
        onClick={evt.onClick}
        onBlur={evt.onBlur}
        onFocus={evt.onFocus}
        onValidityChange={(message) => setDateError(key, message)}
      />
    );
  } else {
    const input = (
      <input
        type={docKind || maskTemplate ? 'text' : comp.type === 'number' ? 'number' : comp.type === 'email' ? 'email' : comp.type === 'password' ? 'password' : 'text'}
        inputMode={docKind ? 'numeric' : maskTemplate ? (isAllDigits(maskTemplate) ? 'numeric' : undefined) : undefined}
        maxLength={docKind ? 18 : maskTemplate ? maskTemplate.length : maxLength}
        disabled={disabled}
        className={prefixAdorner || suffixAdorner ? `${base} rounded-none border-0 focus:ring-0` : base}
        value={String(v ?? '')}
        {...evt}
        onFocus={evt.onFocus}
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
  const minimumDateWidth = dateMode === 'datetime' ? 340 : dateMode === 'date' ? 280 : dateMode === 'time' ? 180 : 0;
  const effectiveWidth = widthPx && !Number.isNaN(widthPx) ? Math.max(widthPx, minimumDateWidth) : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1" style={effectiveWidth ? { maxWidth: effectiveWidth } : undefined}>
      {(comp.type !== 'checkbox' || disabled) && labelEl}
      {control}
      <div className="flex min-h-[1lh] items-start justify-between gap-2">
        <div className="min-w-0">
          {err && <span className="text-xs text-rose-600">{err}</span>}
          {!err && inlineHelp && <HelpContent className="text-xs text-slate-400" html={inlineHelp} />}
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
  const { uploadContext, assinaturas, values, codigosDeDocumento } = useRuntime();
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
      if (novos.length) await trocarComAssinatura([...anexos, ...novos]);
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  // O campo é assinável quando a TAREFA o declarou assim (Fase 6). A tela não
  // decide isso: ela lê o que o servidor respondeu.
  const assinavel = !!assinaturas?.dados?.assinaveis.includes(comp.key ?? '');
  const docAssinatura = assinaturas?.dados?.documentos.find((d) => d.fieldKey === comp.key);
  const codigoDoCampo = codigosDeDocumento?.[comp.key ?? ''];

  /**
   * Troca o valor de um campo ASSINÁVEL. Grava o rascunho e relê as assinaturas: sem
   * isso o servidor continuaria vendo o arquivo antigo e o ícone seguiria VERDE
   * apontando para um documento que a pessoa nunca assinou.
   */
  async function trocarComAssinatura(novos: Attachment[]) {
    onChange(novos);
    if (!assinavel || !uploadContext?.taskId) return;
    try {
      await api.post(`/api/v1/workflow/tasks/${uploadContext.taskId}/save`,
        { data: { ...values, [comp.key!]: novos } });
    } catch { /* falhou salvar: a releitura abaixo mostra o estado real do servidor */ }
    assinaturas?.recarregar();
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
              {/* Assinatura (Fase 7a): só no PRIMEIRO anexo do campo — é o documento
                  que o servidor assina, e a configuração é um documento por campo. */}
              {i === 0 && assinavel && <BotaoAssinatura taskId={uploadContext?.taskId} fieldKey={comp.key!} doc={docAssinatura} />}
              {!disabled && (
                <button type="button" onClick={() => { void trocarComAssinatura(anexos.filter((_, j) => j !== i)); }} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-rose-600" aria-label={`Remover ${a.name}`}>
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {codigoDoCampo && anexos.length > 0 && (
        <p className="text-[11px] text-slate-500" data-testid="anexo-codigo">
          Código de validação: <strong className="tracking-widest text-slate-700">{codigoDoCampo}</strong>
        </p>
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
  const rowIds = useRef<number[]>([]);
  const nextRowId = useRef(0);
  const key = comp.key!;
  const rows = Array.isArray(rt.values[key]) ? (rt.values[key] as Record<string, unknown>[]) : [];
  while (rowIds.current.length < rows.length) rowIds.current.push(nextRowId.current++);
  rowIds.current.length = rows.length;
  const setRows = (next: Record<string, unknown>[]) => rt.set(key, next);
  const disabled = rt.readOnly || comp.disabled || rt.fieldState[key]?.disabled;
  if (rt.fieldState[key]?.hidden) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      data-testid="lista-dinamica" data-lista={key}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          {comp.properties?.septemGroupIcon && <i className={`${comp.properties.septemGroupIcon} text-slate-500`} />}
          {comp.label || 'Lista'}
          <GroupHelp comp={comp} />
        </span>
        {!disabled && (
          <button type="button" onClick={() => setRows([...rows, {}])}
            data-testid="lista-adicionar"
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Plus size={13} /> Adicionar
          </button>
        )}
      </header>
      <div className="flex flex-col gap-3 p-4">
        {rt.errors[key] && <p role="alert" className="text-sm text-rose-600">{rt.errors[key]}</p>}
        {rows.length === 0 && <p className="text-sm text-slate-400">Nenhum item. Clique em "Adicionar".</p>}
        {rows.map((row, i) => (
          <div key={rowIds.current[i]} className="relative rounded-md border border-slate-200 p-3"
            data-testid="lista-item" data-indice={i}>
            {!disabled && (
              <button type="button" onClick={() => { rowIds.current.splice(i, 1); rt.removeRow(key, i, rt.prefix); }}
                className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover item">
                <Trash2 size={14} />
              </button>
            )}
            <RuntimeCtx.Provider value={{ ...rt, values: row, readOnly: disabled,
              prefix: fieldPath(rt.prefix, `${key}.${i}`),
              readValues: () => (rt.readValues()[key] as Record<string, unknown>[] | undefined)?.[i] ?? {},
              errors: scopeMap(rt.errors, `${key}.${i}`),
              fieldState: scopeMap(rt.fieldState, `${key}.${i}`),
              dateErrors: scopeMap(rt.dateErrors, `${key}.${i}`),
              setDateError: (k, message) => rt.setDateError(`${key}.${i}.${k}`, message),
              runEvent: (c, type, event, scope) => rt.runEvent(c, type, event, scope ?? fieldPath(rt.prefix, `${key}.${i}`)),
              set: (k, v) => {
                const latest = rt.readValues()[key] as Record<string, unknown>[];
                setRows(latest.map((r, j) => j === i ? { ...r, [k]: v } : r));
              },
            }}>
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
  // O form-js agrupa por layout.row, na ordem da primeira ocorrência.
  // Sem essa informação, campos de linhas distintas acabavam lado a lado.
  const rows = new Map<string, Component[]>();
  components.forEach((c, i) => {
    const key = c.layout?.row ? `row:${c.layout.row}` : `field:${i}`;
    rows.set(key, [...(rows.get(key) ?? []), c]);
  });
  return (
    <div className="flex flex-col gap-3">
      {[...rows].map(([key, fields]) => {
        const fixed = fields.filter(c => (c.layout?.columns ?? 0) > 0);
        const automatic = fields.length - fixed.length;
        const remaining = Math.max(automatic, GRID_COLS - fixed.reduce((sum, c) => sum + colSpan(c), 0));
        let autoIndex = 0;
        return <div key={key} className="septem-form-grid grid gap-3">
          {fields.map((c, i) => {
            const span = (c.layout?.columns ?? 0) > 0 ? colSpan(c)
              : Math.floor(remaining / automatic) + (autoIndex++ < remaining % automatic ? 1 : 0);
            return <div key={c.id ?? i} style={{ gridColumn: `span ${span} / span ${span}` }}>
              {render(c)}
            </div>;
          })}
        </div>;
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
  return <HelpContent className="text-xs font-normal text-slate-400" html={txt} />;
}

/** Conta campos obrigatórios não preenchidos dentro de um grupo (pill de pendências). */
function countPendingRequired(group: Component, values: Record<string, unknown>, fieldState: FieldState): number {
  return Object.values(validateForm(group.components ?? [], values, fieldState))
    .filter(message => message === 'Campo obrigatório.').length;
}

/** Grupo de topo como card próprio: ícone à esquerda + pill de pendências à direita. */
function GroupCard({ group, showHeader = true }: { group: Component; showHeader?: boolean }) {
  const { values, fieldState } = useRuntime();
  const icon = group.properties?.septemGroupIcon;
  const showPending = group.properties?.septemShowPending !== 'no';
  const pending = showPending ? countPendingRequired(group, values, fieldState) : 0;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {showHeader && <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
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
      </header>}
      <div className="p-4">
        <LayoutGrid components={group.components ?? []} render={(c) => <Node comp={c} />} />
      </div>
    </div>
  );
}

/** Abas: barra num card; conteúdo da aba ativa noutro card. Abas extras
 * (leading/trailing) entram na mesma barra (ex.: "Visão geral"/"Tramitação"). */
function GroupTabsCards({ groups, extra }: { groups: Component[]; extra?: { leading?: ExtraTab[]; trailing?: ExtraTab[] } }) {
  const { values, fieldState } = useRuntime();
  const lead = extra?.leading ?? [];
  const trail = extra?.trailing ?? [];
  type Tab = { key: string; label: string; icon?: React.ReactNode; pending: number; content: React.ReactNode };
  const tabs: Tab[] = [
    ...lead.map((t) => ({ key: `x:${t.id}`, label: t.label, icon: t.icon, pending: 0, content: t.render() })),
    ...groups.map((grp, i) => ({
      key: grp.id ?? `g${i}`,
      label: grp.label || `Grupo ${i + 1}`,
      icon: grp.properties?.septemGroupIcon ? <i className={grp.properties.septemGroupIcon} /> : undefined,
      pending: grp.properties?.septemShowPending !== 'no' ? countPendingRequired(grp, values, fieldState) : 0,
      content: <GroupCard group={grp} showHeader={false} />,
    })),
    ...trail.map((t) => ({ key: `x:${t.id}`, label: t.label, icon: t.icon, pending: 0, content: t.render() })),
  ];
  const [active, setActive] = useState(0);
  const idx = Math.min(active, Math.max(0, tabs.length - 1));
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  function moveFocus(next: number) {
    const normalized = (next + tabs.length) % tabs.length;
    setActive(normalized);
    tabRefs.current[normalized]?.focus();
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {/* Mobile: cada botão de navegação ocupa 100% da largura (empilhados);
            do sm pra cima volta a ser barra horizontal que quebra linha. */}
        <div role="tablist" aria-label="Seções do formulário" className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
          {tabs.map((tab, i) => (
            <button key={tab.key} ref={(element) => { tabRefs.current[i] = element; }} type="button" role="tab"
              id={`septem-tab-${tab.key}`} aria-selected={i === idx} aria-controls={`septem-panel-${tab.key}`} tabIndex={i === idx ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveFocus(i + 1); }
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); moveFocus(i - 1); }
                if (event.key === 'Home') { event.preventDefault(); moveFocus(0); }
                if (event.key === 'End') { event.preventDefault(); moveFocus(tabs.length - 1); }
              }}
              className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium uppercase tracking-wide sm:w-auto sm:justify-start ${i === idx ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {tab.icon}
              {tab.label}
              {tab.pending > 0 && (
                <span className={`ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${i === idx ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{tab.pending}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {tabs[idx] && (
        <div role="tabpanel" id={`septem-panel-${tabs[idx].key}`} aria-labelledby={`septem-tab-${tabs[idx].key}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2">
          {tabs[idx].content}
        </div>
      )}
    </div>
  );
}

/**
 * Ícone de assinatura ao lado do anexo (Fase 7a).
 *
 * Vermelho e ATIVO enquanto não assinado; verde e INATIVO depois — exatamente o que a
 * spec pede, inclusive nos textos do popover. Um terceiro estado existe e não estava na
 * spec: arquivo trocado depois de assinado. Ele não pode aparecer verde, senão a tela
 * afirmaria que um documento está assinado quando a assinatura não vale mais para ele.
 */
function BotaoAssinatura({ taskId, fieldKey, doc }: { taskId?: string; fieldKey: string; doc?: SignatureDoc }) {
  const { values } = useRuntime();
  const [abrindo, setAbrindo] = useState(false);
  if (!taskId) return null;

  const assinado = estaAssinado(doc);
  const invalidada = !assinado && (doc?.assinaturas.length ?? 0) > 0;

  const titulo = assinado ? 'Documento assinado'
    : invalidada ? 'O arquivo mudou depois de assinado. Clique para assinar novamente.'
    : 'Clique aqui para assinar o documento';
  const cor = assinado ? 'text-emerald-600' : invalidada ? 'text-amber-600' : 'text-rose-600';

  /**
   * O upload já pôs o arquivo no storage, mas o VALOR do campo ainda só existe nesta
   * tela: a página de assinatura lê do servidor e não veria anexo nenhum. Por isso
   * salvamos o rascunho antes de abrir a aba — sem isso a assinatura só funcionaria
   * para quem tivesse salvo a tarefa por conta própria.
   */
  async function abrirAssinatura() {
    if (!taskId) return;
    setAbrindo(true);
    try {
      await api.post(`/api/v1/workflow/tasks/${taskId}/save`, { data: values });
      window.open(
        `${import.meta.env.BASE_URL}${routes.signDocument(taskId, fieldKey).replace(/^\//, '')}`,
        '_blank', 'noopener');
    } catch {
      /* Falhou salvar: não abre a aba — assinar sem o anexo gravado daria erro pior. */
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      {assinado ? (
        <span
          title={titulo} aria-label={titulo} data-testid="anexo-assinar"
          data-estado="assinado" aria-disabled="true"
          className={`rounded p-1 ${cor}`}
        >
          <FileSignature size={15} />
        </span>
      ) : (
        <button
          type="button" onClick={abrirAssinatura} disabled={abrindo}
          title={titulo} aria-label={titulo} data-testid="anexo-assinar"
          data-estado={invalidada ? 'invalidada' : 'pendente'}
          className={`rounded p-1 hover:bg-slate-200 disabled:opacity-50 ${cor}`}
        >
          {abrindo ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />}
        </button>
      )}
      {(doc?.assinaturas.length ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => { void fetchSignaturesPreview(taskId, fieldKey).then(abrirBlobEmNovaAba); }}
          title="Visualizar assinaturas" aria-label="Visualizar assinaturas"
          data-testid="anexo-ver-assinaturas"
          className="rounded p-1 text-slate-500 hover:bg-slate-200"
        >
          <FileSearch size={15} />
        </button>
      )}
    </div>
  );
}

function scopeMap<T>(values: Record<string, T>, prefix: string): Record<string, T> {
  const start = `${prefix}.`;
  return Object.fromEntries(Object.entries(values).filter(([k]) => k.startsWith(start)).map(([k, v]) => [k.slice(start.length), v]));
}

/** HTML de autoria exibido sem scripts, atributos de evento ou navegação ativa. */
function StaticHtml({ content }: { content: string }) {
  const html = useMemo(() => {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,form,meta,link,base').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      for (const attr of [...el.attributes]) {
        if (/^on/i.test(attr.name) || ['srcdoc', 'style'].includes(attr.name) ||
          (['href', 'src', 'xlink:href'].includes(attr.name) && !/^(https?:|mailto:|tel:|\/|#)/i.test(attr.value))) el.removeAttribute(attr.name);
      }
    });
    return doc.body.innerHTML;
  }, [content]);
  return <div className="text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: html }} />;
}

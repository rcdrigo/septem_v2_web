import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';

/** Mesmo contrato do FormFill (form-js), para ser intercambiável. */
export type FormFillResult = { data: Record<string, unknown>; errors: Record<string, unknown> };
export type ReactFormHandle = { submit: () => FormFillResult };

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
  /** Config rica gravada pelo painel do form-js (field.properties): septemMask*, septemDataSourceId, septemHelp*, septemEvents. */
  properties?: Record<string, string>;
};

type OptionsMap = Record<string, { value: string; label: string }[]>;
type FieldState = Record<string, { hidden?: boolean; disabled?: boolean }>;

const INPUT_TYPES = new Set(['textfield', 'textarea', 'number', 'checkbox', 'select', 'email', 'datetime', 'radio', 'password']);

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
  errors: Record<string, string>;
  set: (k: string, v: unknown) => void;
  dsOptions: OptionsMap;
  readOnly?: boolean;
  fieldState: FieldState;
  runEvent: (comp: Component, type: string, event: unknown) => void;
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
export const ReactForm = forwardRef<ReactFormHandle, { schema: unknown; data?: Record<string, unknown>; readOnly?: boolean }>(
  ({ schema, data, readOnly }, ref) => {
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
    const [dsOptions, setDsOptions] = useState<OptionsMap>({});
    const [fieldState, setFieldState] = useState<FieldState>({});

    // Ref pro valor mais recente — o runtime de eventos lê de forma síncrona.
    const valuesRef = useRef(values);
    valuesRef.current = values;

    // Carrega as opções dos selects/radios alimentados por fonte de dados.
    useEffect(() => {
      const dsFields = inputs.filter((c) => c.properties?.septemDataSourceId && (c.type === 'select' || c.type === 'radio'));
      if (dsFields.length === 0) return;
      let cancelled = false;
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
        const empty = v === '' || v === undefined || v === null || (c.type === 'checkbox' && v === false);
        if (req && empty) { errs[c.key!] = 'Campo obrigatório.'; continue; }
        if (typeof v === 'string' && v) {
          if (c.validate?.minLength && v.length < c.validate.minLength) errs[c.key!] = `Mínimo de ${c.validate.minLength} caracteres.`;
          if (c.validate?.maxLength && v.length > c.validate.maxLength) errs[c.key!] = `Máximo de ${c.validate.maxLength} caracteres.`;
          const regex = c.properties?.septemMaskRegex;
          if (c.properties?.septemMaskValidate === 'true' && regex) {
            try { if (!new RegExp(regex).test(v)) errs[c.key!] = 'Formato inválido.'; } catch { /* regex inválida: ignora */ }
          }
        }
        if (c.type === 'number' && v !== '' && v !== undefined) {
          const n = Number(v);
          if (c.validate?.min !== undefined && n < c.validate.min) errs[c.key!] = `Valor mínimo ${c.validate.min}.`;
          if (c.validate?.max !== undefined && n > c.validate.max) errs[c.key!] = `Valor máximo ${c.validate.max}.`;
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
    }), [values, inputs, fieldState]);

    const comps = root.components ?? [];
    const layout = (root as { septemGroupLayout?: string }).septemGroupLayout;
    const runtime: Runtime = { values, errors, set, dsOptions, readOnly, fieldState, runEvent };

    // Abas: grupos principais (containers de topo) viram abas; campos soltos de topo
    // ficam acima. Subgrupos seguem aninhados dentro de cada aba.
    let body: React.ReactNode;
    if (layout === 'tabs') {
      const groups = comps.filter((c) => c.components && !c.key);
      const loose = comps.filter((c) => !(c.components && !c.key));
      body = (
        <div className="flex flex-col gap-4">
          {loose.map((c, i) => <Node key={c.id ?? i} comp={c} />)}
          {groups.length > 0 && <GroupTabs groups={groups} />}
        </div>
      );
    } else {
      body = (
        <div className="flex flex-col gap-4">
          {comps.map((c, i) => <Node key={c.id ?? i} comp={c} />)}
        </div>
      );
    }

    return <RuntimeCtx.Provider value={runtime}>{body}</RuntimeCtx.Provider>;
  },
);
ReactForm.displayName = 'ReactForm';

function Node({ comp }: { comp: Component }) {
  const { values, errors, set, dsOptions, readOnly, fieldState, runEvent } = useRuntime();

  if (comp.components && !comp.key) {
    // Grupo/subgrupo = seção recolhível (título + chevron), aberta por padrão.
    return (
      <CollapsibleSection label={comp.label}>
        {comp.components.map((c, i) => <Node key={c.id ?? i} comp={c} />)}
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
  // Máscara: deriva um template (ex.: ###.###.###-##) do regex p/ formatar ao digitar.
  const maskTemplate = comp.properties?.septemMaskRegex ? regexToTemplate(comp.properties.septemMaskRegex) : null;
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

  const labelEl = comp.label && (
    <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
      {comp.label}{comp.validate?.required && <span className="text-rose-500"> *</span>}
      {popoverHelp && <HelpPopover html={popoverHelp} />}
    </span>
  );
  const base = `w-full rounded-md border ${err ? 'border-rose-400' : 'border-slate-300'} bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500`;

  let control: React.ReactNode;
  if (comp.type === 'textarea') {
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
        {comp.label}{comp.validate?.required && <span className="text-rose-500"> *</span>}
        {popoverHelp && <HelpPopover html={popoverHelp} />}
      </label>
    );
  } else {
    const input = (
      <input
        type={maskTemplate ? 'text' : comp.type === 'number' ? 'number' : comp.type === 'email' ? 'email' : comp.type === 'datetime' ? 'datetime-local' : comp.type === 'password' ? 'password' : 'text'}
        inputMode={maskTemplate ? 'numeric' : undefined}
        maxLength={maskTemplate ? maskTemplate.length : maxLength}
        disabled={disabled}
        className={prefixAdorner || suffixAdorner ? `${base} rounded-none border-0 focus:ring-0` : base}
        value={String(v ?? '')}
        {...evt}
        onChange={(e) => {
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

  return (
    <div className="flex flex-col gap-1">
      {comp.type !== 'checkbox' && labelEl}
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

/** Grupo/subgrupo como seção recolhível (título + chevron), aberta por padrão. */
function CollapsibleSection({ label, children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!label) return <div className="flex flex-col gap-3">{children}</div>;
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between bg-slate-50 px-3 py-2 text-left hover:bg-slate-100">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-600">{label}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-slate-100 p-3">{children}</div>}
    </div>
  );
}

function GroupTabs({ groups }: { groups: Component[] }) {
  const [active, setActive] = useState(0);
  const idx = Math.min(active, groups.length - 1);
  const g = groups[idx];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
        {groups.map((grp, i) => (
          <button key={grp.id ?? i} type="button" onClick={() => setActive(i)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${i === idx ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {grp.label || `Grupo ${i + 1}`}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {(g?.components ?? []).map((c, i) => <Node key={c.id ?? i} comp={c} />)}
      </div>
    </div>
  );
}

/**
 * Converte um regex simples (grupos de dígitos + literais) num template de
 * máscara: `#` = dígito, demais chars = literais. Ex.: `\d{3}\.\d{3}\.\d{3}-\d{2}`
 * → `###.###.###-##`. Retorna null para regex com construções não-mapeáveis
 * (classes, quantificadores variáveis, alternâncias) — aí fica só validação.
 */
function regexToTemplate(rx: string): string | null {
  let s = rx;
  if (s.startsWith('^')) s = s.slice(1);
  if (s.endsWith('$')) s = s.slice(0, -1);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const n = s[i + 1];
      if (n === 'd') {
        let count = 1;
        let j = i + 2;
        if (s[j] === '{') {
          const close = s.indexOf('}', j);
          if (close < 0) return null;
          const inner = s.slice(j + 1, close);
          if (!/^\d+$/.test(inner)) return null; // ranges {4,5} não viram template fixo
          count = parseInt(inner, 10);
          j = close + 1;
        }
        out += '#'.repeat(count);
        i = j;
        continue;
      }
      out += n; // literal escapado (\. \- \/ ...)
      i += 2;
      continue;
    }
    if ('+*?[](){}|^$.'.includes(c)) return null; // construção não-mapeável
    out += c;
    i++;
  }
  return out.includes('#') ? out : null;
}

/** Aplica o template à entrada bruta: preenche os `#` com dígitos e insere os literais. */
function applyMask(template: string, raw: string): string {
  const digits = raw.replace(/\D/g, '');
  let out = '';
  let di = 0;
  for (let i = 0; i < template.length && di < digits.length; i++) {
    out += template[i] === '#' ? digits[di++] : template[i];
  }
  return out;
}

function HelpPopover({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-slate-400 hover:text-slate-600" title="Ajuda">
        <HelpCircle size={14} />
      </button>
      {open && (
        <span className="absolute left-5 top-0 z-10 w-64 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-lg" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </span>
  );
}

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';

/** Mesmo contrato do FormFill (form-js), para ser intercambiável. */
export type FormFillResult = { data: Record<string, unknown>; errors: Record<string, unknown> };
export type ReactFormHandle = { submit: () => FormFillResult };

type Mask = { key?: string; regex?: string; shouldValidate?: boolean } | null;
type Septem = { mask?: Mask; dataSourceId?: string | null; helpText?: string | null; helpTextType?: string | null };

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
  values?: { label: string; value: string }[];
  validate?: { required?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number };
  components?: Component[];
  septem?: Septem;
};

type OptionsMap = Record<string, { value: string; label: string }[]>;

const INPUT_TYPES = new Set(['textfield', 'textarea', 'number', 'checkbox', 'select', 'email', 'datetime', 'radio', 'password']);

function collectInputs(components: Component[] | undefined, acc: Component[]) {
  for (const c of components ?? []) {
    if (c.key && INPUT_TYPES.has(c.type ?? '')) acc.push(c);
    if (c.components) collectInputs(c.components, acc);
  }
  return acc;
}

/**
 * Renderizador de formulário em componentes React nativos (req. 7.1). Renderiza a
 * config rica: máscara (validação por regex), prefixo/sufixo, ajuda (inline e
 * popover) e opções de select via fonte de dados (carregadas no render).
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

    // Carrega as opções dos selects/radios alimentados por fonte de dados.
    useEffect(() => {
      const dsFields = inputs.filter((c) => c.septem?.dataSourceId && (c.type === 'select' || c.type === 'radio'));
      if (dsFields.length === 0) return;
      let cancelled = false;
      (async () => {
        for (const c of dsFields) {
          try {
            const res = await api.post<{ options: { value: string | null; label: string | null }[] }>(
              '/api/v1/workflow/field-options', { dataSourceId: c.septem!.dataSourceId });
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

    function validate(): Record<string, string> {
      const errs: Record<string, string> = {};
      for (const c of inputs) {
        if (c.disabled) continue; // campo somente-leitura: não valida (valor vem pré-preenchido)
        const v = values[c.key!];
        const req = c.validate?.required;
        const empty = v === '' || v === undefined || v === null || (c.type === 'checkbox' && v === false);
        if (req && empty) { errs[c.key!] = 'Campo obrigatório.'; continue; }
        if (typeof v === 'string' && v) {
          if (c.validate?.minLength && v.length < c.validate.minLength) errs[c.key!] = `Mínimo de ${c.validate.minLength} caracteres.`;
          if (c.validate?.maxLength && v.length > c.validate.maxLength) errs[c.key!] = `Máximo de ${c.validate.maxLength} caracteres.`;
          const mask = c.septem?.mask;
          if (mask?.shouldValidate && mask.regex) {
            try { if (!new RegExp(mask.regex).test(v)) errs[c.key!] = 'Formato inválido.'; } catch { /* regex inválida: ignora */ }
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
    }), [values, inputs]);

    return (
      <div className="flex flex-col gap-4">
        {(root.components ?? []).map((c, i) => (
          <Node key={c.id ?? i} comp={c} values={values} errors={errors} set={set} dsOptions={dsOptions} readOnly={readOnly} />
        ))}
      </div>
    );
  },
);
ReactForm.displayName = 'ReactForm';

function Node({ comp, values, errors, set, dsOptions, readOnly }: {
  comp: Component; values: Record<string, unknown>; errors: Record<string, string>;
  set: (k: string, v: unknown) => void; dsOptions: OptionsMap; readOnly?: boolean;
}) {
  if (comp.components && !comp.key) {
    return (
      <fieldset className="rounded-md border border-slate-200 p-3">
        {comp.label && <legend className="px-1 text-sm font-semibold text-slate-700">{comp.label}</legend>}
        <div className="flex flex-col gap-3">
          {comp.components.map((c, i) => <Node key={c.id ?? i} comp={c} values={values} errors={errors} set={set} dsOptions={dsOptions} readOnly={readOnly} />)}
        </div>
      </fieldset>
    );
  }

  if (comp.type === 'text' || comp.type === 'html') return <p className="text-sm text-slate-600">{comp.text}</p>;
  if (comp.type === 'separator') return <hr className="border-slate-200" />;
  if (comp.type === 'spacer') return <div className="h-2" />;

  if (!comp.key) return null;
  const key = comp.key;
  const v = values[key];
  const err = errors[key];
  const options = dsOptions[key] ?? comp.values ?? [];
  const popoverHelp = comp.septem?.helpTextType === 'popover' ? comp.septem?.helpText : null;
  const labelEl = comp.label && (
    <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
      {comp.label}{comp.validate?.required && <span className="text-rose-500"> *</span>}
      {popoverHelp && <HelpPopover html={popoverHelp} />}
    </span>
  );
  const base = `w-full rounded-md border ${err ? 'border-rose-400' : 'border-slate-300'} bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500`;
  const disabled = readOnly === true || comp.disabled === true;

  let control: React.ReactNode;
  if (comp.type === 'textarea') {
    control = <textarea rows={3} disabled={disabled} className={base} value={String(v ?? '')} onChange={(e) => set(key, e.target.value)} />;
  } else if (comp.type === 'select') {
    control = (
      <select disabled={disabled} className={base} value={String(v ?? '')} onChange={(e) => set(key, e.target.value)}>
        <option value="">Selecione…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (comp.type === 'radio') {
    control = (
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name={key} disabled={disabled} checked={String(v ?? '') === o.value} onChange={() => set(key, o.value)} />
            {o.label}
          </label>
        ))}
        {options.length === 0 && <span className="text-xs text-slate-400">Sem opções.</span>}
      </div>
    );
  } else if (comp.type === 'checkbox') {
    control = (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" disabled={disabled} checked={Boolean(v)} onChange={(e) => set(key, e.target.checked)} />
        {comp.label}{comp.validate?.required && <span className="text-rose-500"> *</span>}
        {popoverHelp && <HelpPopover html={popoverHelp} />}
      </label>
    );
  } else {
    const input = (
      <input
        type={comp.type === 'number' ? 'number' : comp.type === 'email' ? 'email' : comp.type === 'datetime' ? 'datetime-local' : comp.type === 'password' ? 'password' : 'text'}
        disabled={disabled}
        className={comp.prefixAdorner || comp.suffixAdorner ? `${base} rounded-none border-0 focus:ring-0` : base}
        value={String(v ?? '')}
        onChange={(e) => set(key, comp.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      />
    );
    control = (comp.prefixAdorner || comp.suffixAdorner) ? (
      <div className={`flex items-stretch overflow-hidden rounded-md border ${err ? 'border-rose-400' : 'border-slate-300'} bg-white`}>
        {comp.prefixAdorner && <span className="flex items-center bg-slate-50 px-2 text-sm text-slate-500">{comp.prefixAdorner}</span>}
        {input}
        {comp.suffixAdorner && <span className="flex items-center bg-slate-50 px-2 text-sm text-slate-500">{comp.suffixAdorner}</span>}
      </div>
    ) : input;
  }

  return (
    <div className="flex flex-col gap-1">
      {comp.type !== 'checkbox' && labelEl}
      {control}
      {comp.description && !err && <span className="text-xs text-slate-400">{comp.description}</span>}
      {err && <span className="text-xs text-rose-600">{err}</span>}
    </div>
  );
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

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';

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
  values?: { label: string; value: string }[];
  validate?: { required?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number };
  components?: Component[];
};

const INPUT_TYPES = new Set(['textfield', 'textarea', 'number', 'checkbox', 'select', 'email', 'datetime', 'radio', 'password']);

/** Achata todos os componentes-de-input (com `key`) do schema, em ordem. */
function collectInputs(components: Component[] | undefined, acc: Component[]) {
  for (const c of components ?? []) {
    if (c.key && INPUT_TYPES.has(c.type ?? '')) acc.push(c);
    if (c.components) collectInputs(c.components, acc);
  }
  return acc;
}

/**
 * Renderizador de formulário em componentes React nativos (req. 7.1) — parseia o
 * schema form-js e desenha grupos + campos como inputs React, com validação
 * (obrigatório / min / max). `submit()` devolve `{ data, errors }`.
 */
export const ReactForm = forwardRef<ReactFormHandle, { schema: unknown; data?: Record<string, unknown> }>(
  ({ schema, data }, ref) => {
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

    function set(key: string, value: unknown) {
      setValues((prev) => ({ ...prev, [key]: value }));
    }

    function validate(): Record<string, string> {
      const errs: Record<string, string> = {};
      for (const c of inputs) {
        const v = values[c.key!];
        const req = c.validate?.required;
        const empty = v === '' || v === undefined || v === null || (c.type === 'checkbox' && v === false);
        if (req && empty) { errs[c.key!] = 'Campo obrigatório.'; continue; }
        if (typeof v === 'string' && v) {
          if (c.validate?.minLength && v.length < c.validate.minLength) errs[c.key!] = `Mínimo de ${c.validate.minLength} caracteres.`;
          if (c.validate?.maxLength && v.length > c.validate.maxLength) errs[c.key!] = `Máximo de ${c.validate.maxLength} caracteres.`;
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
          <Node key={c.id ?? i} comp={c} values={values} errors={errors} set={set} />
        ))}
      </div>
    );
  },
);
ReactForm.displayName = 'ReactForm';

function Node({ comp, values, errors, set }: {
  comp: Component; values: Record<string, unknown>; errors: Record<string, string>; set: (k: string, v: unknown) => void;
}) {
  // Agrupamento (group / layout aninhado).
  if (comp.components && !comp.key) {
    return (
      <fieldset className="rounded-md border border-slate-200 p-3">
        {comp.label && <legend className="px-1 text-sm font-semibold text-slate-700">{comp.label}</legend>}
        <div className="flex flex-col gap-3">
          {comp.components.map((c, i) => <Node key={c.id ?? i} comp={c} values={values} errors={errors} set={set} />)}
        </div>
      </fieldset>
    );
  }

  // Estáticos (texto/separador) — sem coleta de dados.
  if (comp.type === 'text' || comp.type === 'html') return <p className="text-sm text-slate-600">{comp.text}</p>;
  if (comp.type === 'separator') return <hr className="border-slate-200" />;
  if (comp.type === 'spacer') return <div className="h-2" />;

  if (!comp.key) return null;
  const key = comp.key;
  const v = values[key];
  const err = errors[key];
  const labelEl = comp.label && (
    <label className="text-sm font-medium text-slate-700">
      {comp.label}{comp.validate?.required && <span className="text-rose-500"> *</span>}
    </label>
  );
  const base = `rounded-md border ${err ? 'border-rose-400' : 'border-slate-300'} bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none`;

  return (
    <div className="flex flex-col gap-1">
      {comp.type !== 'checkbox' && labelEl}
      {comp.type === 'textarea' ? (
        <textarea rows={3} className={base} value={String(v ?? '')} onChange={(e) => set(key, e.target.value)} />
      ) : comp.type === 'select' ? (
        <select className={base} value={String(v ?? '')} onChange={(e) => set(key, e.target.value)}>
          <option value="">Selecione…</option>
          {(comp.values ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : comp.type === 'checkbox' ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(key, e.target.checked)} />
          {comp.label}{comp.validate?.required && <span className="text-rose-500"> *</span>}
        </label>
      ) : (
        <input
          type={comp.type === 'number' ? 'number' : comp.type === 'email' ? 'email' : comp.type === 'datetime' ? 'datetime-local' : comp.type === 'password' ? 'password' : 'text'}
          className={base}
          value={String(v ?? '')}
          onChange={(e) => set(key, comp.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
        />
      )}
      {comp.description && !err && <span className="text-xs text-slate-400">{comp.description}</span>}
      {err && <span className="text-xs text-rose-600">{err}</span>}
    </div>
  );
}

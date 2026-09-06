import { dateModeOfComponent, validateDateClient, type DateLimit } from './datafield';
import { validateDocumento, type DocKind } from './documento';

export type FormComponent = {
  id?: string; type?: string; subtype?: string; key?: string; label?: string;
  dateLabel?: string; timeLabel?: string; description?: string; text?: string;
  content?: string; source?: string; alt?: string; disabled?: boolean;
  prefixAdorner?: string; suffixAdorner?: string;
  appearance?: { prefixAdorner?: string; suffixAdorner?: string };
  values?: { label: string; value: string }[];
  validate?: { required?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number };
  components?: FormComponent[]; layout?: { columns?: number | null };
  properties?: Record<string, string>;
};
export type FieldState = Record<string, { hidden?: boolean; disabled?: boolean }>;
export const INPUT_TYPES = new Set(['textfield', 'textarea', 'number', 'checkbox', 'select', 'email', 'datetime', 'radio', 'password', 'filepicker', 'checklist', 'taglist']);
export const fieldPath = (prefix: string, key: string) => prefix ? `${prefix}.${key}` : key;

export function validateForm(components: FormComponent[], values: Record<string, unknown>, states: FieldState = {}, dateErrors: Record<string, string> = {}, now = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  function walk(comps: FormComponent[], data: Record<string, unknown>, prefix = '') {
    for (const c of comps) {
      const path = fieldPath(prefix, c.key ?? '');
      if (c.disabled || states[path]?.disabled || states[path]?.hidden) continue;
      if (c.type === 'dynamiclist' && c.key) {
        const rows = data[c.key];
        if (c.validate?.required && (!Array.isArray(rows) || !rows.length)) errors[path] = 'Campo obrigatório.';
        if (Array.isArray(rows)) rows.forEach((row, i) => {
          if (row && typeof row === 'object' && !Array.isArray(row)) walk(c.components ?? [], row as Record<string, unknown>, `${path}.${i}`);
          else errors[`${path}.${i}`] = 'Item inválido.';
        });
        continue;
      }
      if (c.components) walk(c.components, data, prefix);
      if (!c.key || !INPUT_TYPES.has(c.type ?? '')) continue;
      const value = data[c.key];
      if (dateErrors[path]) { errors[path] = dateErrors[path]; continue; }
      let empty = value == null || value === '' || (Array.isArray(value) && !value.length) || (c.type === 'checkbox' && value === false);
      if (c.type === 'filepicker' && typeof value === 'string') {
        try { const files = JSON.parse(value); empty = Array.isArray(files) && !files.length; } catch { /* formato tratado no servidor */ }
      }
      if (empty) { if (c.validate?.required) errors[path] = 'Campo obrigatório.'; continue; }
      if (typeof value === 'string') {
        const kind = c.type === 'textfield' ? c.properties?.septemDocKind as DocKind | undefined : undefined;
        if (kind) { const message = validateDocumento(value, kind); if (message) errors[path] = message; }
        if (c.validate?.minLength != null && value.length < c.validate.minLength) errors[path] = `Mínimo de ${c.validate.minLength} caracteres.`;
        if (c.validate?.maxLength != null && value.length > c.validate.maxLength) errors[path] = `Máximo de ${c.validate.maxLength} caracteres.`;
        if (!kind && c.properties?.septemMaskValidate === 'true' && c.properties.septemMaskRegex) {
          try { if (!new RegExp(c.properties.septemMaskRegex).test(value)) errors[path] = 'Formato inválido.'; }
          catch { errors[path] = 'Máscara de validação inválida.'; }
        }
        if (c.type === 'datetime') {
          const message = validateDateClient(value, dateModeOfComponent(c), c.properties?.septemDateLimit as DateLimit, now);
          if (message) errors[path] = message;
        }
        if (c.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[path] = 'E-mail inválido.';
      }
      if (c.type === 'number') {
        const n = Number(value);
        if (!Number.isFinite(n)) errors[path] = 'Número inválido.';
        else if (c.validate?.min != null && n < c.validate.min) errors[path] = `Valor mínimo ${c.validate.min}.`;
        else if (c.validate?.max != null && n > c.validate.max) errors[path] = `Valor máximo ${c.validate.max}.`;
      }
    }
  }
  walk(components, values);
  return errors;
}

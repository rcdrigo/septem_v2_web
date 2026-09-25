import type { FormFieldDescriptor } from '@/stores/form';
import { nativeFields, parseNativeForm } from './native-form';

/**
 * Descobre campos de resposta nativos e, durante a transição, do form-js
 * para uso no modelador (FieldVisibilityEditor, TarefasCamposView,
 * GatewayConditionEditor → seletor de campo).
 *
 * Convenção de "agrupamento": campos do tipo `group` viram seções; seus filhos
 * herdam o `group` (label do container). Quando não há container, agrupamos
 * em "Geral".
 *
 * Tipos não-input do form-js (text, html, separator, button) são ignorados —
 * não são "campos" no sentido de coleta de dados.
 */
const NON_INPUT_TYPES = new Set(['text', 'html', 'separator', 'button', 'spacer', 'image']);

type FormJsComponent = {
  id?: string;
  key?: string;
  type?: string;
  label?: string;
  components?: FormJsComponent[];
  [k: string]: any;
};

type FormJsSchema = {
  type?: string;
  components?: FormJsComponent[];
};

export function extractFields(schema: unknown): FormFieldDescriptor[] {
  if (!schema || typeof schema !== 'object') return [];
  if ('format' in schema && schema.format === 'septem-native') {
    const definition = parseNativeForm(schema);
    const tabs = new Map(definition.tabs.map(tab => [tab.id, tab.label]));
    return nativeFields(definition).filter(({ field }) => !!field.key).map(({ field, tabId, groupId, groupLabel, tableKey, path }) => ({
      // Response keys remain available to scripts and selectors. Task-field
      // associations use fieldId and derive their execution key from this descriptor.
      id: field.key, fieldId: field.id, label: field.label, type: field.type,
      group: groupLabel, groupId, tabId, tabLabel: tabs.get(tabId), tableKey, path,
    }));
  }
  const legacy = schema as FormJsSchema;
  if (!Array.isArray(legacy.components)) return [];
  const out: FormFieldDescriptor[] = [];
  walk(legacy.components, 'Geral', out);
  return out;
}

function walk(components: FormJsComponent[], currentGroup: string, out: FormFieldDescriptor[]) {
  for (const c of components) {
    const type = c.type ?? '';
    if (type === 'group' || type === 'dynamiclist' || type === 'iframe') {
      const nextGroup = c.label || currentGroup;
      if (Array.isArray(c.components)) walk(c.components, nextGroup, out);
      continue;
    }
    if (NON_INPUT_TYPES.has(type)) continue;

    const id = c.key || c.id;
    if (!id) continue;

    out.push({
      id,
      label: c.label ?? id,
      type,
      group: currentGroup,
    });
  }
}

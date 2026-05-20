import type { FormFieldDescriptor } from '@/stores/form';

/**
 * Achata o schema do @bpmn-io/form-js em uma lista de campos descritos
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

export function extractFields(schema: FormJsSchema | null | undefined): FormFieldDescriptor[] {
  if (!schema?.components) return [];
  const out: FormFieldDescriptor[] = [];
  walk(schema.components, 'Geral', out);
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

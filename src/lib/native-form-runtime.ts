import { parseNativeForm, filterNativeAnswers, type NativeFormDefinition, type NativeAnswers, type NativeField } from './native-form';
import type { FormComponent, FieldState } from './form-validation';

export function isNativeForm(value: unknown): value is NativeFormDefinition {
  return !!value && typeof value === 'object' && ('format' in value || 'tabs' in value);
}

/** Internal React view model, never persisted as the definition. */
export function nativeRuntimeComponents(definition: NativeFormDefinition): FormComponent[] {
  return definition.tabs.map(tab => ({
    ...tab.config, id: tab.id, label: tab.label, type: 'group', nativeTab: true,
    automationHidden: tab.config?.visible === false,
    components: tab.groups.map(group => ({
      ...group.config, id: group.id, label: group.label,
      type: group.type === 'table' ? 'dynamiclist' : 'group',
      key: group.type === 'table' ? group.key : undefined,
      nativeGroup: group.type === 'group', nativeTable: group.type === 'table', automationHidden: group.config?.visible === false,
      components: group.fields.filter(field => field.config?.archived !== true).map(field => ({
        ...field.config, id: field.id, label: field.label, type: field.type,
        key: field.kind === 'field' ? field.key : undefined, nativeField: field.kind === 'field',
        dateLabel: field.label, timeLabel: field.label,
        automationHidden: field.config?.visible === false,
        disabled: field.config?.disabled === true || field.config?.readonly === true || field.config?.readOnly === true,
      } as FormComponent)),
    } as FormComponent)),
  } as FormComponent));
}

export function nativeRuntime(schema: unknown) {
  const definition = parseNativeForm(schema);
  return { definition, components: nativeRuntimeComponents(definition) };
}

/** Visual initial rows exist even when the persisted table has no answers. */
export function initializeNativeValues(definition: NativeFormDefinition, data: Record<string, unknown> = {}) {
  const values = structuredClone(data);
  for (const tab of definition.tabs) for (const group of tab.groups) {
    if (group.type === 'table' && (!Array.isArray(values[group.key]) || !(values[group.key] as unknown[]).length)) values[group.key] = [{}];
  }
  return values;
}

export function emptyNativeValue(field: NativeField, value: unknown): boolean {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return true;
  if (field.type === 'filepicker' && typeof value === 'string') {
    try { const files = JSON.parse(value); return Array.isArray(files) && !files.length; } catch { return false; }
  }
  return false; // zero and false are answers, including an explicit unchecked checkbox.
}

/** Call only after submit validation, or for an explicit draft save. */
export function serializeNativeValues(definition: NativeFormDefinition, data: Record<string, unknown>): NativeAnswers {
  const result = filterNativeAnswers(definition, data as NativeAnswers);
  for (const tab of definition.tabs) for (const group of tab.groups) {
    if (group.type !== 'table' || !Array.isArray(result[group.key])) continue;
    result[group.key] = (result[group.key] as NativeAnswers[]).filter(row => group.fields.some(field => !emptyNativeValue(field, row[field.key])));
  }
  return result;
}

/** Containers without visible descendants do not create navigation or empty cards. */
export function hasVisibleContent(component: FormComponent, values: Record<string, unknown>, states: FieldState): boolean {
  if (component.automationHidden || (component.key && states[component.key]?.hidden)) return false;
  if (component.nativeTable && component.key) {
    const rows = Array.isArray(values[component.key]) && (values[component.key] as unknown[]).length ? values[component.key] as unknown[] : [{}];
    return rows.some((_, i) => (component.components ?? []).some(field => !(states[`${component.key}.${i}.${field.key}`]?.hidden ?? field.automationHidden)));
  }
  return component.components ? component.components.some(child => hasVisibleContent(child, values, states)) : true;
}

/** Transient final validation state, separate from answers and the published definition. */
export function nativeSubmissionState(definition: NativeFormDefinition, components: FormComponent[], values: Record<string, unknown>, states: FieldState): FieldState {
  const nodes = new Map<string, { component: FormComponent; hidden: boolean; disabled: boolean; parentHidden: boolean; parentDisabled: boolean }>();
  function index(items: FormComponent[], hidden = false, disabled = false) {
    for (const component of items) {
      const hiddenHere = hidden || !!component.automationHidden;
      const disabledHere = disabled || !!component.disabled;
      if (component.id) nodes.set(component.id, { component, hidden: hiddenHere, disabled: disabledHere, parentHidden: hidden, parentDisabled: disabled });
      if (component.components) index(component.components, hiddenHere, disabledHere);
    }
  }
  index(components);
  const result: FieldState = {};
  for (const tab of definition.tabs) for (const group of tab.groups) {
    const sourceRows = group.type === 'table' && Array.isArray(values[group.key]) ? values[group.key] as Record<string, unknown>[] : [{}];
    const retained = group.type === 'table' ? sourceRows.map((row, i) => ({row, i})).filter(({row}) => group.fields.some(f => !emptyNativeValue(f, row[f.key]))) : [{row: values, i: 0}];
    const occurrences = retained.length ? retained : [{row: {}, i: 0}];
    occurrences.forEach(({i}, savedIndex) => {
      for (const field of group.fields) {
        if (field.kind !== 'field') continue;
        const originalPath = group.type === 'table' ? `${group.key}.${i}.${field.key}` : field.key;
        const path = group.type === 'table' ? `${group.key}.${savedIndex}.${field.key}` : field.key;
        const node = nodes.get(field.id), state = states[originalPath];
        result[path] = { hidden: !node || node.parentHidden || (state?.hidden ?? node.hidden), disabled: !!node?.parentDisabled || (state?.disabled ?? node?.disabled ?? false),
          required: state?.required ?? node?.component.validate?.required ?? false };
      }
    });
  }
  return result;
}

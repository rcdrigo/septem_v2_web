/** Native definition v1. Publication version belongs to the process, not this format. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type NativeConfig = { [key: string]: JsonValue };
export const NATIVE_FIELD_TYPES = ['textfield', 'textarea', 'number', 'datetime', 'filepicker', 'select', 'radio', 'checkbox', 'checklist', 'taglist'] as const;
export const NATIVE_PRESENTATION_TYPES = ['text', 'html', 'image', 'separator', 'spacer'] as const;
type Node = { id: string; label: string; config?: NativeConfig };
export type NativeField = Node & { kind: 'field'; key: string; type: typeof NATIVE_FIELD_TYPES[number] };
export type NativePresentation = Node & { kind: 'presentation'; type: typeof NATIVE_PRESENTATION_TYPES[number] };
export type NativeGroup = Node & (
  | { type: 'group'; fields: (NativeField | NativePresentation)[] }
  | { type: 'table'; key: string; fields: NativeField[] }
);
export type NativeTab = Node & { groups: NativeGroup[] };
export type NativeFormDefinition = { format: 'septem-native'; schemaVersion: 1; id: string; tabs: NativeTab[] };
/** Scalar keys and table keys share the same namespace. Table cells use column keys. */
export type NativeAnswers = Record<string, JsonValue>;
/** Ephemeral execution state is never part of a definition or answer payload. */
export type NativeFieldState = { visible: boolean; editable: boolean; required: boolean };
export type NativeExecutionState = { fields: Record<string, NativeFieldState>; cells: Record<string, Record<number, Record<string, NativeFieldState>>> };

export function createNativeForm(): NativeFormDefinition {
  return { format: 'septem-native', schemaVersion: 1, id: crypto.randomUUID(), tabs: [
    { id: crypto.randomUUID(), label: 'Aba 1', groups: [
      { id: crypto.randomUUID(), label: 'Grupo 1', type: 'group', fields: [] },
    ] },
  ] };
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const keyPattern = /^[A-Za-z_][A-Za-z0-9_]{0,119}$/;
const reserved = new Set(['__proto__', 'prototype', 'constructor']);

/** Validate at import/API boundaries; never accept a legacy schema as native. */
export function parseNativeForm(value: unknown): NativeFormDefinition {
  const ids = new Set<string>(), keys = new Set<string>();
  function fail(path: string): never { throw new Error(`Definição nativa inválida: ${path}.`); }
  function shape(v: unknown, allowed: string[], path: string): Record<string, unknown> {
    if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) fail(path);
    return v;
  }
  function id(v: unknown, path: string) {
    if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v) || reserved.has(v) || ids.has(v)) fail(path);
    ids.add(v);
  }
  function key(v: unknown, path: string) {
    if (typeof v !== 'string' || !keyPattern.test(v) || reserved.has(v) || keys.has(v)) fail(path);
    keys.add(v);
  }
  function node(v: unknown, extra: string[], path: string) {
    const n = shape(v, ['id', 'label', 'config', ...extra], path);
    id(n.id, `${path}.id`);
    if (typeof n.label !== 'string' || n.label.length > 240 || (n.config !== undefined && !object(n.config))) fail(path);
    return n;
  }
  const root = shape(value, ['format', 'schemaVersion', 'id', 'tabs'], 'form');
  if (root.format !== 'septem-native' || root.schemaVersion !== 1) fail('format/schemaVersion');
  id(root.id, 'id');
  if (!Array.isArray(root.tabs) || !root.tabs.length) fail('tabs');
  for (const [ti, tab] of root.tabs.entries()) {
    const t = node(tab, ['groups'], `tabs[${ti}]`);
    if (!Array.isArray(t.groups) || !t.groups.length) fail(`tabs[${ti}].groups`);
    for (const [gi, group] of t.groups.entries()) {
      const path = `tabs[${ti}].groups[${gi}]`;
      const g = node(group, ['type', 'key', 'fields'], path);
      if (g.type !== 'group' && g.type !== 'table') fail(`${path}.type`);
      if (g.type === 'table') key(g.key, `${path}.key`);
      else if ('key' in g) fail(`${path}.key`);
      if (!Array.isArray(g.fields)) fail(`${path}.fields`);
      for (const [fi, field] of g.fields.entries()) {
        const fp = `${path}.fields[${fi}]`;
        const f = node(field, ['kind', 'type', 'key'], fp);
        if (f.kind === 'field') {
          if (f.key !== '') key(f.key, `${fp}.key`);
          if (!NATIVE_FIELD_TYPES.some(type => type === f.type)) fail(`${fp}.type`);
        } else if (f.kind !== 'presentation' || g.type === 'table' || 'key' in f || !NATIVE_PRESENTATION_TYPES.some(type => type === f.type)) fail(fp);
      }
    }
  }
  // Also rejects non-JSON configurations instead of losing values during persistence.
  function json(v: unknown): boolean {
    return v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))
      || (Array.isArray(v) ? v.every(json) : object(v) && Object.values(v).every(json));
  }
  if (!json(value)) fail('JSON');
  return structuredClone(value) as NativeFormDefinition;
}

export type NativeFieldDescriptor = { field: NativeField; tabId: string; groupId: string; groupLabel: string; tableKey?: string; path: string };
export function nativeFields(definition: NativeFormDefinition): NativeFieldDescriptor[] {
  return definition.tabs.flatMap(tab => tab.groups.flatMap(group => group.fields.flatMap(field =>
    field.kind === 'field' ? [{ field, tabId: tab.id, groupId: group.id, groupLabel: group.label,
      tableKey: group.type === 'table' ? group.key : undefined,
      path: group.type === 'table' ? `${group.key}[].${field.key}` : field.key,
    }] : [],
  )));
}

/** Unknown script fields are discarded. Supplied tables replace their complete rows. */
export function filterNativeAnswers(definition: NativeFormDefinition, incoming: NativeAnswers): NativeAnswers {
  parseNativeForm(definition);
  if (!object(incoming)) throw new Error('Respostas devem ser um objeto.');
  const result: NativeAnswers = {};
  const copy = (fields: (NativeField | NativePresentation)[], data: Record<string, unknown>) => Object.fromEntries(
    fields.filter((f): f is NativeField => f.kind === 'field' && Object.hasOwn(data, f.key))
      .map(f => [f.key, structuredClone(data[f.key]) as JsonValue]),
  );
  for (const tab of definition.tabs) for (const group of tab.groups) {
    if (group.type === 'group') Object.assign(result, copy(group.fields, incoming));
    else if (Object.hasOwn(incoming, group.key)) {
      const rows = incoming[group.key];
      if (!Array.isArray(rows) || rows.some(row => !object(row))) throw new Error(`Tabela inválida: ${group.key}.`);
      result[group.key] = rows.map(row => copy(group.fields, row as Record<string, unknown>));
    }
  }
  return result;
}

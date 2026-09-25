import { nativeFields, type NativeFormDefinition } from './native-form';

export type NativeReference = { key: string; fieldId?: string; owner: string; use: string; column: boolean; type?: string; table?: boolean };
const uses: Record<string, string> = { FormRule: 'Condição de saída', FormFieldEntry: 'Matriz da tarefa', ActorConfig: 'Responsável', DeadlineConfig: 'Prazo', TimerConfig: 'Temporizador', Signature: 'Assinatura', SubprocessConfig: 'Subprocesso' };
/** Reads only extension properties, never traversing moddle parent/descriptor cycles. */
export function nativeReferences(modeler: any, definition: NativeFormDefinition): NativeReference[] {
  const result: NativeReference[] = [];
  const elements = modeler?.get?.('elementRegistry')?.getAll?.() ?? [];
  function walk(node: any, owner: string) {
    if (!node || typeof node !== 'object') return;
    const kind = String(node.$type ?? '').split(':').at(-1)!;
    const add = (key: unknown, table = false) => {
      if (typeof key === 'string' && key.trim()) result.push({ key, ...(kind === 'FormFieldEntry' && node.fieldId ? { fieldId: node.fieldId } : {}), owner, use: uses[kind] ?? kind, column: kind === 'FormFieldEntry', table,
        type: kind === 'Signature' ? 'filepicker' : kind === 'DeadlineConfig' ? 'number' : undefined });
    };
    if (kind !== 'ActorConfig' || node.actorType === 'formField') {
      if (kind !== 'TimerConfig' || node.mode === 'field') add(node.fieldRef);
    }
    add(node.expiresInFieldRef);
    add(node.multiInstanceGroupRef, true);
    if (node.mode !== 'none') for (const key of String(kind === 'Signature' ? node.fields ?? '' : '').split(',')) add(key.trim());
    for (const [name, value] of Object.entries(node)) {
      if (name.startsWith('$')) continue;
      if (Array.isArray(value)) for (const child of value) walk(child, owner);
    }
  }
  for (const element of elements) {
    const bo = element.businessObject;
    for (const extension of bo?.extensionElements?.values ?? []) walk(extension, `${bo.name || bo.id} (${bo.id})`);
  }
  for (const { field } of nativeFields(definition)) {
    const raw = field.config?.properties;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    try {
      const config = JSON.parse(String(raw.septemDocGenConfig ?? '{}'));
      for (const rule of config.rules ?? []) if (rule.fieldRef) result.push({ key: rule.fieldRef, owner: field.label, use: 'Regra de documento', column: false });
    } catch { /* malformed document config is reported by its own editor */ }
  }
  // Registry entries (for example labels) may share a business object. Keep one
  // occurrence per owner/use/field without merging distinct compatibility checks.
  return result.filter((ref, index) => result.findIndex(other =>
    other.owner === ref.owner && other.use === ref.use && other.key === ref.key
    && other.fieldId === ref.fieldId && other.column === ref.column
    && other.table === ref.table && other.type === ref.type) === index);
}
export function invalidNativeReferences(definition: NativeFormDefinition, references: NativeReference[]) {
  const fields = nativeFields(definition);
  const tables = definition.tabs.flatMap(t => t.groups).filter(g => g.type === 'table');
  return references.filter(ref => {
    if (ref.table) return !tables.some(g => g.type === 'table' && g.key === ref.key);
    const field = fields.find(f => ref.fieldId ? f.field.id === ref.fieldId : f.field.key === ref.key || f.path === ref.key);
    return !field || (!ref.column && !!field.tableKey) || (!!ref.type && field.field.type !== ref.type);
  });
}

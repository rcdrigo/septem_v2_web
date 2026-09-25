import type { FormFieldDescriptor } from '@/stores/form';
import { getExtensionCollection, setExtensionCollection, type CollectionSchema } from './bpmn-arrays';

export type FieldVisibility = 'hidden' | 'visible' | 'editable';

export type FormFieldEntry = {
  fieldRef: string;
  /** Stable native identity; fieldRef is a derived key for execution APIs. */
  fieldId?: string;
  visibility: FieldVisibility;
  dataSourceRef?: string;
};

const SCHEMA: CollectionSchema = {
  containerType: 'septem:FormFields',
  itemsProp: 'entries',
  itemType: 'septem:FormFieldEntry',
};

export function getFormFieldEntries(element: any): FormFieldEntry[] {
  return getExtensionCollection(element, SCHEMA, (raw) => ({
    fieldRef: raw.fieldRef ?? '',
    ...(raw.fieldId ? { fieldId: raw.fieldId } : {}),
    visibility: (raw.visibility as FieldVisibility) ?? 'visible',
    dataSourceRef: raw.dataSourceRef ?? undefined,
  }));
}

export function setFormFieldEntries(modeler: any, element: any, entries: FormFieldEntry[]) {
  // PERSISTE inclusive as entradas "visible": descartá-las tornava "todos os
  // campos visíveis" indistinguível de "tarefa nunca configurada" no XML — e o
  // backend (ApplyTaskVisibility) só aplica somente-leitura quando a tarefa tem
  // alguma entrada, então tudo renderizava editável. Tarefa sem NENHUMA entrada
  // continua significando "sem configuração" (tudo editável, compat).
  const filtered = entries.filter((e) => !!e.fieldRef);
  setExtensionCollection(modeler, element, SCHEMA, filtered);
}

export function upsertFieldEntry(
  entries: FormFieldEntry[],
  fieldRef: string,
  patch: Partial<FormFieldEntry>,
  fields: FormFieldDescriptor[] = [],
): FormFieldEntry[] {
  const field = fields.find(f => f.id === fieldRef);
  const match = findFieldEntry(entries, fieldRef, fields);
  const idx = match ? entries.indexOf(match) : -1;
  patch = { ...patch, fieldRef, ...(field?.fieldId ? { fieldId: field.fieldId } : {}) };
  if (idx === -1) {
    return [...entries, { fieldRef, visibility: 'visible', ...patch }];
  }
  return entries.map((e, i) => (i === idx ? { ...e, ...patch } : e));
}

/** Once an ID exists, a reused key must never inherit another field's settings. */
export function findFieldEntry(entries: FormFieldEntry[], fieldRef: string, fields: FormFieldDescriptor[]) {
  const field = fields.find(f => f.id === fieldRef);
  return entries.find(e => e.fieldId ? e.fieldId === field?.fieldId : e.fieldRef === fieldRef);
}

/** Resolve old key-only entries against the previous definition before any rename. */
export function reconcileFieldEntries(entries: FormFieldEntry[], previous: FormFieldDescriptor[], next: FormFieldDescriptor[]) {
  return entries.map(entry => {
    const fieldId = entry.fieldId ?? previous.find(f => f.id === entry.fieldRef)?.fieldId;
    if (!fieldId) return entry;
    const field = next.find(f => f.fieldId === fieldId);
    return { ...entry, fieldId, fieldRef: field?.id ?? entry.fieldRef };
  });
}

export function syncTaskFieldEntries(modeler: any, previous: FormFieldDescriptor[], next: FormFieldDescriptor[]) {
  const registry = modeler?.get?.('elementRegistry');
  const sync = (element: any) => {
    const entries = getFormFieldEntries(element);
    const resolved = reconcileFieldEntries(entries, previous, next);
    if (JSON.stringify(entries) !== JSON.stringify(resolved)) setFormFieldEntries(modeler, element, resolved);
  };
  if (registry?.getAll) registry.getAll().forEach(sync);
  else registry?.forEach?.(sync);
}

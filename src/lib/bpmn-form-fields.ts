import { getExtensionCollection, setExtensionCollection, type CollectionSchema } from './bpmn-arrays';

export type FieldVisibility = 'hidden' | 'visible' | 'editable';

export type FormFieldEntry = {
  fieldRef: string;
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
): FormFieldEntry[] {
  const idx = entries.findIndex((e) => e.fieldRef === fieldRef);
  if (idx === -1) {
    return [...entries, { fieldRef, visibility: 'visible', ...patch }];
  }
  return entries.map((e, i) => (i === idx ? { ...e, ...patch } : e));
}

import { create } from 'zustand';

/**
 * Schema mínimo do formulário associado ao processo, lido pelos componentes
 * do modelador que precisam listar campos (matriz de visibilidade, fonte de dados,
 * combobox de prazo dinâmico etc.).
 *
 * Compartilhado pela definição nativa e pelos consumidores legados durante
 * a transição. Identidade estrutural é independente da chave de resposta.
 */
export type FormFieldDescriptor = {
  id: string;
  label: string;
  type: string;
  group: string;
  /** Chave de resposta em `id`; identidade permanente do campo em `fieldId`. */
  fieldId?: string;
  groupId?: string;
  tabId?: string;
  tabLabel?: string;
  tableKey?: string;
  path?: string;
};

type FormState = {
  fields: FormFieldDescriptor[];
  setFields: (fields: FormFieldDescriptor[]) => void;
};

export const useFormStore = create<FormState>((set) => ({
  fields: [],
  setFields: (fields) => set({ fields }),
}));

export function selectFieldGroups(fields: FormFieldDescriptor[]): { id: string; group: string; fields: FormFieldDescriptor[] }[] {
  const map = new Map<string, { id: string; group: string; fields: FormFieldDescriptor[] }>();
  for (const f of fields) {
    const label = f.group || 'Geral';
    const id = f.groupId ? `native:${f.groupId}` : `legacy:${label}`;
    const group = f.tabId ? `${f.tabLabel || 'Aba'} / ${label}${f.tableKey ? ' (Tabela)' : ''}` : label;
    if (!map.has(id)) map.set(id, { id, group, fields: [] });
    map.get(id)!.fields.push(f);
  }
  return Array.from(map.values());
}

import { create } from 'zustand';

/**
 * Schema mínimo do formulário associado ao processo, lido pelos componentes
 * do modelador que precisam listar campos (matriz de visibilidade, fonte de dados,
 * combobox de prazo dinâmico etc.).
 *
 * O esquema bate com o formato exportado pelo @bpmn-io/form-js (`fieldGroup`
 * em cada campo). A Fase 5 vai popular esta store a partir do FormBuilder.
 *
 * Por enquanto vem vazia → componentes mostram empty-state pedindo
 * configurar o formulário primeiro.
 */
export type FormFieldDescriptor = {
  id: string;
  label: string;
  type: string;
  group: string;
};

type FormState = {
  fields: FormFieldDescriptor[];
  setFields: (fields: FormFieldDescriptor[]) => void;
};

export const useFormStore = create<FormState>((set) => ({
  fields: [],
  setFields: (fields) => set({ fields }),
}));

export function selectFieldGroups(fields: FormFieldDescriptor[]): { group: string; fields: FormFieldDescriptor[] }[] {
  const map = new Map<string, FormFieldDescriptor[]>();
  for (const f of fields) {
    const g = f.group || 'Geral';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(f);
  }
  return Array.from(map.entries()).map(([group, fields]) => ({ group, fields }));
}

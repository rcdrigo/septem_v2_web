import { useEffect, useState } from 'react';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import { Field, PlaceholderBox, TextInput } from '@/components/ui/Field';
import { selectFieldGroups, useFormStore, type FormFieldDescriptor } from '@/stores/form';
import {
  getFormFieldEntries,
  setFormFieldEntries,
  upsertFieldEntry,
  type FieldVisibility,
  type FormFieldEntry,
} from '@/lib/bpmn-form-fields';

type Props = {
  modeler: any;
  element: any;
};

const STATES: ReadonlyArray<{ value: FieldVisibility; icon: typeof Eye; label: string }> = [
  { value: 'hidden', icon: EyeOff, label: 'Oculto' },
  { value: 'visible', icon: Eye, label: 'Visível' },
  { value: 'editable', icon: Pencil, label: 'Editável' },
];

/**
 * Matriz de visibilidade dos campos do formulário, por tarefa. Espelha o
 * comportamento de `ConfigTaskGeneral.aspx` ao listar `inpChkStEnabled`,
 * `inpChkStVisible`, `inpChkStManipulable` e fonte de dados por campo
 * (`inpMulDsSource`).
 *
 * Lê o schema do formulário do `formStore` (Zustand). Enquanto o form não foi
 * configurado, mostra empty-state. Quando configurado, exibe os campos
 * agrupados por `fieldGroup` (formato form-js) com um toggle 3-estados por campo
 * e um input opcional de fonte de dados.
 */
export function FieldVisibilityEditor({ modeler, element }: Props) {
  const formFields = useFormStore((s) => s.fields);
  const [entries, setEntries] = useState<FormFieldEntry[]>([]);

  useEffect(() => {
    setEntries(getFormFieldEntries(element));
  }, [element]);

  if (formFields.length === 0) {
    return (
      <PlaceholderBox>
        Configure o formulário do processo primeiro (aba <b>Formulário</b> na barra superior).
        Os campos cadastrados aparecem aqui para você decidir, por tarefa, se ficam ocultos,
        visíveis ou editáveis.
      </PlaceholderBox>
    );
  }

  const groups = selectFieldGroups(formFields);

  function setVisibility(fieldRef: string, visibility: FieldVisibility) {
    const next = upsertFieldEntry(entries, fieldRef, { visibility });
    setEntries(next);
    setFormFieldEntries(modeler, element, next);
  }

  function setDataSource(fieldRef: string, dataSourceRef: string) {
    const next = upsertFieldEntry(entries, fieldRef, { dataSourceRef: dataSourceRef || undefined });
    setEntries(next);
    setFormFieldEntries(modeler, element, next);
  }

  function entryFor(fieldRef: string): FormFieldEntry {
    return entries.find((e) => e.fieldRef === fieldRef) ?? { fieldRef, visibility: 'visible' };
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ group, fields }) => (
        <div key={group} className="rounded-md border border-slate-200 bg-white">
          <header className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            {group}
          </header>
          <ul className="divide-y divide-slate-100">
            {fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                entry={entryFor(field.id)}
                onVisibility={(v) => setVisibility(field.id, v)}
                onDataSource={(ds) => setDataSource(field.id, ds)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FieldRow({
  field,
  entry,
  onVisibility,
  onDataSource,
}: {
  field: FormFieldDescriptor;
  entry: FormFieldEntry;
  onVisibility: (v: FieldVisibility) => void;
  onDataSource: (v: string) => void;
}) {
  const [ds, setDs] = useState(entry.dataSourceRef ?? '');
  useEffect(() => setDs(entry.dataSourceRef ?? ''), [entry.dataSourceRef]);

  return (
    <li className="flex flex-col gap-2 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-slate-900">{field.label || field.id}</span>
          <span className="truncate text-xs text-slate-400">
            {field.id} • {field.type}
          </span>
        </div>
        <VisibilityToggle value={entry.visibility} onChange={onVisibility} />
      </div>
      {entry.visibility !== 'hidden' && (
        <Field label="Fonte de dados (opcional)">
          <TextInput
            value={ds}
            onChange={(e) => setDs(e.target.value)}
            onBlur={() => onDataSource(ds)}
            placeholder="Identificador da fonte"
          />
        </Field>
      )}
    </li>
  );
}

function VisibilityToggle({
  value,
  onChange,
}: {
  value: FieldVisibility;
  onChange: (v: FieldVisibility) => void;
}) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-slate-300">
      {STATES.map(({ value: v, icon: Icon, label }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            title={label}
            onClick={() => onChange(v)}
            className={[
              'flex items-center justify-center px-2 py-1.5',
              active
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50',
            ].join(' ')}
            aria-pressed={active}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Field, TextInput, TextArea, Select, Checkbox } from '@/components/ui/Field';
import { Dialog } from '@/components/ui/Dialog';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { slugify } from '@/lib/slugify';
import type { FormGroup, FormField } from '@/lib/api/forms';

const FIELD_TYPES = [
  { value: 'textfield', label: 'Texto' },
  { value: 'textarea', label: 'Área de texto' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Lista (select)' },
  { value: 'radio', label: 'Opções (radio)' },
  { value: 'checkbox', label: 'Caixa de seleção' },
  { value: 'datetime', label: 'Data/Hora' },
  { value: 'email', label: 'E-mail' },
];

type Option = { value: string; label: string };

/**
 * Builder React de campos do formulário (autoria dentro do processo). Opera sobre
 * o modelo {grupos, campos}; o pai converte para/de schema form-js (no BPMN).
 */
export function FormFieldsBuilder({ groups, fields, onGroups, onFields, maskOptions, dsOptions }: {
  groups: FormGroup[];
  fields: FormField[];
  onGroups: (g: FormGroup[]) => void;
  onFields: (f: FormField[]) => void;
  maskOptions: Option[];
  dsOptions: Option[];
}) {
  const groupOptions: Option[] = [{ value: '', label: '— sem grupo —' }, ...groups.filter((g) => g.name).map((g) => ({ value: slugify(g.name), label: g.name }))];

  function addGroup() {
    onGroups([...groups, { key: '', name: '', order: groups.length, columns: 1 }]);
  }
  function addField() {
    onFields([...fields, { type: 'textfield', key: '', name: '', order: fields.length, columns: 1, isRequired: false, isVisibleReport: true, isVisibleRequester: true }]);
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Agrupamentos</h3>
          <button type="button" onClick={addGroup} className="text-xs font-medium text-slate-600 hover:text-slate-900">+ grupo</button>
        </div>
        <div className="space-y-2">
          {groups.length === 0 && <p className="text-sm text-slate-400">Sem grupos — os campos ficam soltos no formulário.</p>}
          {groups.map((g, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
              <TextInput value={g.name} placeholder="Nome do grupo" onChange={(e) => onGroups(groups.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <span className="shrink-0 text-xs text-slate-400">colunas</span>
              <input type="number" min={1} max={4} value={g.columns} onChange={(e) => onGroups(groups.map((x, j) => j === i ? { ...x, columns: Number(e.target.value) || 1 } : x))} className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
              <button type="button" onClick={() => onGroups(groups.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Campos</h3>
          <button type="button" onClick={addField} className="text-xs font-medium text-slate-600 hover:text-slate-900">+ campo</button>
        </div>
        <div className="space-y-2">
          {fields.length === 0 && <p className="text-sm text-slate-400">Nenhum campo ainda.</p>}
          {fields.map((f, i) => (
            <FieldCard key={i} field={f} groupOptions={groupOptions} maskOptions={maskOptions} dsOptions={dsOptions}
              onChange={(nf) => onFields(fields.map((x, j) => j === i ? nf : x))}
              onRemove={() => onFields(fields.filter((_, j) => j !== i))} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FieldCard({ field, groupOptions, maskOptions, dsOptions, onChange, onRemove }: {
  field: FormField;
  groupOptions: Option[];
  maskOptions: Option[];
  dsOptions: Option[];
  onChange: (f: FormField) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const set = (patch: Partial<FormField>) => onChange({ ...field, ...patch });
  const helpType = field.helpTextType ?? 'inline';
  const supportsOptions = field.type === 'select' || field.type === 'radio';

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center gap-2 p-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded p-1 text-slate-400 hover:bg-slate-100">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
        <div className="w-36 shrink-0"><Select value={field.type} options={FIELD_TYPES} onChange={(e) => set({ type: e.target.value })} /></div>
        <TextInput value={field.name} placeholder="Rótulo do campo" onChange={(e) => set({ name: e.target.value })} />
        <div className="w-44 shrink-0"><Select value={field.groupKey ?? ''} options={groupOptions} onChange={(e) => set({ groupKey: e.target.value || null })} /></div>
        <label className="flex shrink-0 items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={field.isRequired} onChange={(e) => set({ isRequired: e.target.checked })} /> obrig.</label>
        <button type="button" onClick={onRemove} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button>
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50 p-3">
          <Field label="Texto de ajuda">
            <div className="space-y-1.5">
              <Select value={helpType} options={[{ value: 'inline', label: 'Inline (abaixo do campo)' }, { value: 'popover', label: 'Popover (ícone com rich-text)' }]} onChange={(e) => set({ helpTextType: e.target.value })} />
              {helpType === 'popover' ? (
                <button type="button" onClick={() => setHelpOpen(true)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50">
                  {field.helpText ? 'Editar texto de ajuda…' : 'Definir texto de ajuda…'}
                </button>
              ) : (
                <TextArea rows={2} value={field.helpText ?? ''} onChange={(e) => set({ helpText: e.target.value })} />
              )}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Prefixo"><TextInput value={field.prefix ?? ''} onChange={(e) => set({ prefix: e.target.value })} /></Field>
            <Field label="Sufixo"><TextInput value={field.suffix ?? ''} onChange={(e) => set({ suffix: e.target.value })} /></Field>
            <Field label="Mín. caracteres"><TextInput type="number" value={field.minLength ?? ''} onChange={(e) => set({ minLength: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Máx. caracteres"><TextInput type="number" value={field.maxLength ?? ''} onChange={(e) => set({ maxLength: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Colunas"><TextInput type="number" value={field.columns} onChange={(e) => set({ columns: Number(e.target.value) || 1 })} /></Field>
          </div>
          <Field label="Máscara"><Select value={field.maskId ?? ''} options={maskOptions} onChange={(e) => set({ maskId: e.target.value || null })} /></Field>
          <Field label={supportsOptions ? 'Fonte de dados (opções)' : 'Fonte de dados'}>
            <Select value={field.dataSourceId ?? ''} options={dsOptions} onChange={(e) => set({ dataSourceId: e.target.value || null })} />
          </Field>
          <div className="col-span-2 flex gap-4">
            <Checkbox checked={field.isVisibleReport} onChange={(v) => set({ isVisibleReport: v })} label="Visível no relatório" />
            <Checkbox checked={field.isVisibleRequester} onChange={(v) => set({ isVisibleRequester: v })} label="Visível ao requisitante" />
          </div>
        </div>
      )}

      {helpOpen && (
        <Dialog open onClose={() => setHelpOpen(false)} width="lg" title="Texto de ajuda (popover)"
          footer={<button onClick={() => setHelpOpen(false)} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Concluir</button>}>
          <RichTextEditor value={field.helpText ?? ''} onChange={(html) => set({ helpText: html })} />
        </Dialog>
      )}
    </div>
  );
}

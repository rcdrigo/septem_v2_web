import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import { selectFieldGroups, useFormStore } from '@/stores/form';
import {
  getFormFieldEntries,
  setFormFieldEntries,
  upsertFieldEntry,
  type FieldVisibility,
  type FormFieldEntry,
} from '@/lib/bpmn-form-fields';

type Props = {
  modeler: any | null;
};

const VIS_STATES: ReadonlyArray<{ value: FieldVisibility; icon: typeof Eye; label: string }> = [
  { value: 'hidden', icon: EyeOff, label: 'Oculto' },
  { value: 'visible', icon: Eye, label: 'Visível' },
  { value: 'editable', icon: Pencil, label: 'Editável' },
];

const HUMAN_TASK_TYPES = new Set(['bpmn:UserTask', 'bpmn:StartEvent']);

/**
 * View "Tarefas × Campos" — matriz full-page. Linhas = campos do formulário
 * agrupados pelo container do form-js. Colunas = tarefas humanas + Início.
 *
 * Cada célula expõe o toggle 3-estados (oculto/visível/editável) e persiste
 * em `septem:FormFields > septem:FormFieldEntry[]` na tarefa correspondente.
 *
 * Visão consolidada da visibilidade de cada campo em cada tarefa humana.
 */
export function TarefasCamposView({ modeler }: Props) {
  const formFields = useFormStore((s) => s.fields);
  const fieldGroups = useMemo(() => selectFieldGroups(formFields), [formFields]);

  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [entriesByTask, setEntriesByTask] = useState<Record<string, FormFieldEntry[]>>({});

  // Recarrega tarefas e entries quando o modeler troca ou um evento de mudança ocorre.
  useEffect(() => {
    if (!modeler) return;
    function refresh() {
      const ts = listHumanTasks(modeler);
      setTasks(ts);
      const map: Record<string, FormFieldEntry[]> = {};
      ts.forEach((t) => {
        map[t.id] = getFormFieldEntries(t.element);
      });
      setEntriesByTask(map);
    }
    refresh();
    const bus = modeler.get('eventBus');
    const events = ['shape.added', 'shape.removed', 'elements.changed', 'commandStack.changed'];
    events.forEach((ev) => bus.on(ev, refresh));
    return () => events.forEach((ev) => bus.off(ev, refresh));
  }, [modeler]);

  if (!modeler) {
    return <EmptyState text="Aguarde o modelador carregar." />;
  }
  if (formFields.length === 0) {
    return (
      <EmptyState
        text="Sem campos no formulário. Vá em Formulário, cadastre os campos, e volte aqui."
      />
    );
  }
  if (tasks.length === 0) {
    return (
      <EmptyState text="Sem tarefas humanas no processo. Adicione um Início ou uma Tarefa humana no Fluxo." />
    );
  }

  function setCell(taskId: string, fieldRef: string, visibility: FieldVisibility) {
    const current = entriesByTask[taskId] ?? [];
    const next = upsertFieldEntry(current, fieldRef, { visibility });
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setFormFieldEntries(modeler, task.element, next);
    setEntriesByTask((m) => ({ ...m, [taskId]: next }));
  }

  function entryFor(taskId: string, fieldRef: string): FormFieldEntry {
    const e = entriesByTask[taskId]?.find((x) => x.fieldRef === fieldRef);
    return e ?? { fieldRef, visibility: 'visible' };
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-slate-200 bg-slate-50 px-5 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900">Tarefas × Campos</h2>
        <p className="text-xs text-slate-500">
          Defina a visibilidade de cada campo do formulário em cada tarefa do processo.
        </p>
      </header>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_#e2e8f0]">
            <tr>
              <th className="sticky left-0 z-20 min-w-[220px] border-b border-slate-200 bg-slate-50 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Campo
              </th>
              {tasks.map((t) => (
                <th
                  key={t.id}
                  className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700"
                  title={t.id}
                >
                  <div className="flex flex-col items-center">
                    <span className="truncate">{t.label}</span>
                    <span className="text-[10px] font-normal text-slate-400">{t.kind}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fieldGroups.map(({ group, fields }) => (
              <>
                <tr key={`group-${group}`}>
                  <th
                    colSpan={tasks.length + 1}
                    className="sticky left-0 bg-slate-100 px-4 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {group}
                  </th>
                </tr>
                {fields.map((field) => (
                  <tr key={`${group}-${field.id}`} className="hover:bg-slate-50">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2 text-left font-normal text-slate-900"
                    >
                      <div className="flex flex-col">
                        <span>{field.label || field.id}</span>
                        <span className="text-[10px] text-slate-400">
                          {field.id} · {field.type}
                        </span>
                      </div>
                    </th>
                    {tasks.map((t) => {
                      const entry = entryFor(t.id, field.id);
                      return (
                        <td key={t.id} className="border-b border-slate-100 px-3 py-2 text-center">
                          <CellToggle
                            value={entry.visibility}
                            onChange={(v) => setCell(t.id, field.id, v)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellToggle({
  value,
  onChange,
}: {
  value: FieldVisibility;
  onChange: (v: FieldVisibility) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300">
      {VIS_STATES.map(({ value: v, icon: Icon, label }) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          aria-label={label}
          title={label}
          onClick={() => onChange(v)}
          className={[
            'flex h-7 w-7 items-center justify-center transition-colors',
            v === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-100',
          ].join(' ')}
        >
          <Icon size={12} />
        </button>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-100">
      <div className="max-w-md rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        {text}
      </div>
    </div>
  );
}

type TaskInfo = {
  id: string;
  label: string;
  kind: string;
  element: any;
};

function listHumanTasks(modeler: any): TaskInfo[] {
  const registry: any = modeler.get('elementRegistry');
  const out: TaskInfo[] = [];
  registry.forEach((el: any) => {
    const type = el.businessObject?.$type;
    if (!HUMAN_TASK_TYPES.has(type)) return;
    out.push({
      id: el.businessObject.id,
      label: el.businessObject.name || el.businessObject.id,
      kind: type === 'bpmn:StartEvent' ? 'Início' : 'Tarefa humana',
      element: el,
    });
  });
  // Estável: ordem por id pra evitar embaralhamento entre renders
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

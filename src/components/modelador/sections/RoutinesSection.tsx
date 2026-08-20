import { Plus } from 'lucide-react';
import { Field, Section } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';
import { openTab } from '@/lib/nav';
import { DataSourceSelect } from '../fields/DataSourceSelect';
import type { Routines } from '@/lib/bpmn-helpers';
import { routes } from '@/lib/routes';

type Props = {
  modeler: any;
  element: any;
};

const DEFAULTS: Routines = { preCreate: '', postCreate: '', preFinish: '', postFinish: '' };

const FIELDS: ReadonlyArray<{ key: keyof Routines; label: string }> = [
  { key: 'preCreate', label: 'Pré-criação da tarefa' },
  { key: 'postCreate', label: 'Pós-criação da tarefa' },
  { key: 'preFinish', label: 'Pré-finalização da tarefa' },
  { key: 'postFinish', label: 'Pós-finalização da tarefa' },
];

/**
 * Seção "Rotinas" — 4 ganchos de fonte de dados que rodam em momentos diferentes
 * do ciclo da tarefa (antes/depois de criar e antes/depois de finalizar),
 * disponíveis para tarefas, serviços, subprocessos e eventos.
 *
 * O campo aceita texto livre por enquanto (identificador da fonte de dados).
 * Na Fase 4 vira combobox lendo a lista de fontes do tenant.
 */
export function RoutinesSection({ modeler, element }: Props) {
  const { state, flush } = useExtensionState(modeler, element, 'septem:Routines', DEFAULTS);

  return (
    <Section
      title="Rotinas"
      help="Fontes de dados executadas em momentos do ciclo da tarefa."
    >
      {/* Um único atalho para criar fonte, acima dos 4 seletores (cada seletor
          esconde o seu — showNew={false} — para não repetir o botão 4×). */}
      <button
        type="button"
        onClick={() => openTab(`${routes.dataSource('nova')}?scope=form`)}
        className="inline-flex w-fit items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      >
        <Plus size={13} /> Nova fonte de dados
      </button>
      {FIELDS.map(({ key, label }) => (
        <Field key={key} label={label}>
          <DataSourceSelect
            value={state[key]}
            onChange={(v) => flush({ [key]: v } as Partial<Routines>)}
            placeholder="Nenhuma"
            showNew={false}
          />
        </Field>
      ))}
    </Section>
  );
}

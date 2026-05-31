import { Field, Section } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';
import { DataSourceSelect } from '../fields/DataSourceSelect';
import type { Routines } from '@/lib/bpmn-helpers';

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
      description="Fontes de dados executadas em momentos do ciclo da tarefa."
    >
      {FIELDS.map(({ key, label }) => (
        <Field key={key} label={label}>
          <DataSourceSelect
            value={state[key]}
            onChange={(v) => flush({ [key]: v } as Partial<Routines>)}
            placeholder="Nenhuma"
          />
        </Field>
      ))}
    </Section>
  );
}

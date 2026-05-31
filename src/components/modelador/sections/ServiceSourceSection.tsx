import { Field, Section } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';
import { DataSourceSelect } from '../fields/DataSourceSelect';

type Props = {
  modeler: any;
  element: any;
};

type ServiceSource = { dataSourceRef: string };

const DEFAULTS: ServiceSource = { dataSourceRef: '' };

/** Seção "Fonte de dados" para Atividades de serviço — referencia a fonte a executar. */
export function ServiceSourceSection({ modeler, element }: Props) {
  const { state, flush } = useExtensionState(modeler, element, 'septem:ServiceSource', DEFAULTS);

  return (
    <Section title="Fonte de dados">
      <Field label="Fonte de dados a ser executada">
        <DataSourceSelect value={state.dataSourceRef} onChange={(v) => flush({ dataSourceRef: v })} />
      </Field>
    </Section>
  );
}

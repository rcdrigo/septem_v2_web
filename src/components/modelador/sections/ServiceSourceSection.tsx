import { Field, Section, TextInput } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';

type Props = {
  modeler: any;
  element: any;
};

type ServiceSource = { dataSourceRef: string };

const DEFAULTS: ServiceSource = { dataSourceRef: '' };

/**
 * Seção "Fonte de dados" para Atividades de serviço.
 * Referencia a fonte de dados a ser executada pela atividade.
 *
 * O input é texto livre por enquanto; vira combobox lendo fontes cadastradas
 * no tenant assim que houver backend (Fase 6).
 */
export function ServiceSourceSection({ modeler, element }: Props) {
  const { state, update, commit } = useExtensionState(modeler, element, 'septem:ServiceSource', DEFAULTS);

  return (
    <Section title="Fonte de dados">
      <Field label="Fonte de dados a ser executada">
        <TextInput
          value={state.dataSourceRef}
          onChange={(e) => update({ dataSourceRef: e.target.value })}
          onBlur={() => commit('dataSourceRef')}
          placeholder="ex: ds_consulta_cep"
        />
      </Field>
    </Section>
  );
}

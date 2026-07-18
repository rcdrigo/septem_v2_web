import { Field, PlaceholderBox, RadioGroup, Section, TextArea } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';

type Props = {
  modeler: any;
  element: any;
};

type SignatureConfig = {
  mode: 'none' | 'electronic';
  fields: string;
};

const DEFAULTS: SignatureConfig = { mode: 'none', fields: '' };

const MODE_OPTIONS = [
  { value: 'none', label: 'Não utilizar assinatura' },
  { value: 'electronic', label: 'Utilizar assinatura eletrônica' },
] as const;

/**
 * Seção "Assinaturas" — define o tipo de assinatura da tarefa
 * com modos: nenhum / assinatura eletrônica. Quando "eletrônica" é selecionada,
 * mostra a lista de campos a assinar (texto livre por linha — vai virar
 * multi-select de campos do formulário na Fase 4.3).
 */
export function SignatureSection({ modeler, element }: Props) {
  const { state, flush, commit, update } = useExtensionState(
    modeler,
    element,
    'septem:Signature',
    DEFAULTS,
  );

  return (
    <Section title="Assinaturas">
      <RadioGroup<'none' | 'electronic'>
        name="sig-mode"
        value={state.mode}
        onChange={(v) => flush({ mode: v, ...(v === 'none' ? { fields: '' } : {}) })}
        options={MODE_OPTIONS as any}
      />

      {state.mode === 'electronic' && (
        <Field
          label="Campos a serem assinados"
          help="Informe um identificador por linha. Exemplos: campo_1 e campo_2."
        >
          <TextArea
            value={state.fields}
            onChange={(e) => update({ fields: e.target.value })}
            onBlur={() => commit('fields')}
            rows={4}
          />
        </Field>
      )}

      {state.mode === 'electronic' && state.fields.trim() === '' && (
        <PlaceholderBox>Informe ao menos um campo para assinar.</PlaceholderBox>
      )}
    </Section>
  );
}

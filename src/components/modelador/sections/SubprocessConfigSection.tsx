import { Checkbox, Field, RadioGroup, Section, TextInput } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';

type Props = {
  modeler: any;
  element: any;
};

type SubprocessConfig = {
  processRef: string;
  sync: boolean;
  copyValues: boolean;
  showParentMessages: boolean;
  multiInstanceGroupRef: string;
};

const DEFAULTS: SubprocessConfig = {
  processRef: '',
  sync: true,
  copyValues: false,
  showParentMessages: false,
  multiInstanceGroupRef: '',
};

const SYNC_OPTIONS = [
  { value: 'sync', label: 'Síncrono', hint: 'Aguarda o subprocesso terminar antes de seguir.' },
  { value: 'async', label: 'Assíncrono', hint: 'Dispara o subprocesso e continua o fluxo principal.' },
] as const;

/**
 * Configuração de subprocesso: modo síncrono/assíncrono, opções de
 * sincronização e exibição de mensagem, seleção do fluxo chamado e
 * agrupamento para multi-instance.
 */
export function SubprocessConfigSection({ modeler, element }: Props) {
  const { state, update, flush, commit } = useExtensionState(
    modeler,
    element,
    'septem:SubprocessConfig',
    DEFAULTS,
  );

  return (
    <Section title="Configurações do subprocesso">
      <Field label="Processo">
        <TextInput
          value={state.processRef}
          onChange={(e) => update({ processRef: e.target.value })}
          onBlur={() => commit('processRef')}
          placeholder="Chave do processo (ex: flow_solicitacao_compra)"
        />
      </Field>

      <Field label="Sincronia">
        <RadioGroup
          name="subprocess-sync"
          value={state.sync ? 'sync' : 'async'}
          onChange={(v) => flush({ sync: v === 'sync' })}
          options={SYNC_OPTIONS as any}
        />
      </Field>

      <Checkbox
        checked={state.copyValues}
        onChange={(v) => flush({ copyValues: v })}
        label="Copiar valores do formulário"
        hint="Replica os valores do formulário pai no subprocesso."
      />
      <Checkbox
        checked={state.showParentMessages}
        onChange={(v) => flush({ showParentMessages: v })}
        label="Visualizar mensagens do processo-pai"
      />

      <Field
        label="Multi-processos"
        hint="Agrupamento do formulário cujos itens disparam uma instância cada. Vira combobox na Fase 4.3."
      >
        <TextInput
          value={state.multiInstanceGroupRef}
          onChange={(e) => update({ multiInstanceGroupRef: e.target.value })}
          onBlur={() => commit('multiInstanceGroupRef')}
          placeholder="ex: itens_pedido"
        />
      </Field>
    </Section>
  );
}

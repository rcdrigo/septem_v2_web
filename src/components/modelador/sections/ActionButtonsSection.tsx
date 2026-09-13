import { Section } from '@/components/ui/Field';
import { ActionButtonsEditor } from '../editors/ActionButtonsEditor';
import { ContextHelp } from '@/components/guide/ContextHelp';

type Props = {
  modeler: any;
  element: any;
  defaultLabel: string;
};

/**
 * Seção "Botões de ação". Container fino que monta o `ActionButtonsEditor`.
 * Mantemos a Section como camada de apresentação separada do Editor para
 * permitir reuso do Editor em outros contextos (ex: tela "Tarefas × Campos").
 */
export function ActionButtonsSection({ modeler, element, defaultLabel }: Props) {
  return (
    <Section
      title="Botões de ação"
      headerAction={(
        <ContextHelp
          manual="modelador-processos"
          section="botoes-acao"
          label="Ajuda sobre botões de ação"
        />
      )}
    >
      <ActionButtonsEditor modeler={modeler} element={element} defaultLabel={defaultLabel} />
    </Section>
  );
}

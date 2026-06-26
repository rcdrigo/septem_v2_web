import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { FormFieldsSection } from '../sections/FormFieldsSection';
import { ActionButtonsSection } from '../sections/ActionButtonsSection';
import { DeadlineActorSection } from '../sections/DeadlineActorSection';
import { SignatureSection } from '../sections/SignatureSection';
import { RoutinesSection } from '../sections/RoutinesSection';
import { useEnsureFormFields } from '@/lib/use-ensure-form-fields';
import type { PanelProps } from './types';

/**
 * Painel da Tarefa humana.
 *
 * Reúne toda a configuração de uma tarefa humana — o painel mais completo do modelador.
 */
export function UserTaskPanel({ modeler, element }: PanelProps) {
  // Popula os campos do formulário (matriz/visibilidade e seletores) ao abrir.
  useEnsureFormFields(modeler);
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <FormFieldsSection modeler={modeler} element={element} />
      <ActionButtonsSection modeler={modeler} element={element} defaultLabel="Concluir" />
      <DeadlineActorSection modeler={modeler} element={element} />
      <SignatureSection modeler={modeler} element={element} />
      <RoutinesSection modeler={modeler} element={element} />
    </>
  );
}

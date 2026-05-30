import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { FormFieldsSection } from '../sections/FormFieldsSection';
import { ActionButtonsSection } from '../sections/ActionButtonsSection';
import { SignatureSection } from '../sections/SignatureSection';
import { RoutinesSection } from '../sections/RoutinesSection';
import type { PanelProps } from './types';

/**
 * Painel da Atividade de Início.
 *
 * Reúne a mesma configuração das tarefas humanas, mas sem "Responsáveis e
 * prazos" — quem inicia o processo é sempre o requisitante.
 */
export function StartEventPanel({ modeler, element }: PanelProps) {
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <FormFieldsSection modeler={modeler} element={element} />
      <ActionButtonsSection modeler={modeler} element={element} defaultLabel="Enviar requisição" />
      <SignatureSection modeler={modeler} element={element} />
      <RoutinesSection modeler={modeler} element={element} />
    </>
  );
}

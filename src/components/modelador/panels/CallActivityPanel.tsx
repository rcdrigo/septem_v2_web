import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { SubprocessConfigSection } from '../sections/SubprocessConfigSection';
import { RoutinesSection } from '../sections/RoutinesSection';
import type { PanelProps } from './types';

/**
 * Painel do Subprocesso (BPMN CallActivity): informações gerais, configuração
 * do subprocesso chamado e rotinas de ciclo de vida.
 */
export function CallActivityPanel({ modeler, element }: PanelProps) {
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <SubprocessConfigSection modeler={modeler} element={element} />
      <RoutinesSection modeler={modeler} element={element} />
    </>
  );
}

import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { ServiceSourceSection } from '../sections/ServiceSourceSection';
import { RoutinesSection } from '../sections/RoutinesSection';
import type { PanelProps } from './types';

/**
 * Painel da Atividade de serviço: informações gerais, fonte de dados a
 * executar e rotinas de ciclo de vida.
 */
export function ServiceTaskPanel({ modeler, element }: PanelProps) {
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <ServiceSourceSection modeler={modeler} element={element} />
      <RoutinesSection modeler={modeler} element={element} />
    </>
  );
}

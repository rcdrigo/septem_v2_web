import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { ServiceSourceSection } from '../sections/ServiceSourceSection';
import { RoutinesSection } from '../sections/RoutinesSection';
import type { PanelProps } from './types';

/**
 * Painel da Atividade de serviço / fonte de dados. Espelha `ConfigTaskService.aspx`.
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

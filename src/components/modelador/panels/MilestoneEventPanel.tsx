import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { MilestoneSection } from '../sections/MilestoneSection';
import { RoutinesSection } from '../sections/RoutinesSection';
import type { PanelProps } from './types';

/**
 * Painel do Evento de marco. Espelha `ConfigEventMilestone.aspx`.
 */
export function MilestoneEventPanel({ modeler, element }: PanelProps) {
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <MilestoneSection modeler={modeler} element={element} />
      <RoutinesSection modeler={modeler} element={element} />
    </>
  );
}

import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { SubprocessConfigSection } from '../sections/SubprocessConfigSection';
import { RoutinesSection } from '../sections/RoutinesSection';
import type { PanelProps } from './types';

/**
 * Painel do Subprocesso (BPMN CallActivity). Espelha `ConfigTaskSubprocess.aspx`.
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

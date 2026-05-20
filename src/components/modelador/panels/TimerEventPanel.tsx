import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { TimerSection } from '../sections/TimerSection';
import { RoutinesSection } from '../sections/RoutinesSection';
import type { PanelProps } from './types';

/**
 * Painel do Evento de timer. Espelha `ConfigEventTimer.aspx`.
 */
export function TimerEventPanel({ modeler, element }: PanelProps) {
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <TimerSection modeler={modeler} element={element} />
      <RoutinesSection modeler={modeler} element={element} />
    </>
  );
}

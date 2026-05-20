import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { EmailTemplateSection } from '../sections/EmailTemplateSection';
import { RoutinesSection } from '../sections/RoutinesSection';
import type { PanelProps } from './types';

/**
 * Painel do Evento de e-mail. Espelha `ConfigEventEmail.aspx`.
 */
export function EmailEventPanel({ modeler, element }: PanelProps) {
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <EmailTemplateSection modeler={modeler} element={element} />
      <RoutinesSection modeler={modeler} element={element} />
    </>
  );
}

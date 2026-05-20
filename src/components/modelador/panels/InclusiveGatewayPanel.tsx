import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { GatewayLinksSection } from '../sections/GatewayLinksSection';
import type { PanelProps } from './types';

/**
 * Painel do Desvio condicional inclusivo (uma ou mais condições podem ser verdadeiras).
 * Espelha `ConfigGatewayFork.aspx` com tipo OR.
 */
export function InclusiveGatewayPanel({ modeler, element }: PanelProps) {
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <GatewayLinksSection modeler={modeler} element={element} direction="outgoing" configurableConditions />
    </>
  );
}

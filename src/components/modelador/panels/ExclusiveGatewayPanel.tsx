import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { GatewayLinksSection } from '../sections/GatewayLinksSection';
import type { PanelProps } from './types';

/**
 * Painel do Desvio condicional exclusivo (apenas uma condição pode ser verdadeira).
 * Espelha `ConfigGatewayFork.aspx` com tipo XOR.
 */
export function ExclusiveGatewayPanel({ modeler, element }: PanelProps) {
  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <GatewayLinksSection modeler={modeler} element={element} direction="outgoing" configurableConditions />
    </>
  );
}

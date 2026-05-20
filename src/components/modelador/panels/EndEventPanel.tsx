import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import type { PanelProps } from './types';

/**
 * Painel do Evento de fim. Apenas informações gerais — não há configuração
 * adicional na spec do usuário (o ZEEV também não expõe).
 */
export function EndEventPanel({ modeler, element }: PanelProps) {
  return <GeneralInfoSection modeler={modeler} element={element} />;
}

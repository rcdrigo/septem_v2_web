import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { GatewayLinksSection } from '../sections/GatewayLinksSection';
import type { PanelProps } from './types';

/**
 * Painel do gateway paralelo. Mesmo shape BPMN é usado tanto para desvio (split)
 * quanto para convergência (join) — distinguimos pela presença de >1 saídas vs >1 entradas.
 *
 * - Split (1 entrada → N saídas): processo segue para TODAS as tarefas conectadas.
 * - Join (N entradas → 1 saída): aguarda todas as tarefas em execução concluírem.
 *
 * Espelha `ConfigGatewayFork.aspx` tipo AND e `ConfigGatewayJoin.aspx`.
 */
export function ParallelGatewayPanel({ modeler, element }: PanelProps) {
  const isJoin = isJoinShape(element);

  return (
    <>
      <GeneralInfoSection modeler={modeler} element={element} />
      <GatewayLinksSection
        modeler={modeler}
        element={element}
        direction={isJoin ? 'incoming' : 'outgoing'}
      />
    </>
  );
}

function isJoinShape(element: any): boolean {
  const ins = element?.businessObject?.incoming?.length ?? 0;
  const outs = element?.businessObject?.outgoing?.length ?? 0;
  // Mais entradas que saídas → comportando-se como Join.
  // Empate ou só saídas → tratado como Split (default da paleta).
  return ins > 1 && ins >= outs;
}

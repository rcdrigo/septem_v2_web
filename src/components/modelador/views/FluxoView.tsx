import { forwardRef } from 'react';
import { BpmnModeler, type BpmnModelerHandle } from '@/components/bpmn/BpmnModeler';
import { PropertiesPanel } from '../PropertiesPanel';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

type Props = {
  onReady: (modeler: any) => void;
  modelerInstance: any | null;
};

/**
 * View "Fluxo" — canvas BPMN + painel de propriedades. View default do modelador.
 * O `PropertiesPanel` é isolado em `ErrorBoundary` porque cada seção dele depende
 * do `businessObject` do elemento selecionado, que pode estar parcial durante
 * importações ou erros do moddle.
 */
export const FluxoView = forwardRef<BpmnModelerHandle, Props>(function FluxoView(
  { onReady, modelerInstance },
  ref,
) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <BpmnModeler ref={ref} onReady={onReady} />
      <ErrorBoundary context="o painel de propriedades">
        <PropertiesPanel modeler={modelerInstance} />
      </ErrorBoundary>
    </div>
  );
});

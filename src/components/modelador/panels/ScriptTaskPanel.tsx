import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { ServiceSourceSection } from '../sections/ServiceSourceSection';
import type { PanelProps } from './types';

/** A tarefa de script executa a fonte selecionada ao ser alcançada pelo fluxo. */
export function ScriptTaskPanel({ modeler, element }: PanelProps) {
  return <>
    <GeneralInfoSection modeler={modeler} element={element} />
    <ServiceSourceSection modeler={modeler} element={element} />
  </>;
}

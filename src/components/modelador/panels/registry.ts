import type { ComponentType } from 'react';
import { StartEventPanel } from './StartEventPanel';
import { EndEventPanel } from './EndEventPanel';
import { UserTaskPanel } from './UserTaskPanel';
import { ScriptTaskPanel } from './ScriptTaskPanel';
import { ServiceTaskPanel } from './ServiceTaskPanel';
import { CallActivityPanel } from './CallActivityPanel';
import { EmailEventPanel } from './EmailEventPanel';
import { TimerEventPanel } from './TimerEventPanel';
import { MilestoneEventPanel } from './MilestoneEventPanel';
import { InclusiveGatewayPanel } from './InclusiveGatewayPanel';
import { ExclusiveGatewayPanel } from './ExclusiveGatewayPanel';
import { ParallelGatewayPanel } from './ParallelGatewayPanel';
import { GenericPanel } from './GenericPanel';
import type { PanelProps } from './types';

export type PanelComponent = ComponentType<PanelProps>;

/**
 * Resolve qual painel React deve ser renderizado para o elemento selecionado.
 * É a única função "switch por tipo" do app — toda a lógica de UI específica
 * mora dentro de cada Panel/Section.
 */
export function resolvePanel(element: any): { Panel: PanelComponent; label: string } {
  const type = element?.businessObject?.$type ?? '';
  const evDef = element?.businessObject?.eventDefinitions?.[0]?.$type ?? '';

  switch (type) {
    case 'bpmn:StartEvent':
      return { Panel: StartEventPanel, label: 'Início' };
    case 'bpmn:EndEvent':
      return { Panel: EndEventPanel, label: 'Fim' };
    case 'bpmn:UserTask':
      return { Panel: UserTaskPanel, label: 'Tarefa humana' };
    case 'bpmn:ScriptTask':
      return { Panel: ScriptTaskPanel, label: 'Tarefa de script' };
    case 'bpmn:ServiceTask':
      return { Panel: ServiceTaskPanel, label: 'Atividade de serviço' };
    case 'bpmn:CallActivity':
      return { Panel: CallActivityPanel, label: 'Subprocesso' };
    case 'bpmn:InclusiveGateway':
      return { Panel: InclusiveGatewayPanel, label: 'Desvio condicional (inclusivo)' };
    case 'bpmn:ExclusiveGateway':
      return { Panel: ExclusiveGatewayPanel, label: 'Desvio condicional exclusivo' };
    case 'bpmn:ParallelGateway':
      return { Panel: ParallelGatewayPanel, label: 'Gateway paralelo' };
    case 'bpmn:IntermediateThrowEvent':
      if (evDef === 'bpmn:MessageEventDefinition')
        return { Panel: EmailEventPanel, label: 'Evento de e-mail' };
      if (evDef === 'bpmn:SignalEventDefinition')
        return { Panel: MilestoneEventPanel, label: 'Evento de marco' };
      return { Panel: GenericPanel, label: 'Evento intermediário' };
    case 'bpmn:IntermediateCatchEvent':
      if (evDef === 'bpmn:TimerEventDefinition')
        return { Panel: TimerEventPanel, label: 'Evento de timer' };
      return { Panel: GenericPanel, label: 'Evento intermediário' };
    case 'bpmn:SequenceFlow':
      return { Panel: GenericPanel, label: 'Conexão' };
    case 'bpmn:Process':
      return { Panel: GenericPanel, label: 'Processo' };
    default:
      return { Panel: GenericPanel, label: type.replace(/^bpmn:/, '') || 'Elemento' };
  }
}

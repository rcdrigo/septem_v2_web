import type { ComponentType } from 'react';
import { StartEventPanel } from './StartEventPanel';
import { EndEventPanel } from './EndEventPanel';
import { UserTaskPanel } from './UserTaskPanel';
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
export function resolvePanel(element: any): { Panel: PanelComponent; label: string; type: string } {
  const type = element?.businessObject?.$type ?? '';
  const evDef = element?.businessObject?.eventDefinitions?.[0]?.$type ?? '';

  switch (type) {
    case 'bpmn:StartEvent':
      return { Panel: StartEventPanel, label: 'Início', type };
    case 'bpmn:EndEvent':
      return { Panel: EndEventPanel, label: 'Fim', type };
    case 'bpmn:UserTask':
      return { Panel: UserTaskPanel, label: 'Tarefa humana', type };
    case 'bpmn:ServiceTask':
      return { Panel: ServiceTaskPanel, label: 'Atividade de serviço', type };
    case 'bpmn:CallActivity':
      return { Panel: CallActivityPanel, label: 'Subprocesso', type };
    case 'bpmn:InclusiveGateway':
      return { Panel: InclusiveGatewayPanel, label: 'Desvio condicional (inclusivo)', type };
    case 'bpmn:ExclusiveGateway':
      return { Panel: ExclusiveGatewayPanel, label: 'Desvio condicional exclusivo', type };
    case 'bpmn:ParallelGateway':
      return { Panel: ParallelGatewayPanel, label: 'Gateway paralelo', type };
    case 'bpmn:IntermediateThrowEvent':
      if (evDef === 'bpmn:MessageEventDefinition')
        return { Panel: EmailEventPanel, label: 'Evento de e-mail', type };
      if (evDef === 'bpmn:SignalEventDefinition')
        return { Panel: MilestoneEventPanel, label: 'Evento de marco', type };
      return { Panel: GenericPanel, label: 'Evento intermediário', type };
    case 'bpmn:IntermediateCatchEvent':
      if (evDef === 'bpmn:TimerEventDefinition')
        return { Panel: TimerEventPanel, label: 'Evento de timer', type };
      return { Panel: GenericPanel, label: 'Evento intermediário', type };
    case 'bpmn:SequenceFlow':
      return { Panel: GenericPanel, label: 'Conexão', type };
    case 'bpmn:Process':
      return { Panel: GenericPanel, label: 'Processo', type };
    default:
      return { Panel: GenericPanel, label: type.replace(/^bpmn:/, '') || 'Elemento', type };
  }
}

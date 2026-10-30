import { getExtensionConfig } from './bpmn-helpers';

export type DeadlineConfig = {
  respectWorkHours: boolean;
  sendReceiptMail: boolean;
  sendDeadlineMail: boolean;
  expiresIn: string;
  expiresInFieldRef: string;
  overdueAction: 'record' | 'timer' | 'notify' | 'reassign';
  overdueTimerRef: string;
  overdueNotifyTarget: 'assignee' | 'supervisor';
  overdueAreaId: string;
  overduePositionId: string;
};

export const DEADLINE_DEFAULTS: DeadlineConfig = {
  respectWorkHours: false, sendReceiptMail: false, sendDeadlineMail: false,
  expiresIn: '', expiresInFieldRef: '', overdueAction: 'record', overdueTimerRef: '',
  overdueNotifyTarget: 'assignee', overdueAreaId: '', overduePositionId: '',
};

export type BoundaryTimerConfig = { deadlineSource: 'task' | 'custom' };
export const BOUNDARY_TIMER_DEFAULTS: BoundaryTimerConfig = { deadlineSource: 'task' };

export type TimerElement = {
  id: string;
  type?: string;
  businessObject: {
    $type: string;
    name?: string;
    cancelActivity?: boolean;
    attachedToRef?: { id: string };
    eventDefinitions?: { $type: string }[];
    outgoing?: { id: string }[];
  };
};

export function isBoundaryTimer(element: TimerElement): boolean {
  return element.type !== 'label' && element.businessObject.$type === 'bpmn:BoundaryEvent'
    && !!element.businessObject.eventDefinitions?.some((definition) => definition.$type === 'bpmn:TimerEventDefinition');
}

export function attachedTimers(elements: TimerElement[], taskId: string): TimerElement[] {
  return elements.filter((element) => isBoundaryTimer(element) && element.businessObject.attachedToRef?.id === taskId);
}

export function deadlineSummary(config: DeadlineConfig): string {
  if (config.expiresInFieldRef) return `Prazo definido pelo campo ${config.expiresInFieldRef}.`;
  if (config.expiresIn) return `Prazo de ${config.expiresIn} horas${config.respectWorkHours ? ' úteis' : ''}.`;
  return 'A tarefa ainda não tem prazo. Defina as horas ou um campo no painel da tarefa.';
}

export function deadlineErrors(task: TimerElement, timers: TimerElement[]): string[] {
  const config = getExtensionConfig(task, 'septem:DeadlineConfig', DEADLINE_DEFAULTS);
  if (config.overdueAction === 'record') return [];
  const errors: string[] = [];
  if (!config.expiresInFieldRef && !(Number.isFinite(Number(config.expiresIn)) && Number(config.expiresIn) > 0)) errors.push('Defina um prazo maior que zero ou um campo para a ação no vencimento.');
  if (config.overdueAction === 'timer') {
    const timer = timers.find((candidate) => candidate.id === config.overdueTimerRef);
    if (!timer) errors.push('Selecione um timer anexado à tarefa para seguir no vencimento.');
    else if (getExtensionConfig(timer, 'septem:BoundaryTimerConfig', BOUNDARY_TIMER_DEFAULTS).deadlineSource !== 'task') errors.push('O timer selecionado deve usar o prazo da tarefa.');
  }
  if (config.overdueAction === 'reassign' && (!config.overdueAreaId || !config.overduePositionId)) errors.push('Selecione a unidade organizacional e a posição para reatribuir a tarefa.');
  return errors;
}

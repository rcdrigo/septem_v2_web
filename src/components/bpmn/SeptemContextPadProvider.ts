/**
 * Context pad do septem — os ícones que aparecem ao selecionar um elemento.
 *
 * O bpmn-js, por padrão, oferece "append Task" criando um **`bpmn:Task` genérico**.
 * Esse tipo NÃO é executável pelo nosso motor: o parser o ignorava e a execução
 * "pulava" o elemento, concluindo o processo antes da hora (bug reportado em
 * 2026-07-11: processo com 3 tarefas encerrava ao concluir a 1ª).
 *
 * Aqui oferecemos apenas as ações do modelador, com os mesmos tipos da paleta.
 */
export class SeptemContextPadProvider {
  static $inject = ['contextPad', 'elementFactory', 'create', 'autoPlace'];

  private elementFactory: any;
  private create: any;
  private autoPlace: any;

  constructor(
    contextPad: any,
    elementFactory: any,
    create: any,
    autoPlace: any,
  ) {
    this.elementFactory = elementFactory;
    this.create = create;
    this.autoPlace = autoPlace;
    // O provider padrão roda com prioridade 1000. Rodamos depois dele para
    // filtrar entradas extras e reutilizar suas ações de conectar, alterar e excluir.
    contextPad.registerProvider(500, this);
  }

  /** Cria (append) um elemento do tipo dado, ligado ao elemento atual. */
  private appendAction(type: string, className: string, title: string, options: Record<string, string> = {}) {
    const { elementFactory, create, autoPlace } = this;

    function appendStart(event: any, element: any) {
      const shape = elementFactory.createShape({ type, ...options });
      create.start(event, shape, { source: element });
    }

    function append(event: any, element: any) {
      if (!autoPlace) return appendStart(event, element);
      const shape = elementFactory.createShape({ type, ...options });
      autoPlace.append(element, shape);
    }

    return {
      group: 'model',
      className,
      title,
      action: { dragstart: appendStart, click: append },
    };
  }

  getContextPadEntries(element: any) {
    const bo = element?.businessObject;
    const isConnection = !!element?.waypoints;
    const type: string = bo?.$type ?? '';

    // Só oferecemos "anexar próximo" em nós que continuam o fluxo.
    const canAppend =
      !isConnection &&
      !type.includes('EndEvent') &&
      (type.includes('Task') || type.includes('Event') || type.includes('Gateway') || type.includes('Activity'));

    return (entries: Record<string, any>) => {
      const allowed: Record<string, any> = {};

      if (canAppend) {
        allowed['append.user-task'] = this.appendAction('bpmn:UserTask', 'bpmn-icon-user-task', 'Nova tarefa humana');
        allowed['append.script-task'] = this.appendAction('bpmn:ScriptTask', 'bpmn-icon-script-task', 'Nova tarefa de script');
        allowed['append.service-task'] = this.appendAction('bpmn:ServiceTask', 'bpmn-icon-service-task', 'Nova tarefa de serviço');
        allowed['append.subprocess'] = this.appendAction('bpmn:CallActivity', 'bpmn-icon-call-activity', 'Nova tarefa de subprocesso');
        allowed['append.email-event'] = this.appendAction('bpmn:IntermediateThrowEvent', 'bpmn-icon-intermediate-event-throw-message', 'Novo evento de e-mail', { eventDefinitionType: 'bpmn:MessageEventDefinition' });
        allowed['append.timer-event'] = this.appendAction('bpmn:IntermediateCatchEvent', 'bpmn-icon-intermediate-event-catch-timer', 'Novo evento de timer', { eventDefinitionType: 'bpmn:TimerEventDefinition' });
        allowed['append.exclusive-gateway'] = this.appendAction('bpmn:ExclusiveGateway', 'bpmn-icon-gateway-xor', 'Novo evento de condicional exclusivo');
        allowed['append.terminate-end-event'] = this.appendAction('bpmn:EndEvent', 'bpmn-icon-end-event-terminate', 'Novo evento de fim total', { eventDefinitionType: 'bpmn:TerminateEventDefinition' });
      }

      // Ações de RAIA do provider padrão (`lane-insert-above/below`, `lane-divide-*`):
      // o filtro passou a SUBSTITUIR as entradas em vez de somar-se a elas e levou as
      // raias embora — numa piscina não sobrava nenhuma forma de acrescentar raia pela
      // tela. Só o `bpmn:Task` genérico precisa ficar de fora (o motor não o executa).
      for (const [chave, entrada] of Object.entries(entries)) {
        if (chave.startsWith('lane-')) allowed[chave] = entrada;
      }

      if (entries.connect) allowed.connect = { ...entries.connect, title: 'Novo conector' };
      if (entries.replace) allowed.replace = { ...entries.replace, title: 'Alterar elemento' };
      if (entries.delete) allowed.delete = { ...entries.delete, title: 'Excluir elemento' };

      return allowed;
    };
  }

  getMultiElementContextPadEntries() {
    return (entries: Record<string, any>) =>
      entries.delete ? { delete: { ...entries.delete, title: 'Excluir elemento' } } : {};
  }
}

export const SeptemContextPadModule = {
  __init__: ['septemContextPadProvider'],
  septemContextPadProvider: ['type', SeptemContextPadProvider],
};

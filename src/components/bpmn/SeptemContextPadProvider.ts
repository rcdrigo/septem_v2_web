/**
 * Context pad do septem — os ícones que aparecem ao selecionar um elemento.
 *
 * O bpmn-js, por padrão, oferece "append Task" criando um **`bpmn:Task` genérico**.
 * Esse tipo NÃO é executável pelo nosso motor: o parser o ignorava e a execução
 * "pulava" o elemento, concluindo o processo antes da hora (bug reportado em
 * 2026-07-11: processo com 3 tarefas encerrava ao concluir a 1ª).
 *
 * Aqui trocamos essa entrada pelos tipos que o motor entende — "Tarefa humana"
 * como padrão — e removemos a genérica.
 */
export class SeptemContextPadProvider {
  static $inject = ['contextPad', 'modeling', 'elementFactory', 'connect', 'create', 'autoPlace', 'translate'];

  private modeling: any;
  private elementFactory: any;
  private create: any;
  private autoPlace: any;

  constructor(
    contextPad: any,
    modeling: any,
    elementFactory: any,
    _connect: any,
    create: any,
    autoPlace: any,
    _translate: any,
  ) {
    this.modeling = modeling;
    this.elementFactory = elementFactory;
    this.create = create;
    this.autoPlace = autoPlace;
    contextPad.registerProvider(this);
  }

  /** Cria (append) um elemento do tipo dado, ligado ao elemento atual. */
  private appendAction(type: string, className: string, title: string) {
    const { elementFactory, create, autoPlace, modeling } = this;

    function appendStart(event: any, element: any) {
      const shape = elementFactory.createShape({ type });
      create.start(event, shape, { source: element });
    }

    function append(_event: any, element: any) {
      const shape = elementFactory.createShape({ type });
      if (autoPlace) autoPlace.append(element, shape);
      else modeling.appendShape(element, shape, { x: 0, y: 0 }, element.parent);
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

    if (!canAppend) return {};

    return {
      'append.user-task': this.appendAction('bpmn:UserTask', 'bpmn-icon-user-task', 'Tarefa humana'),
      'append.service-task': this.appendAction('bpmn:ServiceTask', 'bpmn-icon-service-task', 'Tarefa de sistema'),
      'append.exclusive-gateway': this.appendAction('bpmn:ExclusiveGateway', 'bpmn-icon-gateway-xor', 'Desvio condicional'),
      'append.end-event': this.appendAction('bpmn:EndEvent', 'bpmn-icon-end-event-none', 'Fim'),
    };
  }
}

export const SeptemContextPadModule = {
  __init__: ['septemContextPadProvider'],
  septemContextPadProvider: ['type', SeptemContextPadProvider],
};

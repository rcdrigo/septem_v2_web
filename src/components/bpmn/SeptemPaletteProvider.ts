/**
 * Paleta customizada para o modelador do septem_v2.
 *
 * Limita o conjunto de elementos ao que a spec define
 * (12 itens: 3 eventos finais/início/fim, 4 atividades, 3 gateways em 4 papéis, 3 eventos intermediários).
 *
 * Plugada no bpmn-js como módulo via `additionalModules` em `BpmnModeler.tsx`.
 */

type CreateShapeOptions = {
  type: string;
  eventDefinitionType?: string;
  isInterrupting?: boolean;
};

type PaletteEntry = {
  group: string;
  className: string;
  title: string;
  separator?: boolean;
  action?: {
    dragstart?: (event: Event) => void;
    click?: (event: Event) => void;
  };
};

type PaletteEntries = Record<string, PaletteEntry>;

export class SeptemPaletteProvider {
  static $inject = [
    'palette',
    'create',
    'elementFactory',
    'spaceTool',
    'lassoTool',
    'handTool',
    'globalConnect',
    'translate',
  ];

  private create: any;
  private elementFactory: any;
  private spaceTool: any;
  private lassoTool: any;
  private handTool: any;
  private globalConnect: any;

  constructor(
    palette: any,
    create: any,
    elementFactory: any,
    spaceTool: any,
    lassoTool: any,
    handTool: any,
    globalConnect: any,
    _translate: any,
  ) {
    this.create = create;
    this.elementFactory = elementFactory;
    this.spaceTool = spaceTool;
    this.lassoTool = lassoTool;
    this.handTool = handTool;
    this.globalConnect = globalConnect;

    palette.registerProvider(this);
  }

  getPaletteEntries(): PaletteEntries {
    const startCreate = (options: CreateShapeOptions) => (event: Event) => {
      const shape = this.elementFactory.createShape(options);
      this.create.start(event, shape);
    };

    const createEntry = (
      type: string,
      group: string,
      className: string,
      title: string,
      extra: Partial<CreateShapeOptions> = {},
    ): PaletteEntry => {
      const listener = startCreate({ type, ...extra });
      return {
        group,
        className,
        title,
        action: { dragstart: listener, click: listener },
      };
    };

    return {
      'hand-tool': {
        group: 'tools',
        className: 'bpmn-icon-hand-tool',
        title: 'Mover o canvas',
        action: { click: (e) => this.handTool.activateHand(e) },
      },
      'lasso-tool': {
        group: 'tools',
        className: 'bpmn-icon-lasso-tool',
        title: 'Selecionar em área (laço)',
        action: { click: (e) => this.lassoTool.activateSelection(e) },
      },
      'space-tool': {
        group: 'tools',
        className: 'bpmn-icon-space-tool',
        title: 'Inserir/remover espaço',
        action: { click: (e) => this.spaceTool.activateSelection(e) },
      },
      'global-connect-tool': {
        group: 'tools',
        className: 'bpmn-icon-connection-multi',
        title: 'Conectar elementos',
        action: { click: (e) => this.globalConnect.start(e) },
      },
      'tool-separator': {
        group: 'tools',
        className: '',
        title: '',
        separator: true,
      },

      // Eventos: início e fim
      'create.start-event': createEntry(
        'bpmn:StartEvent',
        'event',
        'bpmn-icon-start-event-none',
        'Início',
      ),
      'create.end-event': createEntry(
        'bpmn:EndEvent',
        'event',
        'bpmn-icon-end-event-none',
        'Fim',
      ),

      // Atividades
      'create.user-task': createEntry(
        'bpmn:UserTask',
        'activity',
        'bpmn-icon-user-task',
        'Tarefa humana',
      ),
      'create.service-task': createEntry(
        'bpmn:ServiceTask',
        'activity',
        'bpmn-icon-service-task',
        'Atividade de serviço (fonte de dados)',
      ),
      'create.subprocess': createEntry(
        'bpmn:CallActivity',
        'activity',
        'bpmn-icon-call-activity',
        'Subprocesso',
      ),

      // Eventos intermediários
      'create.email-event': createEntry(
        'bpmn:IntermediateThrowEvent',
        'event',
        'bpmn-icon-intermediate-event-throw-message',
        'Evento de e-mail',
        { eventDefinitionType: 'bpmn:MessageEventDefinition' },
      ),
      'create.timer-event': createEntry(
        'bpmn:IntermediateCatchEvent',
        'event',
        'bpmn-icon-intermediate-event-catch-timer',
        'Evento de timer',
        { eventDefinitionType: 'bpmn:TimerEventDefinition' },
      ),
      'create.milestone-event': createEntry(
        'bpmn:IntermediateThrowEvent',
        'event',
        'bpmn-icon-intermediate-event-throw-signal',
        'Evento de marco',
        { eventDefinitionType: 'bpmn:SignalEventDefinition' },
      ),

      // Gateways
      'create.inclusive-gateway': createEntry(
        'bpmn:InclusiveGateway',
        'gateway',
        'bpmn-icon-gateway-or',
        'Desvio condicional (inclusivo)',
      ),
      'create.exclusive-gateway': createEntry(
        'bpmn:ExclusiveGateway',
        'gateway',
        'bpmn-icon-gateway-xor',
        'Desvio condicional exclusivo',
      ),
      'create.parallel-fork': createEntry(
        'bpmn:ParallelGateway',
        'gateway',
        'bpmn-icon-gateway-parallel',
        'Desvio de paralelismo',
      ),
      'create.parallel-join': createEntry(
        'bpmn:ParallelGateway',
        'gateway',
        'bpmn-icon-gateway-parallel',
        'Convergência de paralelismo',
      ),

      // Piscina/raias: cria um "pool" expandido. As RAIAS (setores) são adicionadas
      // depois pelo context pad padrão do bpmn-js ao selecionar a piscina
      // ("adicionar raia acima/abaixo" / "dividir em raias"). O campo Setor da tarefa
      // (Fase 5b) lê justamente essas raias (bpmn:Lane) do processo.
      'create.participant-expanded': {
        group: 'collaboration',
        className: 'bpmn-icon-participant',
        title: 'Piscina (raias/setores)',
        action: {
          dragstart: (event: Event) => this.create.start(event, this.elementFactory.createParticipantShape()),
          click: (event: Event) => this.create.start(event, this.elementFactory.createParticipantShape()),
        },
      },
    };
  }
}

export const SeptemPaletteModule = {
  __init__: ['paletteProvider'],
  paletteProvider: ['type', SeptemPaletteProvider],
};

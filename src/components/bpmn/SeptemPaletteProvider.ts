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
        title: 'Mover o canvas: Arraste a área do diagrama para visualizar outras partes do fluxo.',
        action: { click: (e) => this.handTool.activateHand(e) },
      },
      'lasso-tool': {
        group: 'tools',
        className: 'bpmn-icon-lasso-tool',
        title: 'Selecionar em área (laço): Selecione vários elementos de uma vez desenhando uma área ao redor deles.',
        action: { click: (e) => this.lassoTool.activateSelection(e) },
      },
      'space-tool': {
        group: 'tools',
        className: 'bpmn-icon-space-tool',
        title: 'Inserir/remover espaço: Afaste ou aproxime elementos para ajustar o espaço entre as etapas do fluxo.',
        action: { click: (e) => this.spaceTool.activateSelection(e) },
      },
      'global-connect-tool': {
        group: 'tools',
        className: 'bpmn-icon-connection-multi',
        title: 'Conectar elementos: Ligue uma etapa a outra para definir a sequência do fluxo.',
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
        'Início: Define o ponto de entrada da requisição no fluxo.',
      ),
      'create.end-event': createEntry(
        'bpmn:EndEvent',
        'event',
        'bpmn-icon-end-event-none',
        'Fim: Marca o encerramento de um caminho do fluxo.',
      ),

      // Atividades
      'create.user-task': createEntry(
        'bpmn:UserTask',
        'activity',
        'bpmn-icon-user-task',
        'Tarefa humana: Aguarda uma pessoa realizar e concluir uma atividade para continuar o fluxo.',
      ),
      'create.script-task': createEntry(
        'bpmn:ScriptTask', 'activity', 'bpmn-icon-script-task',
        'Tarefa de script: Executa automaticamente a fonte de dados configurada e segue o fluxo.',
      ),
      'create.business-rule-task': createEntry(
        'bpmn:BusinessRuleTask', 'activity', 'bpmn-icon-business-rule-task',
        'Regra de negócio: Aplica uma operação automática, como cancelar ou congelar requisições ou definir o valor de um campo.',
      ),
      'create.service-task': createEntry(
        'bpmn:ServiceTask',
        'activity',
        'bpmn-icon-service-task',
        'Atividade de serviço (fonte de dados): Representa uma integração automática associada a uma fonte de dados.',
      ),
      'create.subprocess': createEntry(
        'bpmn:CallActivity',
        'activity',
        'bpmn-icon-call-activity',
        'Subprocesso: Representa a chamada de outro processo como uma etapa deste fluxo.',
      ),

      // Eventos intermediários
      'create.email-event': createEntry(
        'bpmn:IntermediateThrowEvent',
        'event',
        'bpmn-icon-intermediate-event-throw-message',
        'Evento de e-mail: Envia uma comunicação usando o modelo de e-mail configurado ao chegar a este ponto do fluxo.',
        { eventDefinitionType: 'bpmn:MessageEventDefinition' },
      ),
      'create.timer-event': createEntry(
        'bpmn:IntermediateCatchEvent',
        'event',
        'bpmn-icon-intermediate-event-catch-timer',
        'Evento de timer: Representa uma espera por uma data ou por um período definido.',
        { eventDefinitionType: 'bpmn:TimerEventDefinition' },
      ),
      'create.milestone-event': createEntry(
        'bpmn:IntermediateThrowEvent',
        'event',
        'bpmn-icon-intermediate-event-throw-signal',
        'Evento de marco: Identifica um ponto de acompanhamento do andamento da requisição, com abertura ou fechamento de um marco.',
        { eventDefinitionType: 'bpmn:SignalEventDefinition' },
      ),

      // Gateways
      'create.inclusive-gateway': createEntry(
        'bpmn:InclusiveGateway',
        'gateway',
        'bpmn-icon-gateway-or',
        'Desvio condicional (inclusivo): Segue por um ou mais caminhos cujas condições sejam atendidas.',
      ),
      'create.exclusive-gateway': createEntry(
        'bpmn:ExclusiveGateway',
        'gateway',
        'bpmn-icon-gateway-xor',
        'Desvio condicional exclusivo: Escolhe um único caminho de saída conforme as condições configuradas.',
      ),
      'create.parallel-fork': createEntry(
        'bpmn:ParallelGateway',
        'gateway',
        'bpmn-icon-gateway-parallel',
        'Desvio de paralelismo: Abre todos os caminhos de saída em paralelo, sem avaliar condições.',
      ),
      'create.parallel-join': createEntry(
        'bpmn:ParallelGateway',
        'gateway',
        'bpmn-icon-gateway-parallel',
        'Convergência de paralelismo: Reúne caminhos paralelos e aguarda a conclusão das tarefas desses caminhos antes de continuar.',
      ),

      // Piscina/raias: cria um "pool" expandido. As RAIAS (setores) são adicionadas
      // depois pelo context pad padrão do bpmn-js ao selecionar a piscina
      // ("adicionar raia acima/abaixo" / "dividir em raias"). O campo Setor da tarefa
      // (Fase 5b) lê justamente essas raias (bpmn:Lane) do processo.
      'create.participant-expanded': {
        group: 'collaboration',
        className: 'bpmn-icon-participant',
        title: 'Piscina (raias/setores): Organiza o fluxo em raias para identificar os setores responsáveis pelas atividades.',
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

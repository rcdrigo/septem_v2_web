import { getActionButtons } from './bpmn-action-buttons';
import { getGatewayCondition } from './bpmn-gateway-conditions';
import { getExtensionConfig } from './bpmn-helpers';

export type IssueSeverity = 'error' | 'warning';

export type ValidationIssue = {
  id: string;
  severity: IssueSeverity;
  message: string;
  /** Id do elemento BPMN para clique-pra-selecionar. */
  elementId?: string;
  /** Categoria (para agrupamento futuro). */
  rule: string;
};

/**
 * Roda todas as regras de lint no diagrama corrente e devolve a lista de issues.
 * É chamado de forma reativa pela navbar — não muta o diagrama.
 *
 * As regras são modeladas como funções puras que recebem o modeler e devolvem
 * `ValidationIssue[]`. Adicionar uma regra nova = nova função + linha no array `RULES`.
 */
export function validateProcess(modeler: any): ValidationIssue[] {
  if (!modeler) return [];
  const elements = listElements(modeler);
  return RULES.flatMap((rule) => rule(elements, modeler));
}

type Element = {
  id: string;
  name: string;
  type: string;
  eventDefinitionType?: string;
  incoming: any[];
  outgoing: any[];
  bo: any;
  el: any;
};

function listElements(modeler: any): Element[] {
  const reg: any = modeler.get('elementRegistry');
  const out: Element[] = [];
  reg.forEach((el: any) => {
    const bo = el.businessObject;
    if (!bo?.$type) return;
    out.push({
      id: bo.id,
      name: bo.name ?? '',
      type: bo.$type,
      eventDefinitionType: bo.eventDefinitions?.[0]?.$type,
      incoming: bo.incoming ?? [],
      outgoing: bo.outgoing ?? [],
      bo,
      el,
    });
  });
  return out;
}

// ─── regras ──────────────────────────────────────────────────────────────────

type Rule = (els: Element[], modeler: any) => ValidationIssue[];

const issue = (
  rule: string,
  severity: IssueSeverity,
  message: string,
  elementId?: string,
): ValidationIssue => ({
  id: `${rule}:${elementId ?? '-'}`,
  rule,
  severity,
  message,
  elementId,
});

const ruleHasStart: Rule = (els) => {
  const has = els.some((e) => e.type === 'bpmn:StartEvent');
  return has ? [] : [issue('no-start', 'error', 'O processo precisa de pelo menos um Início.')];
};

const ruleHasEnd: Rule = (els) => {
  const has = els.some((e) => e.type === 'bpmn:EndEvent');
  return has ? [] : [issue('no-end', 'warning', 'O processo não tem um Fim — instâncias podem não encerrar.')];
};

const ruleTaskName: Rule = (els) =>
  els
    .filter((e) => isExecutable(e.type) && !e.name.trim())
    .map((e) => issue('task-name', 'warning', `${labelOf(e)} sem nome.`, e.id));

const ruleOrphan: Rule = (els) =>
  els
    .filter(
      (e) =>
        isShape(e.type) &&
        e.incoming.length === 0 &&
        e.outgoing.length === 0 &&
        e.type !== 'bpmn:Process',
    )
    .map((e) => issue('orphan', 'warning', `${labelOf(e)} desconectado do fluxo.`, e.id));

const ruleStartHasOutgoing: Rule = (els) =>
  els
    .filter((e) => e.type === 'bpmn:StartEvent' && e.outgoing.length === 0)
    .map((e) => issue('start-no-out', 'error', `${labelOf(e)} sem saída — o processo não consegue avançar.`, e.id));

const ruleEndHasIncoming: Rule = (els) =>
  els
    .filter((e) => e.type === 'bpmn:EndEvent' && e.incoming.length === 0)
    .map((e) => issue('end-no-in', 'warning', `${labelOf(e)} sem entrada — não é alcançável.`, e.id));

const ruleGatewayHasMultipleOuts: Rule = (els) =>
  els
    .filter(
      (e) =>
        (e.type === 'bpmn:ExclusiveGateway' || e.type === 'bpmn:InclusiveGateway') &&
        e.outgoing.length < 2,
    )
    .map((e) =>
      issue(
        'gateway-needs-branches',
        'warning',
        `${labelOf(e)} com menos de 2 conexões de saída — não vai bifurcar nada.`,
        e.id,
      ),
    );

const ruleExclusiveHasElse: Rule = (els, _m) =>
  els
    .filter((e) => e.type === 'bpmn:ExclusiveGateway' && e.outgoing.length >= 2)
    .flatMap((e) => {
      const flows = e.outgoing;
      const elses = flows.filter((flow: any) => {
        const cond = getGatewayCondition({ businessObject: flow });
        return cond.mode === 'else';
      });
      if (elses.length === 0) {
        return [
          issue(
            'exclusive-no-else',
            'warning',
            `${labelOf(e)} sem caminho "else" — se nenhuma condição bater o fluxo trava.`,
            e.id,
          ),
        ];
      }
      if (elses.length > 1) {
        return [
          issue(
            'exclusive-multi-else',
            'error',
            `${labelOf(e)} tem ${elses.length} caminhos "else" — só pode haver um.`,
            e.id,
          ),
        ];
      }
      return [];
    });

const ruleUserTaskNeedsActor: Rule = (els, _m) =>
  els
    .filter((e) => e.type === 'bpmn:UserTask')
    .flatMap((e) => {
      const actor = getExtensionConfig(e.el, 'septem:ActorConfig', {
        actorType: 'requester',
        areaId: '',
        positionId: '',
        fieldRef: '',
        dataSourceRef: '',
      });
      if (actor.actorType === 'requester') return [];
      if (actor.actorType === 'areaPosition' && !actor.areaId && !actor.positionId) {
        return [issue('actor-missing', 'warning', `${labelOf(e)}: área/posição não preenchidos.`, e.id)];
      }
      if (actor.actorType === 'formField' && !actor.fieldRef) {
        return [issue('actor-missing', 'warning', `${labelOf(e)}: campo de responsável não selecionado.`, e.id)];
      }
      if (actor.actorType === 'dataSource' && !actor.dataSourceRef) {
        return [issue('actor-missing', 'warning', `${labelOf(e)}: fonte de dados de responsável não selecionada.`, e.id)];
      }
      return [];
    });

const ruleUserTaskHasButtons: Rule = (els) =>
  els
    .filter((e) => e.type === 'bpmn:UserTask' || e.type === 'bpmn:StartEvent')
    .flatMap((e) => {
      const btns = getActionButtons(e.el);
      if (btns.length === 0) return [];
      const noLabel = btns.find((b) => !b.label.trim());
      if (noLabel) return [issue('button-name', 'warning', `${labelOf(e)}: botão sem nome.`, e.id)];
      const dupIds = new Set<string>();
      const dup = btns.find((b) => {
        if (dupIds.has(b.id)) return true;
        dupIds.add(b.id);
        return false;
      });
      if (dup) return [issue('button-id-dup', 'error', `${labelOf(e)}: id "${dup.id}" duplicado entre botões.`, e.id)];
      return [];
    });

const RULES: Rule[] = [
  ruleHasStart,
  ruleHasEnd,
  ruleTaskName,
  ruleOrphan,
  ruleStartHasOutgoing,
  ruleEndHasIncoming,
  ruleGatewayHasMultipleOuts,
  ruleExclusiveHasElse,
  ruleUserTaskNeedsActor,
  ruleUserTaskHasButtons,
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function isShape(type: string): boolean {
  return !type.startsWith('bpmn:SequenceFlow') && !type.endsWith('Process') && !type.endsWith('Definitions');
}

function isExecutable(type: string): boolean {
  return (
    type === 'bpmn:UserTask' ||
    type === 'bpmn:ServiceTask' ||
    type === 'bpmn:CallActivity' ||
    type === 'bpmn:IntermediateThrowEvent' ||
    type === 'bpmn:IntermediateCatchEvent'
  );
}

function labelOf(e: Element): string {
  if (e.name?.trim()) return `"${e.name}"`;
  switch (e.type) {
    case 'bpmn:StartEvent':
      return 'Início';
    case 'bpmn:EndEvent':
      return 'Fim';
    case 'bpmn:UserTask':
      return 'Tarefa humana';
    case 'bpmn:ServiceTask':
      return 'Atividade de serviço';
    case 'bpmn:CallActivity':
      return 'Subprocesso';
    case 'bpmn:InclusiveGateway':
      return 'Desvio condicional (inclusivo)';
    case 'bpmn:ExclusiveGateway':
      return 'Desvio condicional exclusivo';
    case 'bpmn:ParallelGateway':
      return 'Gateway paralelo';
    case 'bpmn:IntermediateThrowEvent':
      return e.eventDefinitionType === 'bpmn:MessageEventDefinition'
        ? 'Evento de e-mail'
        : 'Evento intermediário';
    case 'bpmn:IntermediateCatchEvent':
      return 'Evento de timer';
    default:
      return e.type.replace(/^bpmn:/, '');
  }
}

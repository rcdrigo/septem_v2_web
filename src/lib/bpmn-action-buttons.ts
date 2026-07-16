import { getExtensionCollection, setExtensionCollection, type CollectionSchema } from './bpmn-arrays';

export type ActionButton = {
  id: string;
  label: string;
  primaryColor: string;
  textColor: string;
  validateForm: boolean;
  /** Ao concluir por este botão, exigir uma justificativa (área de texto). */
  requireJustification?: boolean;
  /** Nome do ícone lucide (catálogo curado) exibido à esquerda do rótulo. */
  icon?: string;
  /** Orientações exibidas ao executor (tooltip no hover do botão). */
  hint?: string;
};

const SCHEMA: CollectionSchema = {
  containerType: 'septem:ActionButtons',
  itemsProp: 'buttons',
  itemType: 'septem:ActionButton',
};

const DEFAULTS: ActionButton = {
  id: '',
  label: '',
  primaryColor: '#1e293b',
  textColor: '#ffffff',
  validateForm: true,
};

export function getActionButtons(element: any): ActionButton[] {
  return getExtensionCollection(element, SCHEMA, (raw) => ({
    id: raw.id ?? '',
    label: raw.label ?? '',
    primaryColor: raw.primaryColor ?? DEFAULTS.primaryColor,
    textColor: raw.textColor ?? DEFAULTS.textColor,
    validateForm: raw.validateForm ?? true,
    requireJustification: raw.needsReason ?? undefined,
    icon: raw.icon ?? undefined,
    hint: raw.hint ?? undefined,
  }));
}

export function setActionButtons(modeler: any, element: any, buttons: ActionButton[]) {
  // O atributo no XML/moddle é `needsReason`; o front usa o nome amigável
  // `requireJustification`. Traduz na serialização (o get faz o inverso).
  const forXml = buttons.map(({ requireJustification, ...rest }) => ({
    ...rest,
    ...(requireJustification ? { needsReason: true } : {}),
  }));
  setExtensionCollection(modeler, element, SCHEMA, forXml);
}

/**
 * Varre o processo inteiro e retorna todos os botões de ação cadastrados,
 * agrupados pela tarefa de origem. Usado pelo editor de condições do gateway
 * para a opção "Botão de conclusão clicado".
 */
export function getAllProcessButtons(
  modeler: any,
): { ownerId: string; ownerLabel: string; buttons: ActionButton[] }[] {
  if (!modeler) return [];
  const registry: any = modeler.get('elementRegistry');
  const out: { ownerId: string; ownerLabel: string; buttons: ActionButton[] }[] = [];
  // Labels e conexões do bpmn-js compartilham o MESMO businessObject do elemento
  // dono (o label de uma tarefa aponta pro bo da tarefa). Sem filtrar, cada botão
  // apareceria 2× no seletor. Ignoramos labels/conexões e deduplicamos por bo.id.
  const seen = new Set<string>();
  registry.forEach((el: any) => {
    if (el.labelTarget || el.waypoints) return;
    const bo = el.businessObject;
    if (!bo || seen.has(bo.id)) return;
    const buttons = getActionButtons(el);
    if (buttons.length === 0) return;
    seen.add(bo.id);
    out.push({
      ownerId: bo.id,
      ownerLabel: bo.name || bo.id,
      buttons,
    });
  });
  return out;
}

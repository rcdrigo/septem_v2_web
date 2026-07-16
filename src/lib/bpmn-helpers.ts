/**
 * Helpers para ler/escrever propriedades de elementos BPMN
 * através do modeler do bpmn-js, com suporte ao moddle extension `septem:`.
 *
 * Convenções:
 *  - Nome → atributo `name` nativo do BPMN.
 *  - Descrição → primeiro `bpmn:Documentation` do elemento.
 *  - Apelido / Rotinas / configs específicas → filhos de `bpmn:ExtensionElements`.
 *
 * As funções `get*` retornam valores defaultados (string vazia ou objeto com defaults)
 * para que componentes React possam usar como `value` controlado direto.
 */

type AnyModeler = any;
type AnyElement = any;
type Primitive = string | number | boolean | undefined;
export type ConfigShape = Record<string, Primitive>;

// ─── propriedades nativas ────────────────────────────────────────────────────

export function getName(element: AnyElement): string {
  return element?.businessObject?.name ?? '';
}

export function setName(modeler: AnyModeler, element: AnyElement, name: string) {
  modeler.get('modeling').updateProperties(element, { name: name || undefined });
}

export function getDocumentation(element: AnyElement): string {
  const docs = element?.businessObject?.documentation;
  if (!docs || docs.length === 0) return '';
  return docs[0].text ?? '';
}

export function setDocumentation(modeler: AnyModeler, element: AnyElement, text: string) {
  const bpmnFactory = modeler.get('bpmnFactory');
  const modeling = modeler.get('modeling');

  if (!text) {
    modeling.updateProperties(element, { documentation: [] });
    return;
  }
  const doc = bpmnFactory.create('bpmn:Documentation', { text });
  modeling.updateProperties(element, { documentation: [doc] });
}

// ─── infra de extensionElements ──────────────────────────────────────────────

function ensureExtensionElements(modeler: AnyModeler, element: AnyElement) {
  const moddle = modeler.get('moddle');
  const modeling = modeler.get('modeling');
  const bo = element.businessObject;
  let ext = bo.extensionElements;
  if (!ext) {
    ext = moddle.create('bpmn:ExtensionElements', { values: [] });
    ext.$parent = bo;
    modeling.updateProperties(element, { extensionElements: ext });
  }
  if (!Array.isArray(ext.values)) ext.values = [];
  return ext;
}

function findExtensionNode<T = any>(element: AnyElement, type: string): T | undefined {
  const ext = element?.businessObject?.extensionElements;
  if (!ext?.values) return undefined;
  return ext.values.find((v: any) => v.$type === type) as T | undefined;
}

/**
 * Lê uma extensão moddle do tipo `type` como objeto plain, mesclando com `defaults`
 * para os campos não presentes. Sempre retorna um objeto — nunca null —
 * adequado para uso direto em estado React.
 */
export function getExtensionConfig<T extends ConfigShape>(
  element: AnyElement,
  type: string,
  defaults: T,
): T {
  const node = findExtensionNode<Record<string, Primitive>>(element, type);
  if (!node) return { ...defaults };
  const out: ConfigShape = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const val = node[key];
    if (val !== undefined && val !== null) out[key] = val;
  }
  return out as T;
}

/**
 * Aplica um patch numa extensão moddle. Cria a extensão se faltar.
 * Se a extensão ficar "vazia" (todos os campos falsy) após o patch, remove-a
 * para manter o XML enxuto.
 */
export function setExtensionConfig<T extends ConfigShape>(
  modeler: AnyModeler,
  element: AnyElement,
  type: string,
  patch: Partial<T>,
) {
  const moddle = modeler.get('moddle');
  const modeling = modeler.get('modeling');
  const ext = ensureExtensionElements(modeler, element);

  let node = ext.values.find((v: any) => v.$type === type);
  if (!node) {
    node = moddle.create(type, {});
    node.$parent = ext;
    ext.values.push(node);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === '' || v === null) {
      delete node[k];
    } else {
      node[k] = v;
    }
  }

  const isEmpty = Object.keys(node).every(
    (k) => k.startsWith('$') || node[k] === undefined || node[k] === '' || node[k] === null,
  );
  if (isEmpty) ext.values = ext.values.filter((v: any) => v !== node);

  modeling.updateProperties(element, { extensionElements: ext });
}

export function removeExtension(modeler: AnyModeler, element: AnyElement, type: string) {
  const modeling = modeler.get('modeling');
  const ext = element?.businessObject?.extensionElements;
  if (!ext?.values) return;
  ext.values = ext.values.filter((v: any) => v.$type !== type);
  modeling.updateProperties(element, { extensionElements: ext });
}

// ─── açúcar tipado para Alias e Routines (legados, ainda em uso) ─────────────

const ALIAS_DEFAULTS = { value: '' };
export function getAlias(element: AnyElement): string {
  return getExtensionConfig(element, 'septem:Alias', ALIAS_DEFAULTS).value;
}
export function setAlias(modeler: AnyModeler, element: AnyElement, value: string) {
  setExtensionConfig(modeler, element, 'septem:Alias', { value });
}

/** Setor (raia) da tarefa — escolhido entre as raias do processo (Fase 5b). */
const SETOR_DEFAULTS = { value: '' };
export function getSetor(element: AnyElement): string {
  return getExtensionConfig(element, 'septem:Setor', SETOR_DEFAULTS).value;
}
export function setSetor(modeler: AnyModeler, element: AnyElement, value: string) {
  setExtensionConfig(modeler, element, 'septem:Setor', { value });
}

/** Nomes das raias (lanes) presentes no processo, para o dropdown de setor. */
export function getProcessLanes(modeler: AnyModeler): string[] {
  if (!modeler) return [];
  try {
    const registry: any = modeler.get('elementRegistry');
    const names = new Set<string>();
    registry.forEach((el: any) => {
      if (el?.businessObject?.$type === 'bpmn:Lane') {
        const n = (el.businessObject.name ?? '').trim();
        if (n) names.add(n);
      }
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  } catch {
    return [];
  }
}

export type Routines = {
  preCreate: string;
  postCreate: string;
  preFinish: string;
  postFinish: string;
};
const ROUTINES_DEFAULTS: Routines = { preCreate: '', postCreate: '', preFinish: '', postFinish: '' };
export function getRoutines(element: AnyElement): Routines {
  return getExtensionConfig(element, 'septem:Routines', ROUTINES_DEFAULTS);
}
export function setRoutines(modeler: AnyModeler, element: AnyElement, patch: Partial<Routines>) {
  setExtensionConfig(modeler, element, 'septem:Routines', patch);
}

// ─── conexões de gateway ─────────────────────────────────────────────────────

export type ConnectionRef = {
  id: string;
  name: string;
  /** id do elemento na ponta oposta (`source` ou `target`) */
  otherId: string;
  /** label amigável do elemento na ponta oposta */
  otherLabel: string;
};

export function getOutgoingConnections(element: AnyElement): ConnectionRef[] {
  const outs = element?.businessObject?.outgoing ?? [];
  return outs.map((flow: any) => connectionToRef(flow, 'targetRef'));
}

export function getIncomingConnections(element: AnyElement): ConnectionRef[] {
  const ins = element?.businessObject?.incoming ?? [];
  return ins.map((flow: any) => connectionToRef(flow, 'sourceRef'));
}

function connectionToRef(flow: any, endProp: 'sourceRef' | 'targetRef'): ConnectionRef {
  const other = flow[endProp];
  return {
    id: flow.id,
    name: flow.name ?? '',
    otherId: other?.id ?? '',
    otherLabel: other?.name || other?.id || '(sem nome)',
  };
}

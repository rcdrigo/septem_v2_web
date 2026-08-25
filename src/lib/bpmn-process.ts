/**
 * Helpers para acessar o elemento `bpmn:Process` raiz do diagrama atual e
 * sua configuração `septem:ProcessConfig`.
 *
 * O Process é onde guardamos metadados de processo (descrição, status, flags)
 * e também o schema do formulário associado (`septem:FormSchema` body text com JSON).
 * Modelar isso dentro do BPMN garante round-trip via export/import.
 */

import { getExtensionConfig, setExtensionConfig } from './bpmn-helpers';

type AnyModeler = any;

export type ProcessStatus = 'draft' | 'published' | 'inactive';

export type ProcessConfig = {
  description: string;
  documentationUrl: string;
  icon: string;
  inbox: string;
  categoryId: string;
  areaId: string;
  status: ProcessStatus;
  allowMessages: boolean;
  allowCancel: boolean;
  allowAnonymous: boolean;
  /**
   * Aparece na Central de serviços pública EXIGINDO login (Fase 8).
   *
   * É uma marcação PRÓPRIA, e não uma regra de acesso, de propósito: a regra `all`
   * ("Todos os usuários") casa com usuário nulo no `FlowAccessService`, então usá-la
   * como critério de vitrine pública exporia qualquer processo com essa regra.
   * Superfície pública se declara, não se infere.
   */
  allowExternal: boolean;
  /** Regras de controle de acesso, serializadas como JSON array. */
  accessRules: string;
};

export const PROCESS_CONFIG_DEFAULTS: ProcessConfig = {
  description: '',
  documentationUrl: '',
  icon: '',
  inbox: '',
  categoryId: '',
  areaId: '',
  status: 'draft',
  allowMessages: true,
  allowCancel: true,
  allowAnonymous: false,
  allowExternal: false,
  accessRules: '',
};

/** Retorna o shape do `bpmn:Process` (raiz do canvas). */
export function getProcessShape(modeler: AnyModeler): any | null {
  if (!modeler) return null;
  try {
    const root = modeler.get('canvas').getRootElement();
    return root ?? null;
  } catch {
    return null;
  }
}

export function getProcessName(modeler: AnyModeler): string {
  const proc = getProcessShape(modeler);
  return proc?.businessObject?.name ?? '';
}

export function setProcessName(modeler: AnyModeler, name: string) {
  const proc = getProcessShape(modeler);
  if (!proc) return;
  modeler.get('modeling').updateProperties(proc, { name: name || undefined });
}

export function getProcessConfig(modeler: AnyModeler): ProcessConfig {
  const proc = getProcessShape(modeler);
  if (!proc) return { ...PROCESS_CONFIG_DEFAULTS };
  return getExtensionConfig(proc, 'septem:ProcessConfig', PROCESS_CONFIG_DEFAULTS);
}

export function setProcessConfig(modeler: AnyModeler, patch: Partial<ProcessConfig>) {
  const proc = getProcessShape(modeler);
  if (!proc) return;
  setExtensionConfig(modeler, proc, 'septem:ProcessConfig', patch);
}

// ─── Form schema embutido no BPMN ─────────────────────────────────────────────

/** Lê o schema do formulário (JSON serializado) guardado em `septem:FormSchema`. */
export function getEmbeddedFormSchema(modeler: AnyModeler): unknown | null {
  const proc = getProcessShape(modeler);
  // `businessObject` pode faltar enquanto o diagrama ainda não importou (ou se o XML
  // veio sem DI) — sem esta guarda a página quebrava com
  // "Cannot read properties of undefined (reading 'extensionElements')".
  if (!proc?.businessObject) return null;
  const ext = proc.businessObject.extensionElements;
  if (!ext?.values) return null;
  const node = ext.values.find((v: any) => v.$type === 'septem:FormSchema');
  if (!node?.json) return null;
  try {
    return JSON.parse(node.json);
  } catch {
    return null;
  }
}

export function setEmbeddedFormSchema(modeler: AnyModeler, schema: unknown) {
  const proc = getProcessShape(modeler);
  if (!proc) return;
  const moddle = modeler.get('moddle');
  const modeling = modeler.get('modeling');
  const bo = proc.businessObject;

  let ext = bo.extensionElements;
  if (!ext) {
    ext = moddle.create('bpmn:ExtensionElements', { values: [] });
    ext.$parent = bo;
    modeling.updateProperties(proc, { extensionElements: ext });
  }
  if (!Array.isArray(ext.values)) ext.values = [];

  let node = ext.values.find((v: any) => v.$type === 'septem:FormSchema');
  if (!node) {
    node = moddle.create('septem:FormSchema', { json: '' });
    node.$parent = ext;
    ext.values.push(node);
  }
  node.json = JSON.stringify(schema);

  modeling.updateProperties(proc, { extensionElements: ext });
}

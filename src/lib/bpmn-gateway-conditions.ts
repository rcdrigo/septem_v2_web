import { getExtensionConfig, setExtensionConfig } from './bpmn-helpers';
import { getExtensionCollection, setExtensionCollection, type CollectionSchema } from './bpmn-arrays';

export type GatewayConditionMode = 'button' | 'formValues' | 'else';

export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith';

export const OPERATOR_OPTIONS: ReadonlyArray<{ value: ComparisonOperator; label: string }> = [
  { value: 'eq', label: 'igual a' },
  { value: 'neq', label: 'diferente de' },
  { value: 'gt', label: 'maior que' },
  { value: 'lt', label: 'menor que' },
  { value: 'gte', label: 'maior ou igual a' },
  { value: 'lte', label: 'menor ou igual a' },
  { value: 'contains', label: 'contém' },
  { value: 'startsWith', label: 'começa com' },
];

/** Conector lógico de uma regra em relação à anterior. */
export type RuleConnector = 'and' | 'or';

export type FormRule = {
  fieldRef: string;
  operator: ComparisonOperator;
  value: string;
  /** Como esta regra se liga à anterior (ignorado na 1ª regra). */
  connector?: RuleConnector;
  /** Abre um grupo `(` antes desta regra. */
  open?: boolean;
  /** Fecha um grupo `)` depois desta regra. */
  close?: boolean;
};

const RULES_SCHEMA: CollectionSchema = {
  containerType: 'septem:GatewayCondition',
  itemsProp: 'rules',
  itemType: 'septem:FormRule',
};

export type RuleLogic = 'all' | 'any';
const MODE_DEFAULTS = { mode: 'formValues' as GatewayConditionMode, buttonId: '', logic: 'all' as RuleLogic };

export function getGatewayCondition(connection: any): {
  mode: GatewayConditionMode;
  buttonId: string;
  logic: RuleLogic;
  rules: FormRule[];
} {
  const meta = getExtensionConfig(connection, 'septem:GatewayCondition', MODE_DEFAULTS);
  const rules = getExtensionCollection(connection, RULES_SCHEMA, (raw) => ({
    fieldRef: raw.fieldRef ?? '',
    operator: (raw.operator as ComparisonOperator) ?? 'eq',
    value: raw.value ?? '',
    connector: raw.connector === 'or' ? ('or' as const) : raw.connector === 'and' ? ('and' as const) : undefined,
    open: raw.open === true || raw.open === 'true',
    close: raw.close === true || raw.close === 'true',
  }));
  return { mode: meta.mode, buttonId: meta.buttonId, logic: meta.logic === 'any' ? 'any' : 'all', rules };
}

export function setGatewayLogic(modeler: any, connection: any, logic: RuleLogic) {
  setExtensionConfig(modeler, connection, 'septem:GatewayCondition', { mode: 'formValues', logic });
}

export function setGatewayConditionMode(modeler: any, connection: any, mode: GatewayConditionMode) {
  // IMPORTANTE: limpar a coleção de regras com [] REMOVE o nó GatewayCondition inteiro
  // (setExtensionCollection apaga o container quando fica vazio). Por isso limpamos as
  // regras PRIMEIRO e gravamos o `mode` por ÚLTIMO — senão o modo recém-escrito é perdido
  // e a releitura cai no default "formValues".
  if (mode !== 'formValues') setExtensionCollection(modeler, connection, RULES_SCHEMA, []);
  setExtensionConfig(modeler, connection, 'septem:GatewayCondition', {
    mode,
    ...(mode !== 'button' ? { buttonId: '' } : {}),
  });
}

export function setGatewayButton(modeler: any, connection: any, buttonId: string) {
  setExtensionConfig(modeler, connection, 'septem:GatewayCondition', { buttonId, mode: 'button' });
}

export function setGatewayRules(modeler: any, connection: any, rules: FormRule[]) {
  // garante o container e o atributo mode
  setExtensionConfig(modeler, connection, 'septem:GatewayCondition', { mode: 'formValues' });
  // Normaliza: só persiste conector/parênteses quando definidos, mantendo o XML enxuto
  // (setExtensionCollection já descarta undefined/''/null, mas `false` seria escrito).
  const serializable = rules.map((r, idx) => ({
    fieldRef: r.fieldRef,
    operator: r.operator,
    value: r.value,
    ...(idx > 0 && r.connector ? { connector: r.connector } : {}),
    ...(r.open ? { open: true } : {}),
    ...(r.close ? { close: true } : {}),
  }));
  setExtensionCollection(modeler, connection, RULES_SCHEMA, serializable);
}

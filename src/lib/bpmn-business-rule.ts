import type { FormFieldDescriptor } from '@/stores/form';

export const BUSINESS_RULE_OPERATIONS = [
  { value: 'cancel', label: 'Cancelar processo' },
  { value: 'freeze', label: 'Congelar processo' },
  { value: 'unfreeze', label: 'Descongelar processo' },
  { value: 'setStatus', label: 'Modificar o status de um processo finalizado' },
  { value: 'setField', label: 'Modificar valor de campo do formulário' },
] as const;

export type BusinessRuleOperation = typeof BUSINESS_RULE_OPERATIONS[number]['value'];

// The XML extension is a boundary representation; validation narrows its variants.
export const BUSINESS_RULE_DEFAULTS = {
  operation: '',
  target: 'current',
  instanceFieldRef: '',
  dataSourceRef: '',
  statusText: '',
  fieldRef: '',
  valueJson: '',
};

export type BusinessRuleConfig = typeof BUSINESS_RULE_DEFAULTS;

export function businessRuleFieldReference(field: FormFieldDescriptor): string {
  return field.fieldId ? `field:${field.fieldId}` : field.id;
}

export function resolveBusinessRuleField(fields: FormFieldDescriptor[], reference: string): FormFieldDescriptor | undefined {
  if (reference.startsWith('field:')) return fields.find((field) => field.fieldId === reference.slice('field:'.length));
  return fields.find((field) => field.id === reference || field.path === reference)
    ?? fields.find((field) => field.fieldId === reference);
}

export function businessRuleFieldOptions(fields: FormFieldDescriptor[]) {
  return fields.filter((field) => !field.tableKey).map((field) => ({
    value: businessRuleFieldReference(field),
    label: `${field.tabLabel || 'Aba'} › ${field.group || 'Agrupamento'} › ${field.label || field.id} (${field.path || field.id})`,
  }));
}

export function isBusinessRuleOperation(value: string): value is BusinessRuleOperation {
  return BUSINESS_RULE_OPERATIONS.some((operation) => operation.value === value);
}

export function businessRuleErrors(config: BusinessRuleConfig): string[] {
  if (!isBusinessRuleOperation(config.operation)) return ['Selecione o tipo de operação.'];
  const errors: string[] = [];
  if (config.operation === 'setField') {
    if (config.target !== 'current') errors.push('A alteração de campo deve afetar somente a própria requisição.');
    if (!config.fieldRef.trim()) errors.push('Selecione o campo que receberá o valor fixo.');
    try {
      if (!config.valueJson.trim()) throw new Error('missing');
      JSON.parse(config.valueJson);
    } catch {
      errors.push('Informe um valor fixo válido para o campo.');
    }
  } else {
    if (!['current', 'field', 'dataSource'].includes(config.target)) errors.push('Selecione a origem dos números das requisições.');
    if (config.operation === 'setStatus' && config.target === 'current') errors.push('Selecione outras requisições já encerradas para alterar o status.');
    if (config.target === 'field' && !config.instanceFieldRef.trim()) errors.push('Selecione o campo com os números das requisições.');
    if (config.target === 'dataSource' && !config.dataSourceRef.trim()) errors.push('Selecione a fonte de dados com os números das requisições.');
    if (config.operation === 'setStatus' && !config.statusText.trim()) errors.push('Informe o texto do novo status.');
  }
  return errors;
}

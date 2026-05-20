/**
 * Gerador determinístico de ids curtos para itens client-side (botões, alertas, regras).
 * Não usado para IDs do BPMN (esses ficam com o bpmn-js).
 */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

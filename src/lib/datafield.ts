/**
 * Campo de data (Fase 4b): subtipo (data / hora / ambos) e regras de passado/futuro.
 * A regra é AUTORITATIVA no servidor (compara com a data do servidor); aqui é a UX
 * — o subtipo escolhe o input nativo (que já abre o datepicker ao clicar) e um
 * hint imediato de passado/futuro usando o relógio do navegador.
 */
export type DateMode = 'datetime' | 'date' | 'time';
export type DateLimit = '' | 'noPast' | 'noFuture';

export const DATE_MODE_OPTIONS = [
  { value: 'datetime', label: 'Data e hora' },
  { value: 'date', label: 'Somente data' },
  { value: 'time', label: 'Somente hora' },
];

export const DATE_LIMIT_OPTIONS = [
  { value: '', label: 'Sem restrição' },
  { value: 'noPast', label: 'Não permitir data no passado' },
  { value: 'noFuture', label: 'Não permitir data no futuro' },
];

/** Tipo do input nativo — cada um abre o seletor certo ao clicar. */
export function inputTypeForDateMode(mode: DateMode | undefined): string {
  return mode === 'date' ? 'date' : mode === 'time' ? 'time' : 'datetime-local';
}

/**
 * Hint de validação no cliente (o servidor é quem decide). Devolve a mensagem de
 * erro ou null. `now` default é o relógio do navegador; passado/futuro não se
 * aplica a "somente hora".
 */
export function validateDateClient(value: string, mode: DateMode | undefined, limit: DateLimit | undefined, now: Date = new Date()): string | null {
  if (!value) return null;
  if (mode === 'time') return null; // passado/futuro não faz sentido só com hora

  const parsed = mode === 'date' ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data inválida.';
  if (!limit) return null;

  if (mode === 'date') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (limit === 'noPast' && parsed < today) return 'A data não pode ser no passado.';
    if (limit === 'noFuture' && parsed > today) return 'A data não pode ser no futuro.';
    return null;
  }
  if (limit === 'noPast' && parsed < now) return 'A data não pode ser no passado.';
  if (limit === 'noFuture' && parsed > now) return 'A data não pode ser no futuro.';
  return null;
}

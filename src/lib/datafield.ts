/**
 * Campo de data (Fase 4b): subtipo (data / hora / ambos) e regras de passado/futuro.
 * A regra é AUTORITATIVA no servidor (compara com a data do servidor); aqui é a UX
 * — o subtipo escolhe o input nativo (que já abre o datepicker ao clicar) e um
 * hint imediato de passado/futuro usando o relógio do navegador.
 */
export type DateMode = 'datetime' | 'date' | 'time';
export type DateLimit = '' | 'noPast' | 'noFuture';

/**
 * Normaliza o subtipo vindo do form-js e mantém schemas legados seguros.
 * O editor usa `subtype`; versões anteriores do cockpit gravavam apenas
 * `properties.septemDateMode`.
 */
export function normalizeDateMode(mode: unknown): DateMode {
  return mode === 'date' || mode === 'time' || mode === 'datetime' ? mode : 'datetime';
}

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

/**
 * Modo efetivo do componente. O editor grava `subtype` (propriedade do próprio
 * form-js); versões anteriores gravavam só `properties.septemDateMode`. Fonte
 * ÚNICA da regra — usada no canvas do modelador e no preenchimento, para os dois
 * nunca divergirem.
 */
export function dateModeOfComponent(
  component: { subtype?: string; properties?: Record<string, string | undefined> } | null | undefined,
): DateMode {
  return normalizeDateMode(component?.properties?.septemDateMode ?? component?.subtype);
}

/**
 * Nome visível do campo de data. O form-js NÃO usa `label` no datetime: guarda o
 * nome em `dateLabel`/`timeLabel`. Schemas antigos só têm esses dois.
 */
export function dateFieldLabel(
  field: { label?: string; dateLabel?: string; timeLabel?: string } | null | undefined,
): string {
  return field?.label ?? field?.dateLabel ?? field?.timeLabel ?? '';
}

/** Formato exibido por modo — o MESMO no canvas do modelador e no preenchimento. */
export const DATE_PLACEHOLDER: Record<DateMode, string> = {
  datetime: 'DD/MM/YYYY HH:mm',
  date: 'DD/MM/YYYY',
  time: 'HH:mm',
};

/** Efeito da restrição em uma linha — o modelador vê no canvas o que configurou. */
export const DATE_LIMIT_HINT: Record<Exclude<DateLimit, ''>, string> = {
  noPast: 'Não permite data no passado.',
  noFuture: 'Não permite data no futuro.',
};

/** Tipo equivalente do campo, mantido para consumidores legados. */
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
  if (mode === 'time') {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return 'Hora inválida.';
    return null; // passado/futuro não faz sentido só com hora
  }

  const match = mode === 'date'
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    : /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 'Data inválida.';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = mode === 'date' ? 0 : Number(match[4]);
  const minute = mode === 'date' ? 0 : Number(match[5]);
  const parsed = new Date(0);
  parsed.setHours(0, 0, 0, 0);
  parsed.setFullYear(year, month - 1, day);
  parsed.setHours(hour, minute, 0, 0);
  if (
    year < 1000 || month < 1 || month > 12 || day < 1 ||
    hour > 23 || minute > 59 || parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 || parsed.getDate() !== day
  ) return 'Data inválida.';
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

import type { BusinessHoursPeriod, BusinessHoursWeek } from '../../lib/business-calendar';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 7, label: 'Domingo', short: 'Dom' },
];

function minutes(value: string, allowEndOfDay: boolean): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour === 24 && minute === 0 && allowEndOfDay) return 24 * 60;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function validateDayPeriods(periods: BusinessHoursPeriod[]): string[] {
  const errors: string[] = [];
  const ranges: { start: number; end: number; index: number }[] = [];

  periods.forEach((period, index) => {
    const start = minutes(period.start, false);
    const end = minutes(period.end, true);
    if (start === null || end === null) {
      errors.push(`Período ${index + 1}: informe horários válidos em HH:mm.`);
    } else if (end <= start) {
      errors.push(`Período ${index + 1}: o fim deve ser depois do início, no mesmo dia.`);
    } else {
      ranges.push({ start, end, index });
    }
  });

  ranges.sort((a, b) => a.start - b.start);
  for (let index = 0; index < ranges.length; index += 1) {
    for (let next = index + 1; next < ranges.length && ranges[next].start < ranges[index].end; next += 1) {
      errors.push(`Períodos ${ranges[index].index + 1} e ${ranges[next].index + 1}: os horários se sobrepõem.`);
    }
  }
  return errors;
}

export function validateBusinessHours(value: BusinessHoursWeek): string[] {
  const errors = WEEKDAYS.flatMap((day) =>
    validateDayPeriods(value[day.value] ?? []).map((error) => `${day.label}: ${error}`),
  );
  if (WEEKDAYS.every((day) => (value[day.value] ?? []).length === 0)) {
    errors.push('Defina ao menos um período útil na semana.');
  }
  return errors;
}

export function normalizeTimeInput(value: string): string {
  const text = value.trim();
  if (/^\d{1,2}$/.test(text)) return `${text.padStart(2, '0')}:00`;
  if (/^\d{3}$/.test(text)) return `0${text[0]}:${text.slice(1)}`;
  if (/^\d{4}$/.test(text)) return `${text.slice(0, 2)}:${text.slice(2)}`;
  const separated = /^(\d{1,2}):(\d{1,2})$/.exec(text);
  if (separated) return `${separated[1].padStart(2, '0')}:${separated[2].padStart(2, '0')}`;
  return text;
}

export function nextPeriod(periods: BusinessHoursPeriod[]): BusinessHoursPeriod {
  if (periods.length === 0) return { start: '08:00', end: '12:00' };
  const latestEnd = Math.max(...periods.map((period) => minutes(period.end, true) ?? 0));
  const start = latestEnd + 60;
  if (start >= 24 * 60) return { start: '', end: '' };
  const end = Math.min(start + 4 * 60, 24 * 60);
  const format = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  return { start: format(start), end: format(end) };
}

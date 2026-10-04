export type BusinessHoursPeriod = { start: string; end: string };
export type BusinessHoursWeek = Record<1 | 2 | 3 | 4 | 5 | 6 | 7, BusinessHoursPeriod[]>;

export type CalendarLocation = {
  stateCode?: string | null;
  cityCode?: string | null;
  cityName?: string | null;
  timeZoneId?: string | null;
};

/** Keep the stored legacy schedule intact until the user saves the new editor. */
export function businessHoursFromSettings(settings: {
  businessHours?: BusinessHoursWeek | null;
  businessHourStart?: number;
  businessHourEnd?: number;
  businessDays?: string;
}): BusinessHoursWeek {
  if (settings.businessHours) return settings.businessHours;
  const days = (settings.businessDays ?? '1,2,3,4,5').split(',').map(Number);
  const time = (hour: number) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`;
  return Object.fromEntries(Array.from({ length: 7 }, (_, index) => [index + 1,
    days.includes(index + 1) ? [{ start: time(settings.businessHourStart ?? 8), end: time(settings.businessHourEnd ?? 18) }] : [],
  ])) as BusinessHoursWeek;
}

export function validateCalendarLocation(location: CalendarLocation): string | null {
  if (!location.stateCode || !location.cityCode || !location.cityName) return 'Selecione o estado e o município deste ambiente.';
  if (!location.timeZoneId) return 'Confira o fuso horário deste ambiente.';
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: location.timeZoneId }); }
  catch { return 'Selecione um fuso horário válido.'; }
  return null;
}

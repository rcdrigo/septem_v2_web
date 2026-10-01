import { useId, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { BusinessHoursPeriod, BusinessHoursWeek } from '../../lib/business-calendar';
import { nextPeriod, normalizeTimeInput, validateBusinessHours, validateDayPeriods, WEEKDAYS, type Weekday } from './business-hours';

export type { BusinessHoursPeriod, BusinessHoursWeek } from '../../lib/business-calendar';

type Props = {
  value: BusinessHoursWeek;
  onChange: (value: BusinessHoursWeek) => void;
  disabled?: boolean;
  id?: string;
};

type PeriodListProps = {
  periods: BusinessHoursPeriod[];
  onChange: (periods: BusinessHoursPeriod[]) => void;
  disabled: boolean;
  label: string;
  id: string;
};

const inputClass = 'h-9 min-w-0 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm tabular-nums text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-rose-500 aria-[invalid=true]:focus:ring-rose-100';
const quietButtonClass = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function PeriodList({ periods, onChange, disabled, label, id }: PeriodListProps) {
  const errors = validateDayPeriods(periods);
  const update = (index: number, field: 'start' | 'end', text: string) => {
    onChange(periods.map((period, periodIndex) => periodIndex === index ? { ...period, [field]: text } : period));
  };

  return (
    <div className="space-y-2">
      {periods.length === 0 && <p className="text-sm text-slate-500">Sem horas úteis</p>}
      {periods.map((period, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:max-w-xs">
            <label className="min-w-0" htmlFor={`${id}-${index}-start`}>
              {index === 0 && <span className="mb-1 block text-xs font-medium text-slate-600">Início</span>}
              <input
                id={`${id}-${index}-start`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={5}
                placeholder="08:00"
                value={period.start}
                onChange={(event) => update(index, 'start', event.target.value)}
                onBlur={() => {
                  const normalized = normalizeTimeInput(period.start);
                  if (normalized !== period.start) update(index, 'start', normalized);
                }}
                disabled={disabled}
                aria-label={`${label}, período ${index + 1}, início`}
                aria-invalid={errors.length > 0}
                className={inputClass}
              />
            </label>
            <span className="pb-2 text-sm text-slate-400" aria-hidden="true">até</span>
            <label className="min-w-0" htmlFor={`${id}-${index}-end`}>
              {index === 0 && <span className="mb-1 block text-xs font-medium text-slate-600">Fim</span>}
              <input
                id={`${id}-${index}-end`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={5}
                placeholder="12:00"
                value={period.end}
                onChange={(event) => update(index, 'end', event.target.value)}
                onBlur={() => {
                  const normalized = normalizeTimeInput(period.end);
                  if (normalized !== period.end) update(index, 'end', normalized);
                }}
                disabled={disabled}
                aria-label={`${label}, período ${index + 1}, fim`}
                aria-invalid={errors.length > 0}
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="button"
            className={`${quietButtonClass} h-9 w-9 shrink-0 px-0`}
            onClick={() => onChange(periods.filter((_, periodIndex) => periodIndex !== index))}
            disabled={disabled}
            aria-label={`Remover período ${index + 1} de ${label}`}
            title="Remover período"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
      {errors.length > 0 && (
        <ul className="space-y-0.5 text-xs text-rose-700" role="alert">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onChange([...periods, nextPeriod(periods)])}
        disabled={disabled}
      >
        <Plus size={16} aria-hidden="true" /> Adicionar período
      </button>
    </div>
  );
}

export function BusinessHoursEditor({ value, onChange, disabled = false, id }: Props) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const [selected, setSelected] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [draft, setDraft] = useState<BusinessHoursPeriod[]>(() =>
    (value[1] ?? []).map((period) => ({ ...period })),
  );
  const [expandedDay, setExpandedDay] = useState<Weekday | null>(null);
  const draftErrors = validateDayPeriods(draft);

  const toggleSelected = (day: Weekday) => {
    setSelected((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());
  };
  const apply = () => {
    if (disabled || selected.length === 0 || draftErrors.length > 0) return;
    const next = { ...value };
    selected.forEach((day) => {
      next[day] = draft.map((period) => ({ ...period }));
    });
    onChange(next);
  };
  const updateDay = (day: Weekday, periods: BusinessHoursPeriod[]) => {
    onChange({ ...value, [day]: periods });
  };

  return (
    <section aria-label="Horários úteis por dia da semana" data-testid="business-hours-editor" className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Horários úteis</h3>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">Configure períodos separados por intervalo. Os horários seguem o fuso do cliente.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Aplicar a vários dias</h4>
            <p className="mt-0.5 text-xs text-slate-600">Escolha os dias e ajuste os períodos antes de aplicar.</p>
          </div>
          <button
            type="button"
            className={quietButtonClass}
            onClick={() => setSelected([1, 2, 3, 4, 5])}
            disabled={disabled}
            data-testid="business-hours-weekdays-shortcut"
          >
            <Check size={14} aria-hidden="true" /> Seg–sex
          </button>
        </div>

        <div role="group" aria-label="Dias para aplicar os períodos" className="mt-3 flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => {
            const active = selected.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={active}
                aria-label={day.label}
                onClick={() => toggleSelected(day.value)}
                disabled={disabled}
                data-testid={`business-hours-select-${day.value}`}
                className={`min-h-9 rounded-md border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
              >
                {day.short}
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-700">Períodos para aplicar</p>
          <PeriodList periods={draft} onChange={setDraft} disabled={disabled} label="Modelo" id={`${baseId}-bulk`} />
          <button
            type="button"
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={apply}
            disabled={disabled || selected.length === 0 || draftErrors.length > 0}
            data-testid="business-hours-apply"
          >
            <Check size={16} aria-hidden="true" />
            {draft.length === 0
              ? `Deixar ${selected.length} ${selected.length === 1 ? 'dia' : 'dias'} sem horas úteis`
              : `Aplicar a ${selected.length} ${selected.length === 1 ? 'dia' : 'dias'}`}
          </button>
          {selected.length === 0 && <p className="mt-1.5 text-xs text-slate-600">Selecione ao menos um dia para aplicar.</p>}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Editar por dia</h4>
        {validateBusinessHours(value).includes('Defina ao menos um período útil na semana.') && (
          <p className="mb-2 text-xs text-rose-700" role="alert">Defina ao menos um período útil na semana.</p>
        )}
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {WEEKDAYS.map((day) => {
            const periods = value[day.value] ?? [];
            const expanded = expandedDay === day.value;
            const errors = validateDayPeriods(periods);
            return (
              <div key={day.value} className="px-3 py-2.5 sm:px-4">
                <button
                  type="button"
                  className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                  aria-expanded={expanded}
                  aria-controls={`${baseId}-day-${day.value}`}
                  onClick={() => setExpandedDay(expanded ? null : day.value)}
                  data-testid={`business-hours-day-${day.value}`}
                >
                  <span className="min-w-0 sm:flex sm:items-center sm:gap-3">
                    <span className="block min-w-24 text-sm font-medium text-slate-800">{day.label}</span>
                    <span className={`block text-xs tabular-nums ${errors.length > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                      {errors.length > 0 ? 'Corrija os períodos' : periods.length === 0 ? 'Sem horas úteis' : periods.map((period) => `${period.start}–${period.end}`).join(' · ')}
                    </span>
                  </span>
                  {expanded ? <ChevronUp size={16} className="shrink-0 text-slate-500" aria-hidden="true" /> : <ChevronDown size={16} className="shrink-0 text-slate-500" aria-hidden="true" />}
                </button>
                {expanded && (
                  <div id={`${baseId}-day-${day.value}`} className="pb-1 pt-2 sm:pl-[108px]">
                    <PeriodList periods={periods} onChange={(next) => updateDay(day.value, next)} disabled={disabled} label={day.label} id={`${baseId}-day-${day.value}`} />
                    {periods.length > 0 && (
                      <button type="button" className="mt-1 text-xs font-medium text-slate-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50" onClick={() => updateDay(day.value, [])} disabled={disabled}>
                        Deixar sem horas úteis
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

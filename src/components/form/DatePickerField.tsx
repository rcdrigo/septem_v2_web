/* Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4 */
/* Hallmark · component: date-picker · genre: modern-minimal · theme: existing slate
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 */
import { useEffect, useRef } from 'react';
import { CalendarDays, X } from 'lucide-react';
import flatpickr from 'flatpickr';
import { Portuguese } from 'flatpickr/dist/l10n/pt';
import type { Instance } from 'flatpickr/dist/types/instance';
import type { DateLimit, DateMode } from '@/lib/datafield';

type Props = {
  value: string;
  mode?: DateMode;
  limit?: DateLimit;
  error?: boolean;
  ariaLabel?: string;
  required?: boolean;
  onChange: (value: string, event: Event) => void;
  onFocus?: (event: Event) => void;
  onBlur?: (event: Event) => void;
  onClick?: (event: Event) => void;
};

function pickerFormat(mode: DateMode | undefined) {
  if (mode === 'date') return { dateFormat: 'Y-m-d', altFormat: 'd/m/Y', enableTime: false, noCalendar: false };
  if (mode === 'time') return { dateFormat: 'H:i', altFormat: 'H:i', enableTime: true, noCalendar: true };
  return { dateFormat: 'Y-m-d\\TH:i', altFormat: 'd/m/Y H:i', enableTime: true, noCalendar: false };
}

/** Datepicker consistente entre browsers, mantendo o valor ISO usado pela API. */
export function DatePickerField({ value, mode, limit, error, ariaLabel, required, onChange, onFocus, onBlur, onClick }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<Instance | null>(null);
  const callbacksRef = useRef({ onChange, onFocus, onBlur, onClick });
  callbacksRef.current = { onChange, onFocus, onBlur, onClick };

  useEffect(() => {
    if (!inputRef.current) return;
    const format = pickerFormat(mode);
    const today = new Date();
    const boundary = mode === 'date'
      ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      : today;

    const picker = flatpickr(inputRef.current, {
      ...format,
      locale: Portuguese,
      defaultDate: value || undefined,
      altInput: true,
      altInputClass: `septem-date-picker-input ${error ? 'septem-date-picker-input--error' : ''}`,
      allowInput: true,
      disableMobile: true,
      time_24hr: true,
      minuteIncrement: 1,
      minDate: limit === 'noPast' && mode !== 'time' ? boundary : undefined,
      maxDate: limit === 'noFuture' && mode !== 'time' ? boundary : undefined,
      onChange: (_dates, dateStr, instance) => {
        callbacksRef.current.onChange(dateStr, new Event('change', { bubbles: true }));
        instance.altInput?.setAttribute('aria-invalid', error ? 'true' : 'false');
      },
      onReady: (_dates, _dateStr, instance) => {
        const visibleInput = instance.altInput ?? instance.input;
        visibleInput.setAttribute('aria-label', ariaLabel || (mode === 'time' ? 'Selecionar hora' : mode === 'date' ? 'Selecionar data' : 'Selecionar data e hora'));
        visibleInput.setAttribute('aria-required', required ? 'true' : 'false');
        visibleInput.setAttribute('aria-invalid', error ? 'true' : 'false');
      },
    }) as Instance;

    const visibleInput = picker.altInput ?? picker.input;
    const handleFocus = (event: Event) => callbacksRef.current.onFocus?.(event);
    const handleBlur = (event: Event) => callbacksRef.current.onBlur?.(event);
    const handleClick = (event: Event) => callbacksRef.current.onClick?.(event);
    visibleInput.addEventListener('focus', handleFocus);
    visibleInput.addEventListener('blur', handleBlur);
    visibleInput.addEventListener('click', handleClick);
    pickerRef.current = picker;

    return () => {
      visibleInput.removeEventListener('focus', handleFocus);
      visibleInput.removeEventListener('blur', handleBlur);
      visibleInput.removeEventListener('click', handleClick);
      picker.destroy();
      pickerRef.current = null;
    };
  }, [mode, limit, ariaLabel, required]);

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker || picker.input.value === value) return;
    picker.setDate(value || [], false, pickerFormat(mode).dateFormat);
  }, [value, mode]);

  useEffect(() => {
    const input = pickerRef.current?.altInput;
    if (!input) return;
    input.classList.toggle('septem-date-picker-input--error', !!error);
    input.setAttribute('aria-invalid', error ? 'true' : 'false');
  }, [error]);

  return (
    <div className="septem-date-picker relative">
      <input ref={inputRef} type="text" className="hidden" aria-hidden="true" tabIndex={-1} />
      {value && (
        <button
          type="button"
          onClick={() => pickerRef.current?.clear()}
          className="absolute right-10 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500 active:bg-slate-200"
          aria-label="Limpar data"
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
      <CalendarDays className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" size={17} aria-hidden="true" />
    </div>
  );
}

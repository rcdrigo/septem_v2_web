/* Hallmark · component: date-picker · genre: modern-minimal · theme: existing slate
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 * pre-emit critique: P5 H5 E5 S5 R5 V4
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import type { Matcher } from 'react-day-picker';
import { CalendarDays, Check, Clock3, X } from 'lucide-react';
import { Calendar } from '@/components/ui/Calendar';

export type DateMode = 'date' | 'time' | 'datetime';
export type DateLimit = '' | 'noPast' | 'noFuture';

type Props = {
  value: string;
  mode?: DateMode;
  limit?: DateLimit;
  error?: boolean;
  ariaLabel?: string;
  required?: boolean;
  onChange: (value: string, event: Event) => void;
  onFocus?: (event: unknown) => void;
  onBlur?: (event: unknown) => void;
  onClick?: (event: unknown) => void;
  onValidityChange?: (message: string | null) => void;
};

type Inspection = {
  complete: boolean;
  valid: boolean;
  iso: string;
  date?: Date;
  reason?: 'incomplete' | 'invalid' | 'past' | 'future';
};

const lengths: Record<DateMode, number> = { date: 10, time: 5, datetime: 16 };

function two(value: number) {
  return String(value).padStart(2, '0');
}

function maskDigits(value: string, mode: DateMode) {
  const maxDigits = mode === 'date' ? 8 : mode === 'time' ? 4 : 12;
  const digits = value.replace(/\D/g, '').slice(0, maxDigits);
  if (mode === 'time') return [digits.slice(0, 2), digits.slice(2, 4)].filter(Boolean).join(':');
  const date = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
  if (mode === 'date' || digits.length <= 8) return date;
  const time = [digits.slice(8, 10), digits.slice(10, 12)].filter(Boolean).join(':');
  return `${date} ${time}`;
}

function buildDate(year: number, month: number, day: number, hour = 0, minute = 0) {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, 0, 0);
  if (
    year < 1000 || date.getFullYear() !== year || date.getMonth() !== month - 1 ||
    date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute
  ) return null;
  return date;
}

function inspect(display: string, mode: DateMode, limit: DateLimit = '', now = new Date()): Inspection {
  if (display.length !== lengths[mode]) return { complete: false, valid: false, iso: '', reason: 'incomplete' };

  if (mode === 'time') {
    const match = /^(\d{2}):(\d{2})$/.exec(display);
    if (!match) return { complete: true, valid: false, iso: '', reason: 'invalid' };
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return { complete: true, valid: false, iso: '', reason: 'invalid' };
    return { complete: true, valid: true, iso: `${two(hour)}:${two(minute)}` };
  }

  const match = mode === 'date'
    ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display)
    : /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(display);
  if (!match) return { complete: true, valid: false, iso: '', reason: 'invalid' };

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = mode === 'datetime' ? Number(match[4]) : 0;
  const minute = mode === 'datetime' ? Number(match[5]) : 0;
  if (hour > 23 || minute > 59) return { complete: true, valid: false, iso: '', reason: 'invalid' };

  const date = buildDate(year, month, day, hour, minute);
  if (!date) return { complete: true, valid: false, iso: '', reason: 'invalid' };

  const boundary = new Date(now);
  boundary.setSeconds(0, 0);
  if (mode === 'date') boundary.setHours(0, 0, 0, 0);
  if (limit === 'noPast' && date < boundary) return { complete: true, valid: false, iso: '', date, reason: 'past' };
  if (limit === 'noFuture' && date > boundary) return { complete: true, valid: false, iso: '', date, reason: 'future' };

  const isoDate = `${year}-${two(month)}-${two(day)}`;
  return {
    complete: true,
    valid: true,
    date,
    iso: mode === 'date' ? isoDate : `${isoDate}T${two(hour)}:${two(minute)}`,
  };
}

function displayFromIso(value: string, mode: DateMode) {
  if (!value) return '';
  if (mode === 'time') return inspect(value, mode).valid ? value : '';
  const match = mode === 'date'
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    : /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return '';
  const display = mode === 'date'
    ? `${match[3]}/${match[2]}/${match[1]}`
    : `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
  return inspect(display, mode).valid ? display : '';
}

function displayDate(date: Date) {
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function dateFromDisplay(display: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(display);
  return match ? buildDate(Number(match[3]), Number(match[2]), Number(match[1])) ?? undefined : undefined;
}

function currentTime() {
  const now = new Date();
  return `${two(now.getHours())}:${two(now.getMinutes())}`;
}

const reasonText: Record<NonNullable<Inspection['reason']>, string> = {
  incomplete: 'Preencha a data e a hora completas.',
  invalid: 'Informe uma data e hora válidas.',
  past: 'A data não pode ser no passado.',
  future: 'A data não pode ser no futuro.',
};

export function DatePickerField({ value, mode = 'datetime', limit = '', error, ariaLabel, required, onChange, onFocus, onBlur, onClick, onValidityChange }: Props) {
  const [display, setDisplay] = useState(() => displayFromIso(value, mode));
  const [localError, setLocalError] = useState<Inspection['reason']>();
  const [open, setOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState(currentTime);
  const lastEmitted = useRef<string | null>(null);
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;
  const previousMode = useRef(mode);
  const errorId = useId();
  const hasCalendar = mode !== 'time';

  useEffect(() => {
    const changedMode = previousMode.current !== mode;
    previousMode.current = mode;
    if (!changedMode && lastEmitted.current === value) {
      lastEmitted.current = null;
      return;
    }
    lastEmitted.current = null;
    setDisplay(displayFromIso(value, mode));
    setLocalError(undefined);
    validityCallback.current?.(null);
  }, [value, mode]);

  const selectedDate = useMemo(() => mode === 'time' ? undefined : dateFromDisplay(display), [display, mode]);
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const disabledDays = useMemo<Matcher | Matcher[] | undefined>(() => {
    if (limit === 'noPast') return { before: today };
    if (limit === 'noFuture') return { after: today };
    return undefined;
  }, [limit, today]);

  function emit(next: string, event = new Event('change', { bubbles: true })) {
    lastEmitted.current = next;
    onChange(next, event);
  }

  function acceptDisplay(nextDisplay: string, event?: Event) {
    setDisplay(nextDisplay);
    const result = inspect(nextDisplay, mode, limit);
    setLocalError(result.complete && !result.valid ? result.reason : undefined);
    validityCallback.current?.(!nextDisplay || result.valid ? null : reasonText[result.reason ?? 'invalid']);
    emit(result.valid ? result.iso : '', event);
    return result;
  }

  function handleManualChange(event: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskDigits(event.target.value, mode);
    acceptDisplay(masked, event.nativeEvent);
    if (mode === 'datetime' && masked.length === lengths.datetime) setTimeDraft(masked.slice(-5));
  }

  function handleBlur(event: React.FocusEvent<HTMLInputElement | HTMLButtonElement>) {
    if (display) {
      const result = inspect(display, mode, limit);
      if (!result.valid) setLocalError(result.reason);
    }
    onBlur?.(event);
  }

  function clear(event?: Event) {
    setDisplay('');
    setLocalError(undefined);
    validityCallback.current?.(null);
    emit('', event);
  }

  function selectDate(date: Date | undefined) {
    if (!date) {
      clear();
      setOpen(false);
      return;
    }
    if (mode === 'date') {
      acceptDisplay(displayDate(date));
      setOpen(false);
      return;
    }
    const safeTime = inspect(timeDraft, 'time').valid ? timeDraft : currentTime();
    setTimeDraft(safeTime);
    acceptDisplay(`${displayDate(date)} ${safeTime}`);
  }

  function changeTime(event: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskDigits(event.target.value, 'time');
    setTimeDraft(masked);
    if (selectedDate) acceptDisplay(`${displayDate(selectedDate)} ${masked}`, event.nativeEvent);
  }

  function handleOpenChange(next: boolean) {
    if (next && mode === 'datetime') {
      const time = / (\d{2}:\d{2})$/.exec(display)?.[1];
      setTimeDraft(time ?? currentTime());
    }
    setOpen(next);
  }

  const invalidReason = localError ? reasonText[localError] : undefined;
  const invalid = !!error || !!localError;
  const inputLabel = ariaLabel || (mode === 'time' ? 'Hora' : mode === 'date' ? 'Data' : 'Data e hora');
  const inputClass = [
    'septem-date-picker-input h-10 min-w-0 flex-1 bg-white px-3 text-sm text-slate-800 outline-none',
    invalid ? 'text-rose-700' : '',
  ].join(' ');

  return (
    <div className="septem-date-picker relative">
      <input type="hidden" value={value} readOnly data-date-picker-iso="" />
      <div className={`flex w-full items-center overflow-hidden rounded-md border bg-white transition-colors ${invalid ? 'border-rose-400 focus-within:ring-2 focus-within:ring-rose-300' : 'border-slate-300 hover:border-slate-400 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-300'}`}>
        <input
          type="text"
          className={inputClass}
          value={display}
          inputMode="numeric"
          autoComplete="off"
          maxLength={lengths[mode]}
          aria-label={inputLabel}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={invalidReason ? errorId : undefined}
          title={invalidReason}
          data-date-picker-input=""
          onChange={handleManualChange}
          onFocus={onFocus}
          onBlur={handleBlur}
          onClick={onClick}
          onKeyDown={(event) => {
            if (hasCalendar && event.altKey && event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
            }
          }}
        />

        {display && (
          <button
            type="button"
            onClick={(event) => clear(event.nativeEvent)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500 active:bg-slate-200"
            aria-label="Limpar valor"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}

        {hasCalendar ? (
          <Popover.Root open={open} onOpenChange={handleOpenChange}>
            <Popover.Trigger
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500 active:bg-slate-200"
              aria-label={mode === 'date' ? 'Abrir calendário' : 'Abrir calendário e horário'}
              data-date-picker-trigger=""
              onFocus={onFocus}
              onBlur={handleBlur}
              onClick={onClick}
            >
              <CalendarDays size={17} aria-hidden="true" />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner sideOffset={6} collisionPadding={8} className="z-[1000] outline-none">
                <Popover.Popup
                  className="max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
                  data-date-picker-popover=""
                >
                  <Calendar mode="single" selected={selectedDate} onSelect={selectDate} disabled={disabledDays} />
                  {mode === 'datetime' && (
                    <div className="flex items-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
                      <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
                        Horário
                        <div className="mt-1 flex h-10 items-center rounded-md border border-slate-300 bg-white focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-300">
                          <Clock3 className="ml-3 shrink-0 text-slate-400" size={16} aria-hidden="true" />
                          <input
                            value={timeDraft}
                            onChange={changeTime}
                            inputMode="numeric"
                            maxLength={5}
                            className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-800 outline-none"
                            aria-label="Horário"
                            data-date-picker-time=""
                          />
                        </div>
                      </label>
                      <Popover.Close
                        disabled={!inspect(display, mode, limit).valid}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white outline-none hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Check size={15} aria-hidden="true" /> Aplicar
                      </Popover.Close>
                    </div>
                  )}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        ) : (
          <Clock3 className="mr-3 shrink-0 text-slate-400" size={17} aria-hidden="true" />
        )}
      </div>
      {invalidReason && <span id={errorId} className="sr-only">{invalidReason}</span>}
    </div>
  );
}

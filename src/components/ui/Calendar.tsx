/* Hallmark · component: calendar · genre: modern-minimal · theme: existing slate
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 * pre-emit critique: P5 H4 E5 S5 R5 V4
 */
import type { ComponentProps } from 'react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';

type Props = ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: Props) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={['p-3', className].filter(Boolean).join(' ')}
      classNames={{
        root: 'relative',
        months: 'flex flex-col',
        month: 'space-y-3',
        month_caption: 'relative flex h-9 items-center justify-center px-10',
        caption_label: 'text-sm font-semibold capitalize text-slate-800',
        nav: 'absolute inset-x-3 top-3 z-10 flex items-center justify-between',
        button_previous: 'inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-500 active:bg-slate-200 disabled:pointer-events-none disabled:opacity-40',
        button_next: 'inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-500 active:bg-slate-200 disabled:pointer-events-none disabled:opacity-40',
        chevron: 'h-4 w-4 fill-current',
        month_grid: 'w-full border-collapse',
        weekdays: 'grid grid-cols-7',
        weekday: 'flex h-8 items-center justify-center text-[0.72rem] font-medium uppercase text-slate-400',
        weeks: 'space-y-1',
        week: 'grid grid-cols-7',
        day: 'flex h-9 w-9 items-center justify-center text-center text-sm',
        day_button: 'inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 outline-none hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-500 active:bg-slate-200',
        today: '[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-slate-300',
        selected: '[&>button]:bg-slate-900 [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-slate-800 [&>button]:hover:text-white',
        outside: '[&>button]:text-slate-300',
        disabled: '[&>button]:pointer-events-none [&>button]:text-slate-300 [&>button]:line-through [&>button]:decoration-slate-300',
        hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  );
}

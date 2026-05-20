import {
  type ReactNode,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  forwardRef,
} from 'react';

const INPUT_BASE =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none';

// ─── Field ───────────────────────────────────────────────────────────────────

type FieldProps = {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
};

export function Field({ label, hint, htmlFor, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={htmlFor}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

// ─── Text inputs ─────────────────────────────────────────────────────────────

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput(props, ref) {
    const { className = '', type = 'text', ...rest } = props;
    return <input ref={ref} type={type} {...rest} className={[INPUT_BASE, className].join(' ')} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea(props, ref) {
    const { className = '', rows = 3, ...rest } = props;
    return (
      <textarea
        ref={ref}
        rows={rows}
        {...rest}
        className={[INPUT_BASE, 'resize-y', className].join(' ')}
      />
    );
  },
);

// ─── Select ──────────────────────────────────────────────────────────────────

export type SelectOption = { value: string; label: string };

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(props, ref) {
  const { className = '', options, placeholder, value, onChange, ...rest } = props;
  return (
    <select
      ref={ref}
      value={value ?? ''}
      onChange={onChange}
      {...rest}
      className={[INPUT_BASE, 'pr-8', className].join(' ')}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
});

// ─── Checkbox ────────────────────────────────────────────────────────────────

type CheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export function Checkbox({ checked, onChange, label, hint, disabled }: CheckboxProps) {
  return (
    <label className={['flex items-start gap-2', disabled ? 'opacity-50' : ''].join(' ')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-400 text-slate-900 focus:ring-slate-500"
      />
      <span className="flex flex-col">
        <span className="text-sm text-slate-800">{label}</span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

// ─── RadioGroup ──────────────────────────────────────────────────────────────

export type RadioOption<T extends string = string> = {
  value: T;
  label: string;
  hint?: string;
};

type RadioGroupProps<T extends string> = {
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<RadioOption<T>>;
  direction?: 'vertical' | 'horizontal';
};

export function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  direction = 'vertical',
}: RadioGroupProps<T>) {
  return (
    <div className={direction === 'vertical' ? 'flex flex-col gap-1.5' : 'flex flex-wrap gap-3'}>
      {options.map((opt) => (
        <label key={opt.value} className="flex items-start gap-2">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 h-4 w-4 cursor-pointer border-slate-400 text-slate-900 focus:ring-slate-500"
          />
          <span className="flex flex-col">
            <span className="text-sm text-slate-800">{opt.label}</span>
            {opt.hint && <span className="text-xs text-slate-400">{opt.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

// ─── Section / SubSection ────────────────────────────────────────────────────

type SectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="border-b border-slate-200 px-4 py-4">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function PlaceholderBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
      {children}
    </div>
  );
}

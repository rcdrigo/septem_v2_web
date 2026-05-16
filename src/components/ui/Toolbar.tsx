import { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export function Toolbar({ title, subtitle, children }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}

type ButtonProps = {
  onClick?: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  type?: 'button' | 'submit';
  asLabel?: boolean;
  htmlFor?: string;
};

export function ToolbarButton({
  onClick,
  children,
  variant = 'secondary',
  type = 'button',
  asLabel,
  htmlFor,
}: ButtonProps) {
  const cls = [
    'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    variant === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  ].join(' ');

  if (asLabel) {
    return (
      <label className={cls} htmlFor={htmlFor}>
        {children}
      </label>
    );
  }

  return (
    <button type={type} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

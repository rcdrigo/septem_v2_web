import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'default' | 'danger' | 'primary';
};

/**
 * Botão compacto com ícone + texto, usado em listas editáveis (adicionar/remover/reordenar).
 */
export function IconButton({ children, variant = 'default', className = '', ...rest }: Props) {
  const base =
    'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    default: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    primary: 'border border-slate-900 bg-slate-900 text-white hover:bg-slate-800',
    danger: 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50',
  } as const;
  return (
    <button type="button" {...rest} className={[base, variants[variant], className].join(' ')}>
      {children}
    </button>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  /** O gatilho do popover (botão). É clonado para receber onClick. */
  trigger: (open: boolean) => ReactNode;
  /** Conteúdo do popover. */
  children: (close: () => void) => ReactNode;
  /** Alinhamento horizontal do popover em relação ao trigger. */
  align?: 'left' | 'right';
};

/**
 * Popover de cliques (não hover). Fecha ao clicar fora ou apertar Esc.
 * Layout posicionado abaixo do trigger.
 */
export function Popover({ trigger, children, align = 'right' }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} className="contents">
        {trigger(open)}
      </button>
      {open && (
        <div
          className={[
            'absolute top-full z-40 mt-1 min-w-[200px] rounded-md border border-slate-200 bg-white py-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

type MenuItemProps = {
  onClick: () => void;
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
};

export function MenuItem({ onClick, children, destructive, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
        disabled ? 'cursor-not-allowed text-slate-300' : 'cursor-pointer hover:bg-slate-100',
        destructive ? 'text-rose-700' : 'text-slate-700',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 border-t border-slate-100" />;
}

import { useState, type ReactNode } from 'react';

type Props = {
  /** Texto do aviso; quando vazio, o wrapper só renderiza o filho. */
  text?: string | null;
  children: ReactNode;
};

/**
 * Tooltip simples acionado por hover/focus que exibe um aviso **acima** do
 * elemento. Usado para mostrar orientações em botões na execução.
 */
export function Tooltip({ text, children }: Props) {
  const [show, setShow] = useState(false);
  if (!text) return <>{children}</>;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-xs -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-700 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}

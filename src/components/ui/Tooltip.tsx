import { useState, type ReactNode } from 'react';

type Props = {
  /** Conteúdo do aviso (HTML/rich-text); quando vazio, só renderiza o filho. */
  text?: string | null;
  children: ReactNode;
};

/**
 * Tooltip acionado por hover/focus que exibe um aviso **acima** do elemento.
 * Renderiza HTML (rich-text), quebra linhas e limita a largura para não estourar
 * a página. Usado nas orientações dos botões de conclusão.
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
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-xs -translate-x-1/2 whitespace-normal break-words rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-normal text-slate-700 shadow-lg [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      )}
    </span>
  );
}

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** Conteúdo do aviso (HTML/rich-text); quando vazio, só renderiza o filho. */
  text?: string | null;
  children: ReactNode;
};

/**
 * Tooltip acionado por hover/focus que exibe um aviso acima do elemento.
 * Renderiza HTML (rich-text), quebra linhas e limita a largura. Posiciona via
 * portal (fixed) clampado à viewport — não vaza da página nem é clipado por
 * ancestrais com overflow/transform. Usado nas orientações dos botões.
 */
export function Tooltip({ text, children }: Props) {
  const [show, setShow] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!show || !wrapRef.current || !tipRef.current) return;
    const margin = 8;
    const br = wrapRef.current.getBoundingClientRect();
    const tr = tipRef.current.getBoundingClientRect();
    let left = br.left + br.width / 2 - tr.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tr.width - margin));
    const fitsAbove = br.top - tr.height - margin >= 0;
    const top = fitsAbove ? br.top - tr.height - 6 : br.bottom + 6;
    setStyle({ position: 'fixed', left, top, visibility: 'visible' });
  }, [show, text]);

  if (!text) return <>{children}</>;

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          style={style}
          className="pointer-events-none z-[60] w-max max-w-[min(24rem,90vw)] whitespace-normal break-words rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-normal text-slate-700 shadow-lg [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
          dangerouslySetInnerHTML={{ __html: text }}
        />,
        document.body,
      )}
    </span>
  );
}

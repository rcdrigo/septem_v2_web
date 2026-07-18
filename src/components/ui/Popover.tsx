import { useEffect, useLayoutEffect, useRef, useState, type AriaRole, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** O gatilho do popover (botão). É clonado para receber onClick. */
  trigger: (open: boolean) => ReactNode;
  /** Conteúdo do popover. */
  children: (close: () => void) => ReactNode;
  /** Alinhamento horizontal do popover em relação ao trigger. */
  align?: 'left' | 'right';
  /** Ocupa toda a largura do pai (block). Sem isto o container é inline-block
      e cresce pelo conteúdo — o `truncate` do trigger nunca atua. */
  fullWidth?: boolean;
  panelRole?: AriaRole;
  ariaLabel?: string;
};

/**
 * Popover de cliques (não hover). Fecha ao clicar fora ou apertar Esc.
 *
 * O painel é renderizado em PORTAL (document.body) com posição `fixed`, calculada
 * sob o trigger — assim `overflow:hidden`/`z-index` de um contêiner ancestral (ex.:
 * o frame do modelador de formulário) não corta o popover. Se não couber abaixo,
 * abre para cima. Recalcula em scroll/resize.
 */
export function Popover({
  trigger,
  children,
  align = 'right',
  fullWidth = false,
  panelRole = 'menu',
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Posiciona o painel (fixed) a partir do rect do trigger e do tamanho medido do painel.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      const pw = panelRef.current?.offsetWidth ?? 200;
      const ph = panelRef.current?.offsetHeight ?? 0;
      let left = align === 'right' ? r.right - pw : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      const cabeAbaixo = r.bottom + 4 + ph <= window.innerHeight - 8;
      const top = cabeAbaixo ? r.bottom + 4 : Math.max(8, r.top - 4 - ph);
      setPos({ left, top });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
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
    <div ref={containerRef} className={fullWidth ? 'relative block w-full min-w-0' : 'relative inline-block'}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="contents"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup={panelRole === 'dialog' ? 'dialog' : 'menu'}
      >
        {trigger(open)}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: pos?.left ?? 0,
            top: pos?.top ?? 0,
            zIndex: 1010,
            // Mede o painel invisível na 1ª passada, então o layoutEffect calcula `pos`.
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="min-w-[200px] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          role={panelRole}
          aria-label={ariaLabel}
        >
          {children(() => setOpen(false))}
        </div>,
        document.body,
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

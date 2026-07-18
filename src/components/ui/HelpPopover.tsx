import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

type Props = {
  html: string;
  ariaLabel?: string;
};

/**
 * Helper compartilhado exibido por hover ou foco. O conteúdo sai do fluxo em
 * um portal para não ser recortado por painéis com overflow.
 */
export function HelpPopover({ html, ariaLabel = 'Ajuda' }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const focusedRef = useRef(false);
  const id = useId();
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  function clearTimer(ref: React.MutableRefObject<number | null>) {
    if (ref.current !== null) window.clearTimeout(ref.current);
    ref.current = null;
  }

  function openFromHover() {
    clearTimer(closeTimerRef);
    clearTimer(hoverTimerRef);
    hoverTimerRef.current = window.setTimeout(() => setOpen(true), 800);
  }

  function scheduleClose() {
    clearTimer(hoverTimerRef);
    clearTimer(closeTimerRef);
    closeTimerRef.current = window.setTimeout(() => {
      if (!focusedRef.current) setOpen(false);
    }, 100);
  }

  useEffect(() => () => {
    clearTimer(hoverTimerRef);
    clearTimer(closeTimerRef);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popRef.current) return;

    function place() {
      const br = triggerRef.current?.getBoundingClientRect();
      const pr = popRef.current?.getBoundingClientRect();
      if (!br || !pr) return;
      const margin = 8;
      let left = br.left + br.width / 2 - pr.width / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - pr.width - margin));
      const fitsAbove = br.top - pr.height - margin >= 0;
      const top = fitsAbove ? br.top - pr.height - 6 : br.bottom + 6;
      setStyle({ position: 'fixed', left, top, visibility: 'visible' });
    }

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, html]);

  return (
    <span
      ref={triggerRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-describedby={open ? id : undefined}
      className="inline-flex shrink-0 rounded-sm text-slate-400 outline-none hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1 active:text-slate-800"
      onMouseEnter={openFromHover}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        focusedRef.current = true;
        clearTimer(hoverTimerRef);
        clearTimer(closeTimerRef);
        setOpen(true);
      }}
      onBlur={() => {
        focusedRef.current = false;
        scheduleClose();
      }}
      onClick={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          triggerRef.current?.blur();
        }
      }}
    >
      <HelpCircle size={14} aria-hidden="true" />
      {open && createPortal(
        <div
          ref={popRef}
          id={id}
          role="tooltip"
          style={style}
          className="z-[1010] w-max max-w-[min(20rem,90vw)] rounded-md border border-slate-200 bg-white p-2 text-left text-xs font-normal normal-case tracking-normal text-slate-700 shadow-lg"
          onMouseEnter={() => clearTimer(closeTimerRef)}
          onMouseLeave={scheduleClose}
          dangerouslySetInnerHTML={{ __html: html }}
        />,
        document.body,
      )}
    </span>
  );
}

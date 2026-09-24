import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Check, ChevronRight, Globe } from 'lucide-react';
import { useSessionStore, type AccessMode } from '@/stores/session';
import { routes } from '@/lib/routes';

/** Submenu de acesso exclusivo de usuários internos. */
export function AccessModeToggle({ onClose }: { onClose: () => void }) {
  const isInternal = useSessionStore((s) => s.user?.isInternal ?? false);
  const accessMode = useSessionStore((s) => s.accessMode);
  const setAccessMode = useSessionStore((s) => s.setAccessMode);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  if (!isInternal) return null;

  function pick(mode: AccessMode) {
    setAccessMode(mode);
    onClose();
    if (mode !== accessMode && mode === 'externo') navigate(routes.tasks);
  }

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => panel.current?.querySelector('button')?.focus());
        }
        if (open && (event.key === 'ArrowLeft' || event.key === 'Escape')) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}>
      <button ref={trigger} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-700">
        <Briefcase size={15} /> <span className="flex-1">Acesso</span><ChevronRight size={15} />
      </button>
      {open && (
        <div ref={panel} id={id} role="menu" aria-label="Acesso" className="border border-slate-200 bg-white py-1 max-sm:mx-2 max-sm:rounded-md sm:absolute sm:left-full sm:top-0 sm:min-w-40 sm:rounded-md sm:shadow-lg">
          {([{ mode: 'interno', label: 'Interno', icon: Briefcase }, { mode: 'externo', label: 'Externo', icon: Globe }] as const).map(({ mode, label, icon: Icon }) => (
            <button key={mode} type="button" role="menuitemradio" aria-checked={mode === accessMode} onClick={() => pick(mode)}
              className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-700">
              <Icon size={15} /><span className="flex-1">{label}</span>{mode === accessMode && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

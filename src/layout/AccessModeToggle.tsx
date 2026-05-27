import { useNavigate } from 'react-router-dom';
import { Briefcase, Globe } from 'lucide-react';
import { useSessionStore, type AccessMode } from '@/stores/session';

/**
 * Alterna entre layout Interno e Externo. Só renderiza para usuários internos
 * (funcionários) — externos (auto-cadastro) ficam travados no modo externo.
 */
export function AccessModeToggle() {
  const isInternal = useSessionStore((s) => s.user?.isInternal ?? false);
  const accessMode = useSessionStore((s) => s.accessMode);
  const setAccessMode = useSessionStore((s) => s.setAccessMode);
  const navigate = useNavigate();

  if (!isInternal) return null;

  function pick(mode: AccessMode) {
    if (mode === accessMode) return;
    setAccessMode(mode);
    // Layout externo não compartilha as rotas de admin — leva pra Serviços.
    if (mode === 'externo') navigate('/servicos');
  }

  const options: { mode: AccessMode; label: string; icon: typeof Briefcase }[] = [
    { mode: 'interno', label: 'Interno', icon: Briefcase },
    { mode: 'externo', label: 'Externo', icon: Globe },
  ];

  return (
    <div className="px-3 pb-2">
      <div className="flex rounded-md bg-slate-100 p-0.5">
        {options.map(({ mode, label, icon: Icon }) => {
          const active = mode === accessMode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => pick(mode)}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors',
                active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

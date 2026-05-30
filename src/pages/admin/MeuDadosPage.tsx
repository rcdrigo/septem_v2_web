import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useSessionStore } from '@/stores/session';

/**
 * Meus dados — IF1.e. Mostra o perfil do usuário logado (lido do session store,
 * que já carrega `/api/v1/me` no bootstrap) e dá acesso à troca de senha.
 * Edição de nome (`PUT /me`) entra quando o endpoint existir.
 */
export function MeuDadosPage() {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);

  if (!user) return <div className="p-6 text-sm text-slate-400">Carregando...</div>;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Meus dados</h1>
        <button
          type="button"
          onClick={() => navigate('/me/senha')}
          className="flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <KeyRound size={16} /> Mudar senha
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl space-y-4 rounded-md border border-slate-200 bg-white p-5">
          <Row label="Nome" value={user.name} />
          <Row label="E-mail" value={user.email} />
          <Row label="Tipo" value={user.isInternal ? 'Interno (funcionário)' : 'Externo'} />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Perfis de acesso</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {user.accessProfiles.length === 0 && <span className="text-sm text-slate-400">Nenhum</span>}
              {user.accessProfiles.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  <ShieldCheck size={11} className="text-slate-400" /> {p.name}
                </span>
              ))}
            </div>
          </div>
          <Row label="Permissões" value={`${user.perms.length} permiss${user.perms.length === 1 ? 'ão' : 'ões'}`} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}

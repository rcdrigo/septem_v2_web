import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { useSessionStore } from '@/stores/session';
import { ApiError } from '@/lib/api';
import { toast } from '@/stores/toast';

/**
 * Página /login fora do AppShell. Após autenticar com sucesso, o `bootstrap`
 * popula o user no store e os guards de rota liberam o app.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const tenant = useSessionStore((s) => s.tenant);
  const login = useSessionStore((s) => s.login);
  const status = useSessionStore((s) => s.status);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') navigate('/', { replace: true });
  }, [status, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof ApiError && err.status === 401
        ? 'E-mail ou senha incorretos.'
        : 'Não foi possível entrar. Tente novamente.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.clienteNome} className="h-9 w-auto" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
              {(tenant?.clienteNome ?? 'S')[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{tenant?.clienteNome ?? 'Septem V2'}</p>
            {tenant && <p className="truncate text-xs text-slate-500">{tenant.ambienteNome}</p>}
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">E-mail</span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
              placeholder="admin@prefeitura-x.local"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Senha</span>
            <input
              type="password"
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

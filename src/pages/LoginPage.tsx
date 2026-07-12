import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useSessionStore } from '@/stores/session';
import { ApiError } from '@/lib/api';
import { toast } from '@/stores/toast';

/**
 * Página /login fora do AppShell — layout em duas colunas (proposta do dono,
 * 2026-07-11): painel institucional escuro à esquerda (tenant + headline +
 * cards informativos) e o formulário à direita. Sem sombras, por pedido.
 * Após autenticar, o `bootstrap` popula o user e os guards liberam o app.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const tenant = useSessionStore((s) => s.tenant);
  const login = useSessionStore((s) => s.login);
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);

  // Branding do tenant no /login acessado direto: o bootstrap só rodava no
  // AppShell, então o painel ficava no fallback "Septem" até logar.
  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') navigate('/', { replace: true });
  }, [status, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password, keepConnected);
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-2">
        {/* ── Painel institucional (esquerda) ─────────────────────────────── */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-slate-900 p-8 sm:p-10">
          {/* círculos decorativos */}
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-800/40" />
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-600/40" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full border-[22px] border-slate-800/80" />

          <div className="relative">
            <div className="flex items-center gap-2.5">
              {tenant?.logoUrl && <img src={tenant.logoUrl} alt="" className="h-8 w-auto" />}
              <div>
                {/* Copy fixa do painel institucional (mock do dono) — o branding
                    por tenant segue no restante do app (sidenav, títulos etc.). */}
                <p className="text-base font-semibold text-white">Prefeitura Municipal</p>
                <p className="text-sm text-slate-400">Gestão integrada</p>
              </div>
            </div>
          </div>

          <div className="relative my-10 lg:my-16">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
              Processos &amp; Compliance
            </p>
            <h2 className="max-w-md text-3xl font-bold leading-tight text-white sm:text-4xl">
              Processos claros, conformidade em cada decisão.
            </h2>
          </div>

          <div className="relative grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Precisa de ajuda?</p>
              <p className="mt-1 text-xs text-slate-500">Domine a plataforma com nosso guia.</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Consultar processo</p>
              <p className="mt-1 text-xs text-slate-500">Valide seu protocolo ou os documentos emitidos ao final dos processos.</p>
            </div>
          </div>
        </div>

        {/* ── Formulário (direita) ─────────────────────────────────────────── */}
        <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-14">
          <h1 className="text-3xl font-bold text-slate-900">Bem-vindo de volta</h1>
          <p className="mt-2 text-sm text-slate-500">Entre com seus dados para acessar o Septem.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">E-mail</span>
              <span className="relative block">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none"
                  placeholder="usuario@prefeitura.gov.br"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">Senha</span>
              <span className="relative block">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-11 text-sm focus:border-slate-900 focus:outline-none"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={keepConnected}
                  onChange={(e) => setKeepConnected(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-400 accent-slate-900"
                />
                Manter-me conectado
              </label>
              <button
                type="button"
                onClick={() => toast.info('Procure o administrador do sistema para redefinir a sua senha.')}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Entrar
            </button>

            <button
              type="button"
              onClick={() => toast.info('Solicite o acesso ao administrador do sistema do seu órgão.')}
              className="block w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Solicitar acesso
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-slate-400">
            Tecnologia <span className="font-semibold text-slate-500">Septem</span>
          </p>
        </div>
      </div>
    </div>
  );
}

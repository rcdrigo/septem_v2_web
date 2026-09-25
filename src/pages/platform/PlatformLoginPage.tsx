import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { usePlatformSession } from '@/stores/platform-session';
import { ApiError } from '@/lib/api';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Login da equipe da Septem. Duas etapas SEMPRE: senha e código por e-mail.
 *
 * Não há "confiar neste dispositivo" nem modo configurável — a conta que enxerga
 * todos os clientes não ganha atalho (Q5). A tela não mostra o branding de nenhum
 * cliente: aqui não existe tenant.
 */
export function PlatformLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pedido = params.get('returnUrl');
  const returnUrl = pedido?.startsWith('/platform') ? pedido : routes.platformClients;

  const status = usePlatformSession((s) => s.status);
  const bootstrap = usePlatformSession((s) => s.bootstrap);
  const login = usePlatformSession((s) => s.login);
  const completeTwoFactor = usePlatformSession((s) => s.completeTwoFactor);
  useDocumentTitle('Área central');

  const [etapa, setEtapa] = useState<'credenciais' | '2fa'>('credenciais');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [mascarado, setMascarado] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  useEffect(() => {
    if (status === 'authenticated') navigate(returnUrl, { replace: true });
  }, [status, navigate, returnUrl]);

  /** O backend devolve o motivo; a tela precisa dizê-lo, não um "falhou" genérico. */
  function tratar(err: unknown, padrao: string) {
    if (err instanceof ApiError) {
      const body = err.body as { error?: string; detail?: string; attemptsLeft?: number; lockedMinutes?: number } | undefined;
      if (body?.error === 'account_locked') {
        setAviso(`Conta bloqueada por ${body.lockedMinutes} minuto${body.lockedMinutes === 1 ? '' : 's'}.`);
        return;
      }
      if (body?.error === 'twofactor_send_failed') {
        setAviso(body.detail ?? 'Não foi possível enviar o código de verificação.');
        return;
      }
      if (body?.error === 'invalid_credentials') {
        setAviso(
          typeof body.attemptsLeft === 'number'
            ? `E-mail ou senha incorretos. ${body.attemptsLeft} tentativa${body.attemptsLeft === 1 ? '' : 's'} antes do bloqueio.`
            : 'E-mail ou senha incorretos.',
        );
        return;
      }
      if (body?.error === 'code_expired') return setAviso('O código expirou. Volte e entre de novo.');
      if (body?.error === 'code_attempts_exceeded') return setAviso('Tentativas demais com este código. Volte e entre de novo.');
      if (body?.error?.startsWith('code_')) return setAviso('Código incorreto. Confira o e-mail.');
    }
    setAviso(padrao);
  }

  async function enviarCredenciais(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    setEnviando(true);
    try {
      const { maskedEmail } = await login(email.trim(), senha);
      setMascarado(maskedEmail);
      setEtapa('2fa');
    } catch (err) {
      tratar(err, 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    setEnviando(true);
    try {
      await completeTwoFactor(email.trim(), codigo.trim());
    } catch (err) {
      tratar(err, 'Não foi possível validar o código.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-2 text-slate-100">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <div>
            <h1 className="text-base font-semibold">Área central da Septem</h1>
            <p className="text-xs text-slate-400">Acesso restrito à equipe da plataforma.</p>
          </div>
        </div>

        {aviso && (
          <p role="alert" data-testid="platform-login-aviso" className="mb-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {aviso}
          </p>
        )}

        {etapa === 'credenciais' ? (
          <form onSubmit={enviarCredenciais} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              E-mail
              <span className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-900 px-3 py-2">
                <Mail className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm normal-case tracking-normal text-slate-100 outline-none placeholder:text-slate-600"
                  placeholder="voce@septem.app"
                />
              </span>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Senha
              <span className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-900 px-3 py-2">
                <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full bg-transparent text-sm normal-case tracking-normal text-slate-100 outline-none"
                />
              </span>
            </label>
            <button
              type="submit"
              disabled={enviando}
              className="mt-2 flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
            >
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Continuar
            </button>
            <p className="text-center text-xs text-slate-500">
              Um código de verificação será enviado por e-mail. Sempre.
            </p>
          </form>
        ) : (
          <form onSubmit={enviarCodigo} className="flex flex-col gap-3">
            <p className="text-sm text-slate-300" data-testid="platform-2fa-aviso">
              Enviamos um código para <strong className="text-slate-100">{mascarado}</strong>.
            </p>
            <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Código
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-center text-lg tracking-[0.4em] text-slate-100 outline-none"
                placeholder="000000"
              />
            </label>
            <button
              type="submit"
              disabled={enviando}
              className="flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
            >
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setEtapa('credenciais');
                setCodigo('');
                setAviso(null);
              }}
              className="text-xs text-slate-400 underline-offset-2 hover:underline"
            >
              Voltar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { platformApi } from '@/lib/platform-api';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Aceite do convite do primeiro administrador (ADM-02, Fase 11a).
 *
 * É a única tela da área central que funciona **sem sessão**: quem chega aqui ainda não
 * tem credencial — é exatamente o que vem definir. A autorização é o token do link, de
 * uso único.
 *
 * O token nunca aparece na tela nem no título: ele fica na URL porque veio do e-mail, e
 * some do caminho assim que o aceite conclui.
 */
export function PlatformAceitarConvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  useDocumentTitle('Definir minha senha');

  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);

    if (senha.length < 8) {
      setAviso('A senha precisa de ao menos 8 caracteres.');
      return;
    }
    if (senha !== confirmacao) {
      setAviso('As senhas não são iguais.');
      return;
    }

    setEnviando(true);
    try {
      await platformApi.post('/auth/invites/accept', { token, password: senha }, { anonymous: true });
      setPronto(true);
    } catch (err) {
      const corpo = err instanceof ApiError
        ? (err.body as { error?: string; detail?: string } | undefined)
        : undefined;
      setAviso(corpo?.detail
        ?? 'Não foi possível usar este convite. Peça um novo à Septem.');
    } finally {
      setEnviando(false);
    }
  }

  if (!token)
    return (
      <Moldura>
        <p className="text-sm text-slate-300" data-testid="convite-sem-token">
          Este endereço precisa do link que você recebeu por e-mail.
        </p>
      </Moldura>
    );

  if (pronto)
    return (
      <Moldura>
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
        <p className="text-sm text-slate-200" data-testid="convite-aceito">
          Senha definida. Agora é só entrar — o acesso pede um código de verificação por e-mail.
        </p>
        <button
          type="button"
          onClick={() => navigate(routes.platformLogin, { replace: true })}
          className="mt-4 min-h-11 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
        >
          Ir para o acesso
        </button>
      </Moldura>
    );

  return (
    <Moldura>
      <form onSubmit={enviar} className="flex flex-col gap-3 text-left">
        <p className="text-sm text-slate-300">
          Defina a senha que você usará para administrar os ambientes da sua organização.
        </p>

        {aviso && (
          <p role="alert" data-testid="convite-aviso" className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {aviso}
          </p>
        )}

        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Nova senha
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Repita a senha
          <input
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={enviando}
          data-testid="convite-definir"
          className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          Definir senha
        </button>

        <p className="text-center text-xs text-slate-500">
          O convite vale uma única vez.
        </p>
      </form>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 p-6 text-center shadow-xl">
        <div className="mb-4 flex items-center justify-center gap-2 text-slate-100">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <h1 className="text-base font-semibold">Septem</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

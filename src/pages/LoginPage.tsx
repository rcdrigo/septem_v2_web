import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useSessionStore } from '@/stores/session';
import { ApiError } from '@/lib/api';
import { toast } from '@/stores/toast';
import { useDocumentTitle } from '@/lib/use-document-title';
import { PasswordChecklist, isPasswordValid } from '@/components/PasswordChecklist';
import { forgotPassword, resetPassword } from '@/lib/api/account';
import '@/styles/login.css';

/**
 * Página /login fora do AppShell — layout em duas colunas (proposta do dono,
 * 2026-07-11): painel institucional escuro à esquerda e o formulário à direita.
 *
 * O formulário é uma máquina de 4 passos (Fase 2):
 *   credenciais → [2fa] código do e-mail → entra
 *              └→ [esqueci] pede código → define nova senha → volta ao login
 */
type Step = 'credenciais' | '2fa' | 'esqueci' | 'redefinir';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReturn = searchParams.get('returnUrl');
  const returnUrl = requestedReturn?.startsWith('/') && !requestedReturn.startsWith('//') ? requestedReturn : '/';
  const tenant = useSessionStore((s) => s.tenant);
  const login = useSessionStore((s) => s.login);
  const completeTwoFactor = useSessionStore((s) => s.completeTwoFactor);
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const tenantName = tenant?.clienteNome?.trim() || 'Prefeitura Municipal';
  useDocumentTitle('Entrar');

  // Branding do tenant no /login acessado direto: o bootstrap só rodava no
  // AppShell, então o painel ficava no fallback "Septem" até logar.
  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  const [step, setStep] = useState<Step>('credenciais');
  const [identifier, setIdentifier] = useState('');   // e-mail OU CPF
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Aviso progressivo do bloqueio (o backend diz quantas tentativas restam).
  const [aviso, setAviso] = useState<string | null>(null);

  // 2FA / recuperação
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');

  useEffect(() => {
    if (status === 'authenticated') navigate(returnUrl, { replace: true });
  }, [status, navigate, returnUrl]);

  function limparFluxo() {
    setCode('');
    setNovaSenha('');
    setTrustDevice(false);
  }

  /** Traduz o erro do backend — o aviso de bloqueio precisa ser específico. */
  function tratarErro(err: unknown, fallback: string) {
    if (err instanceof ApiError) {
      const body = err.body as { error?: string; detail?: string; attemptsLeft?: number; lockedMinutes?: number } | undefined;
      if (body?.error === 'twofactor_send_failed') {
        setAviso(body.detail ?? 'Não foi possível enviar o código de verificação. Tente novamente.');
        return;
      }
      if (body?.error === 'account_locked') {
        setAviso(
          `Conta bloqueada por ${body.lockedMinutes} minuto${body.lockedMinutes === 1 ? '' : 's'} ` +
            'após tentativas seguidas de senha errada. Use "Esqueci minha senha" para liberar agora.',
        );
        return;
      }
      if (body?.error === 'invalid_credentials' && typeof body.attemptsLeft === 'number') {
        setAviso(
          `Usuário ou senha incorretos. ${body.attemptsLeft} tentativa${body.attemptsLeft === 1 ? '' : 's'} ` +
            'antes de a conta ser bloqueada.',
        );
        return;
      }
      if (body?.error === 'code_invalid' || body?.error === 'code_not_found') {
        setAviso('Código incorreto. Confira o e-mail e tente de novo.');
        return;
      }
      if (body?.error === 'code_expired') {
        setAviso('O código expirou. Peça um novo.');
        return;
      }
      if (body?.error === 'code_attempts_exceeded') {
        setAviso('Tentativas demais com este código. Peça um novo.');
        return;
      }
      if (err.status === 401) {
        setAviso('Usuário ou senha incorretos.');
        return;
      }
    }
    toast.error(fallback);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setAviso(null);
    try {
      const r = await login(identifier, password, keepConnected);
      if (r.kind === 'two-factor') {
        setMaskedEmail(r.maskedEmail);
        limparFluxo();
        setStep('2fa');
        return;
      }
      navigate(returnUrl, { replace: true });
    } catch (err) {
      tratarErro(err, 'Não foi possível entrar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setAviso(null);
    try {
      await completeTwoFactor(identifier, code, trustDevice, keepConnected);
      navigate(returnUrl, { replace: true });
    } catch (err) {
      tratarErro(err, 'Não foi possível validar o código.');
    } finally {
      setSubmitting(false);
    }
  }

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setAviso(null);
    try {
      const r = await forgotPassword(identifier);
      // Resposta idêntica exista ou não a conta — não entregamos quais contas existem.
      setMaskedEmail(r.maskedEmail ?? '');
      limparFluxo();
      setStep('redefinir');
    } catch {
      toast.error('Não foi possível enviar o código.');
    } finally {
      setSubmitting(false);
    }
  }

  async function redefinir(e: React.FormEvent) {
    e.preventDefault();
    if (!isPasswordValid(novaSenha)) {
      setAviso('A senha ainda não atende a todos os requisitos.');
      return;
    }
    setSubmitting(true);
    setAviso(null);
    try {
      await resetPassword(identifier, code, novaSenha);
      toast.success('Senha redefinida. Entre com a nova senha.');
      setPassword('');
      limparFluxo();
      setStep('credenciais');
    } catch (err) {
      tratarErro(err, 'Não foi possível redefinir a senha.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* ── Painel institucional (esquerda) ─────────────────────────────── */}
        <aside className="login-hero-panel" data-testid="login-hero"
          style={tenant?.heroImageUrl ? { backgroundImage: `url("${tenant.heroImageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          {/* Fundo do hero vindo dos Parâmetros do sistema (Fase 1): sobreposição
              escura mantém o texto legível por cima da imagem. */}
          {tenant?.heroImageUrl && <div className="login-hero-overlay bg-slate-900/75" aria-hidden="true" />}
          <div className="login-corner-bands login-corner-bands--top-right" aria-hidden="true">
            <i /><i /><i />
          </div>
          <div className="login-corner-bands login-corner-bands--bottom-left" aria-hidden="true">
            <i /><i /><i />
          </div>

          <div className="login-tenant-brand">
            <div>
              <strong>{tenantName}</strong>
              <span>Gestão integrada</span>
            </div>
          </div>

          <div className="login-hero-copy">
            <span className="login-hero-eyebrow">PROCESSOS &amp; COMPLIANCE</span>
            <h2>
              Processos claros,<br />
              conformidade em<br className="login-hero-title-break" /> cada decisão.
            </h2>
            {tenant?.systemDescription && (
              <p className="login-hero-descricao" data-testid="login-descricao">{tenant.systemDescription}</p>
            )}
          </div>

          <div className="login-hero-actions">
            <button type="button" className="login-hero-action">
              <strong>Precisa de ajuda?</strong>
              <span>Domine a plataforma com nosso guia.</span>
            </button>
            <button type="button" className="login-hero-action login-hero-action--wide">
              <strong>Consultar processo</strong>
              <span>Valide seu protocolo ou os documentos emitidos ao final dos processos.</span>
            </button>
          </div>
        </aside>

        {/* ── Formulário (direita) ─────────────────────────────────────────── */}
        <main className="login-form-panel" data-step={step}>
          <div className="login-mobile-brand">
            <strong>{tenantName}</strong>
          </div>

          {step === 'credenciais' && (
            <>
              <h1 className="text-3xl font-bold text-slate-900">Bem-vindo de volta</h1>
              <p className="mt-2 text-sm text-slate-500">Entre com seus dados para acessar o Septem.</p>

              <form onSubmit={entrar} className="mt-8 space-y-5" data-testid="form-credenciais">
                <Campo label="CPF ou e-mail" icon={Mail}>
                  <input
                    type="text"
                    required
                    autoFocus
                    name="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className={inputCls}
                    placeholder="usuario@prefeitura.gov.br ou 000.000.000-00"
                  />
                </Campo>

                <Campo label="Senha" icon={Lock}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputCls} pr-11`}
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
                </Campo>

                <Aviso texto={aviso} />

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
                    onClick={() => {
                      setAviso(null);
                      setStep('esqueci');
                    }}
                    className="text-sm text-slate-400 hover:text-slate-600"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <Enviar submitting={submitting}>Entrar</Enviar>

                <button
                  type="button"
                  onClick={() => toast.info('Solicite o acesso ao administrador do sistema do seu órgão.')}
                  className="block w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Solicitar acesso
                </button>
              </form>
            </>
          )}

          {step === '2fa' && (
            <>
              <ShieldCheck size={28} className="text-slate-900" />
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Confirme seu acesso</h1>
              <p className="mt-2 text-sm text-slate-500">
                Enviamos um código de 6 dígitos para <strong className="text-slate-700">{maskedEmail}</strong>.
              </p>

              <form onSubmit={confirmarCodigo} className="mt-8 space-y-5" data-testid="form-2fa">
                <CampoCodigo value={code} onChange={setCode} />
                <Aviso texto={aviso} />

                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="trustDevice"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-400 accent-slate-900"
                  />
                  Confiar neste dispositivo (não pedir código de novo)
                </label>

                <Enviar submitting={submitting}>Confirmar</Enviar>
                <Voltar onClick={() => { limparFluxo(); setAviso(null); setStep('credenciais'); }} />
              </form>
            </>
          )}

          {step === 'esqueci' && (
            <>
              <h1 className="text-3xl font-bold text-slate-900">Esqueci minha senha</h1>
              <p className="mt-2 text-sm text-slate-500">
                Informe seu CPF ou e-mail. Enviaremos um código para o e-mail cadastrado.
              </p>

              <form onSubmit={pedirCodigo} className="mt-8 space-y-5" data-testid="form-esqueci">
                <Campo label="CPF ou e-mail" icon={Mail}>
                  <input
                    type="text"
                    required
                    autoFocus
                    name="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className={inputCls}
                    placeholder="usuario@prefeitura.gov.br ou 000.000.000-00"
                  />
                </Campo>
                <Aviso texto={aviso} />
                <Enviar submitting={submitting}>Enviar código</Enviar>
                <Voltar onClick={() => { setAviso(null); setStep('credenciais'); }} />
              </form>
            </>
          )}

          {step === 'redefinir' && (
            <>
              <h1 className="text-3xl font-bold text-slate-900">Nova senha</h1>
              <p className="mt-2 text-sm text-slate-500">
                {maskedEmail
                  ? <>Digite o código enviado para <strong className="text-slate-700">{maskedEmail}</strong> e escolha a nova senha.</>
                  : 'Digite o código que você recebeu por e-mail e escolha a nova senha.'}
              </p>

              <form onSubmit={redefinir} className="mt-8 space-y-5" data-testid="form-redefinir">
                <CampoCodigo value={code} onChange={setCode} />

                <Campo label="Nova senha" icon={Lock}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    name="newPassword"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className={`${inputCls} pr-11`}
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
                </Campo>

                <PasswordChecklist password={novaSenha} />
                <Aviso texto={aviso} />

                <Enviar submitting={submitting} disabled={!isPasswordValid(novaSenha)}>
                  Redefinir senha
                </Enviar>
                <Voltar onClick={() => { limparFluxo(); setAviso(null); setStep('credenciais'); }} />
              </form>
            </>
          )}

          <p className="mt-10 text-center text-xs text-slate-400">
            Tecnologia <span className="font-semibold text-slate-500">Septem</span>
          </p>
        </main>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none';

function Campo({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
      <span className="relative block">
        <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        {children}
      </span>
    </label>
  );
}

function CampoCodigo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">Código de 6 dígitos</span>
      <input
        type="text"
        required
        autoFocus
        name="code"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg font-semibold tracking-[0.5em] focus:border-slate-900 focus:outline-none"
        placeholder="000000"
      />
    </label>
  );
}

/** Aviso de segurança (tentativas restantes, bloqueio, código errado). */
function Aviso({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p
      role="alert"
      data-testid="login-aviso"
      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
    >
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      {texto}
    </p>
  );
}

function Enviar({
  submitting,
  disabled,
  children,
}: {
  submitting: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={submitting || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
    >
      {submitting && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
    >
      <ArrowLeft size={15} /> Voltar ao login
    </button>
  );
}

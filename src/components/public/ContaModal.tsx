import { useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { confirmarCadastro, signupPublico } from '@/lib/api/catalog';
import { TurnstileWidget } from '@/components/public/TurnstileWidget';
import { ApiError } from '@/lib/api';
import { useSessionStore } from '@/stores/session';

type Etapa = 'login' | 'cadastro' | 'codigo';

/**
 * Cadastro e login do cidadão DENTRO da página do formulário (Fase 8, passos 7 e 8).
 *
 * <p>A confirmação é por CÓDIGO digitado aqui, não por link de e-mail: assim o cidadão
 * não sai da página e não perde o que já preencheu — que era a preocupação da
 * resposta 21 do dono, resolvida sem precisar de rascunho nem link de retorno.</p>
 */
export function ContaModal({ etapaInicial, siteKey, onClose }: {
  etapaInicial: Etapa; siteKey: string | null; onClose: () => void;
}) {
  const login = useSessionStore((s) => s.login);
  const [etapa, setEtapa] = useState<Etapa>(etapaInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', cpf: '', email: '', telefone: '', password: '' });
  const [codigo, setCodigo] = useState('');
  const campo = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  const detalhe = (e: unknown) =>
    (e instanceof ApiError ? (e.body as { detail?: string } | undefined)?.detail : null);

  async function entrar() {
    setOcupado(true); setErro(null);
    try {
      const r = await login(form.email, form.password, true);
      if (r.kind === 'two-factor') {
        // Conta com 2FA não cabe neste modal: a tela de login trata o desafio inteiro.
        setErro('Sua conta usa verificação em duas etapas. Entre pela tela de login.');
        return;
      }
      onClose();
    } catch (e) {
      setErro(detalhe(e) ?? 'Não foi possível entrar. Confira e-mail e senha.');
    } finally { setOcupado(false); }
  }

  async function cadastrar() {
    setOcupado(true); setErro(null);
    try {
      const r = await signupPublico({ ...form, turnstileToken: token });
      if (r.jaExiste) {
        // Não revelamos nada da conta existente — só oferecemos o caminho de entrar.
        setErro(r.detail);
        setEtapa('login');
        return;
      }
      setEtapa('codigo');
    } catch (e) {
      setErro(detalhe(e) ?? 'Não foi possível criar a conta.');
    } finally { setOcupado(false); }
  }

  async function confirmar() {
    setOcupado(true); setErro(null);
    try {
      await confirmarCadastro(form.email, codigo);
      // Entra pelo MESMO caminho do login normal: menos um jeito de autenticar para
      // manter, e a sessão nasce igual à de qualquer outra pessoa.
      await login(form.email, form.password, true);
      onClose();
    } catch (e) {
      setErro(detalhe(e) ?? 'Código inválido ou expirado.');
    } finally { setOcupado(false); }
  }

  const titulo = etapa === 'login' ? 'Entrar na conta'
    : etapa === 'cadastro' ? 'Criar conta' : 'Confirme seu e-mail';

  return (
    <Dialog open onClose={onClose} title={titulo} width="md">
      <div className="flex flex-col gap-3" data-testid={`conta-${etapa}`}>
        {erro && (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
             data-testid="conta-erro">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}

        {etapa === 'login' && (
          <>
            <Campo rotulo="E-mail" tipo="email" testid="conta-email" {...campo('email')} />
            <Campo rotulo="Senha" tipo="password" testid="conta-senha" {...campo('password')} />
            <Acao onClick={entrar} ocupado={ocupado} testid="conta-entrar">Entrar</Acao>
            <Alternar onClick={() => { setErro(null); setEtapa('cadastro'); }} testid="conta-ir-cadastro">
              Não tem conta? Criar agora
            </Alternar>
          </>
        )}

        {etapa === 'cadastro' && (
          <>
            <Campo rotulo="Nome completo" testid="conta-nome" {...campo('name')} />
            <Campo rotulo="CPF" testid="conta-cpf" {...campo('cpf')} />
            <Campo rotulo="E-mail" tipo="email" testid="conta-email" {...campo('email')} />
            <Campo rotulo="Telefone" testid="conta-telefone" {...campo('telefone')} />
            <Campo rotulo="Senha (mínimo 8 caracteres)" tipo="password" testid="conta-senha" {...campo('password')} />
            {siteKey && <TurnstileWidget siteKey={siteKey} onToken={setToken} />}
            <Acao onClick={cadastrar} ocupado={ocupado} desabilitado={!token} testid="conta-criar">
              Criar conta
            </Acao>
            <Alternar onClick={() => { setErro(null); setEtapa('login'); }} testid="conta-ir-login">
              Já tem conta? Entrar
            </Alternar>
          </>
        )}

        {etapa === 'codigo' && (
          <>
            <p className="text-sm text-slate-600">
              Enviamos um código de 6 dígitos para <strong>{form.email}</strong>. Digite-o aqui —
              você continua nesta página e não perde o que já preencheu.
            </p>
            {/* `conta-codigo-campo`, e não `conta-codigo`: o contêiner da etapa já usa
                `conta-${etapa}`, e dois elementos com o mesmo testid deixam qualquer
                sonda ambígua. */}
            <Campo rotulo="Código" testid="conta-codigo-campo"
                   value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <Acao onClick={confirmar} ocupado={ocupado} testid="conta-confirmar">Confirmar</Acao>
          </>
        )}
      </div>
    </Dialog>
  );
}

function Campo({ rotulo, tipo = 'text', testid, ...props }: {
  rotulo: string; tipo?: string; testid: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{rotulo}</span>
      <input type={tipo} data-testid={testid} autoComplete="off" {...props}
             className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-800" />
    </label>
  );
}

function Acao({ onClick, ocupado, desabilitado, testid, children }: {
  onClick: () => void; ocupado: boolean; desabilitado?: boolean; testid: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={ocupado || desabilitado} data-testid={testid}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
      {ocupado && <Loader2 size={15} className="animate-spin" />}{children}
    </button>
  );
}

function Alternar({ onClick, testid, children }: { onClick: () => void; testid: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
            className="text-sm text-slate-500 underline hover:text-slate-800">{children}</button>
  );
}

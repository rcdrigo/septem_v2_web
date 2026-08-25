import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Lock, Send, TriangleAlert } from 'lucide-react';
import { ReactForm, type ReactFormHandle } from '@/components/form/ReactForm';
import { TurnstileWidget } from '@/components/public/TurnstileWidget';
import { submitPublicService, usePublicService } from '@/lib/api/catalog';
import { ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';
import { ContaModal } from '@/components/public/ContaModal';
import { routes } from '@/lib/routes';

/**
 * Formulário PÚBLICO de um serviço (Fase 8), aberto pela Central e acessível sem login.
 *
 * Dois caminhos, decididos pelo servidor (`requiresLogin`):
 *  - serviço anônimo: preenche, resolve o captcha e envia;
 *  - serviço que exige conta: mostra o passo a passo e não envia até haver login.
 */
export function ServicoPublicoPage() {
  const { processKey } = useParams<{ processKey: string }>();
  const { data, isLoading, isError } = usePublicService(processKey);
  const tenant = useSessionStore((s) => s.tenant);
  const formRef = useRef<ReactFormHandle>(null);
  const [token, setToken] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<number | null>(null);
  const [conta, setConta] = useState<'login' | 'cadastro' | null>(null);
  const autenticado = useSessionStore((s) => s.status) === 'authenticated';

  useDocumentTitle(data?.name ?? 'Serviço');

  const schema = useMemo(() => {
    if (!data?.formSchema) return null;
    try { return JSON.parse(data.formSchema) as unknown; } catch { return null; }
  }, [data?.formSchema]);

  /**
   * Campos de anexo num serviço ANÔNIMO não têm como funcionar: o upload exige
   * autenticação. Em vez de deixar o visitante escolher um arquivo e o botão não
   * fazer nada, avisamos — e o dono decide se o serviço deve exigir conta.
   */
  const camposDeAnexo = useMemo(() => coletarAnexos(schema), [schema]);

  async function enviar() {
    if (!processKey) return;
    const { data: valores, errors } = formRef.current?.submit() ?? { data: {}, errors: {} };
    if (Object.keys(errors).length) { setErro('Preencha os campos obrigatórios.'); return; }

    setEnviando(true); setErro(null);
    try {
      const r = await submitPublicService(processKey, valores, token);
      setProtocolo(r.number);
    } catch (e) {
      const corpo = e instanceof ApiError ? (e.body as { detail?: string } | undefined) : undefined;
      setErro(corpo?.detail ?? 'Não foi possível enviar a requisição. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (isLoading) return <Moldura><p className="text-sm text-slate-500">Carregando…</p></Moldura>;
  if (isError || !data) {
    return (
      <Moldura>
        <p className="text-sm text-slate-600" data-testid="servico-indisponivel">
          Este serviço não está disponível.
        </p>
      </Moldura>
    );
  }

  if (protocolo !== null) {
    return (
      <Moldura>
        <div className="flex flex-col items-center gap-3 py-10 text-center" data-testid="servico-protocolo">
          <CheckCircle2 size={40} className="text-emerald-600" />
          <h2 className="text-xl font-bold text-slate-900">Requisição enviada</h2>
          <p className="text-sm text-slate-600">
            Guarde o número de protocolo: <strong className="tabular-nums">{protocolo}</strong>
          </p>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <h1 className="text-2xl font-bold text-slate-900" data-testid="servico-titulo">{data.name}</h1>
      {data.description && (
        <div className="mt-1 text-sm text-slate-500" dangerouslySetInnerHTML={{ __html: data.description }} />
      )}

      {/* Serviço que exige conta: o passo a passo entra aqui (modais na Fase 8, passo 7). */}
      {data.requiresLogin && !autenticado && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900"
             data-testid="servico-exige-login">
          <p className="flex items-start gap-2">
            <Lock size={16} className="mt-0.5 shrink-0" />
            <span><strong>Este serviço exige uma conta.</strong> Você pode preencher agora — nada se perde.</span>
          </p>
          {/* O passo a passo pedido no requisito, e tudo acontece NESTA página. */}
          <ol className="mt-2 ml-6 list-decimal space-y-0.5 text-[13px]">
            <li>Crie sua conta com nome, CPF, e-mail e telefone.</li>
            <li>Digite aqui o código de 6 dígitos que enviaremos por e-mail.</li>
            <li>Pronto: envie a requisição sem sair desta tela.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setConta('cadastro')} data-testid="servico-criar-conta"
                    className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Criar conta
            </button>
            <button type="button" onClick={() => setConta('login')} data-testid="servico-entrar"
                    className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Já tenho conta
            </button>
          </div>
        </div>
      )}

      {data.requiresLogin && autenticado && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
           data-testid="servico-logado">
          Você está solicitando como cidadão. Pode enviar a requisição.
        </p>
      )}

      {camposDeAnexo.length > 0 && !data.requiresLogin && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
             data-testid="servico-anexo-sem-conta">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            O envio de arquivos ({camposDeAnexo.join(', ')}) exige uma conta. Sem cadastro, este
            serviço não consegue receber anexos.
          </span>
        </div>
      )}

      {schema ? (
        <div className="mt-5">
          <ReactForm ref={formRef} schema={schema} />
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-500">Este serviço não tem formulário publicado.</p>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5">
        {!data.requiresLogin && tenant?.turnstileSiteKey && (
          <TurnstileWidget siteKey={tenant.turnstileSiteKey} onToken={setToken} />
        )}
        {!data.requiresLogin && !tenant?.turnstileSiteKey && (
          <p className="text-sm text-amber-700" data-testid="servico-sem-captcha">
            O envio sem cadastro está indisponível no momento.
          </p>
        )}

        {erro && (
          <p className="flex items-start gap-2 text-sm text-rose-600" data-testid="servico-erro">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}

        <button
          type="button" onClick={enviar} data-testid="servico-enviar"
          // Exige conta → bloqueado até haver login (os modais chegam no passo 7).
          // Anônimo → bloqueado até o captcha devolver um token.
          // Exige conta → liberado depois do login (pelos modais desta página).
          // Anônimo → liberado quando o captcha devolve um token.
          disabled={enviando || (data.requiresLogin ? !autenticado : !token)}
          className="inline-flex items-center justify-center gap-2 self-start rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {enviando ? 'Enviando…' : 'Enviar requisição'}
        </button>
      </div>
      {conta && (
        <ContaModal etapaInicial={conta} siteKey={tenant?.turnstileSiteKey ?? null}
                    onClose={() => setConta(null)} />
      )}
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50" data-testid="servico-publico">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link to={routes.externalServices}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
              data-testid="servico-voltar">
          <ArrowLeft size={16} /> Central de serviços
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

/** Rótulos dos campos de anexo do schema (inclusive dentro de grupos/listas). */
function coletarAnexos(schema: unknown): string[] {
  const achados: string[] = [];
  const andar = (comps: unknown) => {
    if (!Array.isArray(comps)) return;
    for (const c of comps as { type?: string; label?: string; key?: string; components?: unknown }[]) {
      if (c?.type === 'filepicker') achados.push(c.label || c.key || 'anexo');
      andar(c?.components);
    }
  };
  andar((schema as { components?: unknown } | null)?.components);
  return achados;
}

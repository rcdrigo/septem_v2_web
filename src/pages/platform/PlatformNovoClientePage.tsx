import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import {
  PURPOSE_LABEL,
  useCreateClient,
  useFeatureCatalog,
  type NovoAmbienteInput,
} from '@/lib/api/platform-clients';
import { usePlatformCatalog } from '@/lib/api/platform-catalog';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Assistente de cadastro de cliente (ADM-02, Fase 11a).
 *
 * Quatro etapas: identificação → ambientes (URLs e bancos) → funcionalidades e dados
 * fictícios → primeiro admin e revisão.
 *
 * Duas regras moldam a tela:
 *  - **produção e homologação aparecem SEPARADAS**, cada uma com seu banco, seu endereço
 *    e sua própria opção de dados fictícios (a homologação não herda a da produção);
 *  - **produção não oferece dados fictícios** — a spec proíbe, e o servidor recusa de
 *    qualquer jeito. Oferecer e depois recusar seria pedir para a pessoa errar.
 *
 * O preenchimento é preservado em erro: nada de mandar recomeçar por causa de um nome
 * de banco repetido.
 */
type Etapa = 0 | 1 | 2 | 3;

const ETAPAS = ['Identificação', 'Ambientes', 'Funcionalidades', 'Administrador'];

export function PlatformNovoClientePage() {
  const navigate = useNavigate();
  const criar = useCreateClient();
  const catalogo = useFeatureCatalog();
  const processos = usePlatformCatalog();
  useDocumentTitle('Novo cliente · área central');

  const [etapa, setEtapa] = useState<Etapa>(0);
  const [nome, setNome] = useState('');
  const [adminNome, setAdminNome] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [comHomologacao, setComHomologacao] = useState(true);
  const [producao, setProducao] = useState<NovoAmbienteInput>({ seedDummyData: false });
  const [homologacao, setHomologacao] = useState<NovoAmbienteInput>({ seedDummyData: true });
  const [ligadas, setLigadas] = useState<string[] | null>(null);
  const [processosEscolhidos, setProcessosEscolhidos] = useState<string[]>([]);
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const implementadas = useMemo(
    () => (catalogo.data?.items ?? []).filter((f) => f.implemented).map((f) => f.key),
    [catalogo.data],
  );
  const selecionadas = ligadas ?? implementadas;

  function alternar(key: string) {
    setLigadas((atual) => {
      const base = atual ?? implementadas;
      return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
    });
  }

  async function enviar() {
    setErros({});
    setAviso(null);
    try {
      const r = await criar.mutateAsync({
        name: nome.trim(),
        adminName: adminNome.trim() || undefined,
        adminEmail: adminEmail.trim() || undefined,
        features: selecionadas,
        catalogProcessKeys: processosEscolhidos.length ? processosEscolhidos : undefined,
        production: limpar(producao),
        staging: comHomologacao ? limpar(homologacao) : null,
      });
      // Vai direto para o detalhe: é lá que os cartões de progresso acompanham.
      navigate(routes.platformClient(r.clientId));
    } catch (e) {
      if (e instanceof ApiError) {
        const corpo = e.body as { detail?: string; fieldErrors?: Record<string, string[]> } | undefined;
        setErros(corpo?.fieldErrors ?? {});
        setAviso(corpo?.detail ?? 'Não foi possível cadastrar o cliente.');
        // Volta para a etapa do problema, sem perder nada do que foi digitado.
        if (corpo?.fieldErrors?.production || corpo?.fieldErrors?.staging) setEtapa(1);
        else setEtapa(0);
        return;
      }
      setAviso('Não foi possível cadastrar o cliente.');
    }
  }

  const podeAvancar = etapa !== 0 || nome.trim().length > 1;

  return (
    <section className="max-w-3xl">
      <Link to={routes.platformClients} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>
      <h1 className="text-lg font-semibold text-slate-900">Novo cliente</h1>

      <ol className="mt-4 flex flex-wrap gap-2 text-xs" data-testid="assistente-etapas">
        {ETAPAS.map((rotulo, i) => (
          <li
            key={rotulo}
            aria-current={i === etapa ? 'step' : undefined}
            className={`rounded-full px-3 py-1 ${
              i === etapa ? 'bg-slate-900 text-white' : i < etapa ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {i < etapa && <Check className="mr-1 inline h-3 w-3" />}
            {rotulo}
          </li>
        ))}
      </ol>

      {aviso && (
        <p role="alert" data-testid="assistente-erro" className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {aviso}
          {Object.entries(erros).map(([campo, lista]) => (
            <span key={campo} className="mt-1 block text-xs">
              {lista.join(' ')}
            </span>
          ))}
        </p>
      )}

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        {etapa === 0 && (
          <div className="grid gap-3">
            <Campo label="Nome do cliente" htmlFor="nome">
              <input
                id="nome"
                name="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Prefeitura de..."
                className={inputCls}
              />
            </Campo>
            <p className="text-xs text-slate-500">
              O nome exibido de cada ambiente começa como <strong>Septem</strong> e pode ser trocado depois.
            </p>
          </div>
        )}

        {etapa === 1 && (
          <div className="grid gap-5">
            <AmbienteCampos
              titulo="Produção"
              testid="producao"
              valor={producao}
              aoMudar={setProducao}
              permiteDummy={false}
              sugestaoId={sugerirId(nome)}
            />

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="comHomologacao"
                checked={comHomologacao}
                onChange={(e) => setComHomologacao(e.target.checked)}
              />
              Criar também o ambiente de homologação
            </label>

            {comHomologacao && (
              <AmbienteCampos
                titulo="Homologação"
                testid="homologacao"
                valor={homologacao}
                aoMudar={setHomologacao}
                permiteDummy
                sugestaoId={`${sugerirId(nome)}-hml`}
              />
            )}
          </div>
        )}

        {etapa === 2 && (
          <div className="grid gap-3">
            <p className="text-sm text-slate-600">
              As funcionalidades marcadas valem para <strong>os dois ambientes</strong>.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="assistente-funcionalidades">
              {(catalogo.data?.items ?? []).map((f) => (
                <li key={f.key}>
                  <label className={`flex items-start gap-2 rounded-md border p-2 text-sm ${f.implemented ? 'border-slate-200' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
                    <input
                      type="checkbox"
                      disabled={!f.implemented}
                      checked={selecionadas.includes(f.key)}
                      onChange={() => alternar(f.key)}
                      data-testid={`assistente-feature-${f.key}`}
                    />
                    <span>
                      {f.name}
                      {!f.implemented && <span className="ml-1 text-xs">(indisponível)</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {/*
              Processos do catálogo (Fase 12). Só entram os que TÊM versão publicada: o
              provisionamento não instalaria os outros, e oferecê-los aqui viraria um
              ambiente nascendo sem o que foi pedido.
            */}
            <div className="mt-2 border-t border-slate-200 pt-3">
              <p className="text-sm font-medium text-slate-800">Processos do catálogo</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Instalados nos dois ambientes durante o provisionamento. O cliente pode
                personalizá-los depois — a origem continua registrada.
              </p>
              {(processos.data?.items ?? []).filter((p) => p.versions.length > 0).length === 0 ? (
                <p
                  data-testid="assistente-catalogo-vazio"
                  className="mt-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500"
                >
                  Nenhum processo do catálogo tem versão publicada. O ambiente nasce sem
                  processos prontos — o que é um ambiente válido.
                </p>
              ) : (
                <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="assistente-catalogo">
                  {(processos.data?.items ?? [])
                    .filter((p) => p.versions.length > 0)
                    .map((p) => {
                      const ultima = p.versions[0];
                      return (
                        <li key={p.id}>
                          <label className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-sm">
                            <input
                              type="checkbox"
                              checked={processosEscolhidos.includes(p.key)}
                              onChange={() =>
                                setProcessosEscolhidos((atual) =>
                                  atual.includes(p.key)
                                    ? atual.filter((k) => k !== p.key)
                                    : [...atual, p.key],
                                )
                              }
                              data-testid={`assistente-processo-${p.key}`}
                            />
                            <span>
                              {p.name}
                              <span className="ml-1 text-xs text-slate-500">v{ultima.version}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="grid gap-3">
            <Campo label="Nome do administrador" htmlFor="adminNome">
              <input id="adminNome" name="adminNome" value={adminNome} onChange={(e) => setAdminNome(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="E-mail do administrador" htmlFor="adminEmail">
              <input id="adminEmail" name="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={inputCls} />
            </Campo>
            <p className="text-xs text-slate-500">
              Ele recebe um convite por e-mail <strong>depois que o ambiente estiver pronto</strong> e define a
              própria senha. Nenhuma senha é criada aqui.
            </p>

            <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm" data-testid="assistente-revisao">
              <p className="font-medium text-slate-900">Revisão</p>
              <ul className="mt-1 grid gap-0.5 text-xs text-slate-600">
                <li>Cliente: <strong>{nome || '—'}</strong></li>
                <li>
                  Processos do catálogo:{' '}
                  <strong data-testid="revisao-processos">
                    {processosEscolhidos.length ? processosEscolhidos.join(', ') : 'nenhum'}
                  </strong>
                </li>
                <li>{PURPOSE_LABEL.production}: {producao.host || `${sugerirId(nome)}.septemcompliance.com`}</li>
                {comHomologacao && (
                  <li>
                    {PURPOSE_LABEL.staging}: {homologacao.host || `${sugerirId(nome)}-hml.septemcompliance.com`}
                    {homologacao.seedDummyData && ' · com dados fictícios'}
                  </li>
                )}
                <li>{selecionadas.length} funcionalidade(s) contratada(s)</li>
              </ul>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Integrações (SMTP, armazenamento, captcha) ficam pendentes e podem ser configuradas depois —
                elas não impedem o ambiente de ficar pronto.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setEtapa((e) => (e > 0 ? ((e - 1) as Etapa) : e))}
          disabled={etapa === 0}
          className="min-h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-700 disabled:opacity-40"
        >
          Voltar
        </button>

        {etapa < 3 ? (
          <button
            type="button"
            data-testid="assistente-avancar"
            onClick={() => setEtapa((e) => ((e + 1) as Etapa))}
            disabled={!podeAvancar}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            Avançar <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            data-testid="assistente-cadastrar"
            onClick={() => void enviar()}
            disabled={criar.isPending || nome.trim().length < 2}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {criar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Cadastrar e provisionar
          </button>
        )}
      </div>
    </section>
  );
}

function AmbienteCampos({ titulo, testid, valor, aoMudar, permiteDummy, sugestaoId }: {
  titulo: string; testid: string; valor: NovoAmbienteInput;
  aoMudar: (v: NovoAmbienteInput) => void; permiteDummy: boolean; sugestaoId: string;
}) {
  return (
    <fieldset className="rounded-md border border-slate-200 p-3" data-testid={`ambiente-${testid}`}>
      <legend className="px-1 text-sm font-medium text-slate-900">{titulo}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo label="Identificador" htmlFor={`${testid}-id`}>
          <input
            id={`${testid}-id`}
            name={`${testid}-id`}
            value={valor.tenantId ?? ''}
            onChange={(e) => aoMudar({ ...valor, tenantId: e.target.value })}
            placeholder={sugestaoId}
            className={inputCls}
          />
        </Campo>
        <Campo label="Banco de dados" htmlFor={`${testid}-db`} dica="Editável só agora: depois de criado, é imutável.">
          <input
            id={`${testid}-db`}
            name={`${testid}-db`}
            value={valor.dbName ?? ''}
            onChange={(e) => aoMudar({ ...valor, dbName: e.target.value })}
            placeholder="sugerido automaticamente"
            className={inputCls}
          />
        </Campo>
      </div>

      {permiteDummy ? (
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            data-testid={`${testid}-dummy`}
            checked={valor.seedDummyData}
            onChange={(e) => aoMudar({ ...valor, seedDummyData: e.target.checked })}
          />
          Semear dados fictícios
        </label>
      ) : (
        <p className="mt-2 text-xs text-slate-500" data-testid={`${testid}-sem-dummy`}>
          Produção não recebe dados fictícios.
        </p>
      )}
    </fieldset>
  );
}

function Campo({ label, htmlFor, dica, children }: { label: string; htmlFor: string; dica?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {dica && <span className="text-[0.7rem] text-slate-400">{dica}</span>}
    </label>
  );
}

const inputCls =
  'h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-slate-500';

/** Some com o que não serve: campo vazio significa "use a sugestão do servidor". */
function limpar(a: NovoAmbienteInput): NovoAmbienteInput {
  return {
    tenantId: a.tenantId?.trim() || undefined,
    dbName: a.dbName?.trim() || undefined,
    host: a.host?.trim() || undefined,
    displayName: a.displayName?.trim() || undefined,
    seedDummyData: a.seedDummyData,
  };
}

function sugerirId(nome: string) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cliente';
}

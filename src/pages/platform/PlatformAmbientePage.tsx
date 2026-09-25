import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Loader2, PauseCircle } from 'lucide-react';
import {
  useAddDomain,
  useEnvironmentDomains,
  useVerifyDomain,
  useEnvironmentIntegrations,
  useUpdateEnvironment,
  useEnvironmentFeatures,
  useFeatureCatalog,
  useSaveFeatures,
  MODE_LABEL,
  PURPOSE_LABEL,
  STATE_LABEL,
  useChangeMode,
  useDecideSchedule,
  useOverdueSchedules,
  usePlatformEnvironment,
} from '@/lib/api/platform-clients';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Detalhe do ambiente na área central: é daqui que o super admin bloqueia novas
 * requisições, inativa e reativa (ADM-07).
 *
 * Cada ação diz o que acontece com **as requisições existentes** — é a diferença entre
 * os dois bloqueios, e quem decide precisa vê-la antes de clicar, não depois.
 */
export function PlatformAmbientePage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const ambiente = usePlatformEnvironment(tenantId);
  const trocar = useChangeMode(tenantId ?? '');
  const vencidas = useOverdueSchedules(tenantId, !!ambiente.data && ambiente.data.operatingMode !== 'inactive');
  const decidir = useDecideSchedule(tenantId ?? '');
  const [aviso, setAviso] = useState<string | null>(null);
  const catalogo = useFeatureCatalog();
  const integracoes = useEnvironmentIntegrations(tenantId);
  const atualizar = useUpdateEnvironment(tenantId ?? '');
  const [nomeExibido, setNomeExibido] = useState<string | null>(null);
  const dominios = useEnvironmentDomains(tenantId);
  const adicionarDominio = useAddDomain(tenantId ?? '');
  const verificarDominio = useVerifyDomain(tenantId ?? '');
  const [novoHost, setNovoHost] = useState('');
  const [instrucao, setInstrucao] = useState<string | null>(null);
  const contratadas = useEnvironmentFeatures(tenantId);
  const salvarFeatures = useSaveFeatures(tenantId ?? '');
  useDocumentTitle(ambiente.data ? `${ambiente.data.displayName} · área central` : 'Ambiente · área central');

  async function aplicar(mode: string) {
    setAviso(null);
    try {
      const r = await trocar.mutateAsync({ mode, expectedVersion: ambiente.data?.version });
      if (r.overdueSchedules > 0)
        setAviso(`${r.overdueSchedules} ocorrência(s) venceram durante a inativação e estão esperando sua decisão.`);
    } catch {
      setAviso('Não foi possível trocar o modo. Recarregue a página e tente de novo.');
    }
  }

  const modo = ambiente.data?.operatingMode;
  const ligadas = new Set(contratadas.data?.enabled ?? []);

  async function alternarFuncionalidade(key: string, ligar: boolean) {
    setAviso(null);
    const novo = new Set(ligadas);
    if (ligar) novo.add(key); else novo.delete(key);
    try {
      await salvarFeatures.mutateAsync({
        enabled: [...novo],
        expectedVersion: contratadas.data?.version,
      });
    } catch {
      setAviso('Não foi possível salvar as funcionalidades. Recarregue a página e tente de novo.');
    }
  }

  return (
    <section>
      <Link to={routes.platformClients} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      {ambiente.isLoading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      )}

      {ambiente.data && (
        <>
          <h1 className="text-lg font-semibold text-slate-900" data-testid="ambiente-nome">
            {ambiente.data.displayName || ambiente.data.tenantId}
          </h1>
          <p className="text-sm text-slate-500">
            {ambiente.data.clientName} · {PURPOSE_LABEL[ambiente.data.purpose] ?? ambiente.data.purpose} ·{' '}
            {STATE_LABEL[ambiente.data.provisioningState] ?? ambiente.data.provisioningState}
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-2" data-testid="ambiente-nome-exibido">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Nome exibido</span>
              <input
                name="displayName"
                value={nomeExibido ?? ambiente.data.displayName}
                onChange={(e) => setNomeExibido(e.target.value)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </label>
            <button
              type="button"
              data-testid="salvar-nome-exibido"
              disabled={atualizar.isPending || nomeExibido === null || nomeExibido === ambiente.data.displayName}
              onClick={() => void atualizar.mutateAsync({
                displayName: nomeExibido ?? undefined,
                expectedVersion: ambiente.data?.version,
              }).then(() => setNomeExibido(null)).catch(() => setAviso('Não foi possível salvar o nome exibido.'))}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Salvar
            </button>
            <span className="text-xs text-slate-400">
              O banco de dados não muda depois de criado.
            </span>
          </div>

          {/* M-A14: integração pendente é uma pendência DISTINTA — não impede o ambiente
              de estar pronto, e a tela precisa deixar isso claro. */}
          {(integracoes.data?.items.filter((i) => i.status !== 'configured').length ?? 0) > 0 && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2" data-testid="integracoes-pendentes">
              <p className="text-sm font-medium text-amber-900">Integrações a configurar</p>
              <p className="mt-0.5 text-xs text-amber-800">
                Não impedem o ambiente de funcionar — mas as funcionalidades que dependem delas só
                operam depois de configuradas.
              </p>
              <ul className="mt-1 text-xs text-amber-900">
                {integracoes.data!.items.filter((i) => i.status !== 'configured').map((i) => (
                  <li key={i.kind} data-testid={`pendencia-${i.kind}`}>• {i.name}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-4 text-sm" data-testid="ambiente-modo">
            Modo atual: <strong>{MODE_LABEL[modo ?? ''] ?? modo}</strong>
          </p>

          {aviso && (
            <p role="alert" data-testid="ambiente-aviso" className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {aviso}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <AcaoModo
              ativa={modo === 'active'}
              titulo="Ativo"
              descricao="Tudo funcionando: novas requisições e as existentes."
              icone={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => void aplicar('active')}
              testid="modo-active"
              ocupado={trocar.isPending}
            />
            <AcaoModo
              ativa={modo === 'new_requests_blocked'}
              titulo="Bloquear novas requisições"
              descricao="As requisições já abertas continuam; só a abertura de novas para."
              icone={<PauseCircle className="h-4 w-4" />}
              onClick={() => void aplicar('new_requests_blocked')}
              testid="modo-new_requests_blocked"
              ocupado={trocar.isPending}
            />
            <AcaoModo
              ativa={modo === 'inactive'}
              titulo="Inativar completamente"
              descricao="Ninguém acessa o ambiente e nenhum efeito automático dispara."
              icone={<Ban className="h-4 w-4" />}
              onClick={() => void aplicar('inactive')}
              testid="modo-inactive"
              ocupado={trocar.isPending}
              perigosa
            />
          </div>

          <div className="mt-8" data-testid="dominios">
            <h2 className="text-sm font-semibold text-slate-900">Endereços</h2>
            <p className="mt-1 text-xs text-slate-500">
              O endereço da plataforma funciona desde o primeiro dia. Um domínio próprio só passa a
              valer <strong>depois de verificado</strong> — e verificar é conferir que ele responde
              este ambiente, não apenas que existe.
            </p>

            <p className="mt-2 text-xs text-slate-600" data-testid="host-da-plataforma">
              Endereço da plataforma: <strong>{dominios.data?.platformHost ?? ambiente.data.host}</strong>
            </p>

            <ul className="mt-2 grid gap-2" data-testid="lista-dominios">
              {(dominios.data?.items ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <strong className="font-medium text-slate-900">{d.host}</strong>
                    <span
                      data-testid={`dominio-status-${d.host}`}
                      className={`ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${
                        d.status === 'verified' ? 'bg-emerald-100 text-emerald-800'
                          : d.status === 'broken' ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {d.status === 'verified' ? 'Verificado' : d.status === 'broken' ? 'Parou de responder' : 'Pendente'}
                    </span>
                    {d.certificateExpiringSoon && (
                      <span className="ml-2 text-[0.7rem] text-amber-700">certificado perto de vencer</span>
                    )}
                    {d.lastError && <span className="mt-0.5 block text-xs text-slate-500">{d.lastError}</span>}
                  </span>
                  <button
                    type="button"
                    data-testid={`verificar-${d.host}`}
                    disabled={verificarDominio.isPending}
                    onClick={() => void verificarDominio.mutateAsync(d.id)}
                    className="min-h-9 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Verificar
                  </button>
                </li>
              ))}
              {(dominios.data?.items.length ?? 0) === 0 && (
                <li className="text-xs text-slate-400">Nenhum domínio próprio cadastrado.</li>
              )}
            </ul>

            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Domínio próprio</span>
                <input
                  name="novoDominio"
                  value={novoHost}
                  onChange={(e) => setNovoHost(e.target.value)}
                  placeholder="servicos.prefeitura.gov.br"
                  className="h-10 w-72 max-w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <button
                type="button"
                data-testid="adicionar-dominio"
                disabled={adicionarDominio.isPending || novoHost.trim().length < 4}
                onClick={() => void adicionarDominio.mutateAsync(novoHost.trim())
                  .then((r) => {
                    setNovoHost('');
                    setInstrucao(`Crie um ${r.dns.type} de ${r.dns.name} para ${r.dns.value}. ${r.dns.note}`);
                  })
                  .catch(() => setAviso('Não foi possível cadastrar o domínio.'))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Adicionar
              </button>
            </div>

            {instrucao && (
              <p data-testid="instrucao-dns" className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {instrucao}
              </p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate-900">Funcionalidades contratadas</h2>
            <p className="mt-1 text-xs text-slate-500">
              Desabilitar é sempre permitido: os processos que usam a funcionalidade passam a
              ser bloqueados no ponto de uso, e <strong>nenhum dado é apagado</strong>.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="funcionalidades">
              {(catalogo.data?.items ?? []).map((f) => {
                const ativa = ligadas.has(f.key);
                return (
                  <li
                    key={f.key}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                        {f.name}
                        {!f.implemented && (
                          <span
                            data-testid={`indisponivel-${f.key}`}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500"
                          >
                            Indisponível
                          </span>
                        )}
                      </span>
                      {f.description && <span className="mt-0.5 block text-xs text-slate-500">{f.description}</span>}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ativa}
                      aria-label={`${ativa ? 'Desabilitar' : 'Habilitar'} ${f.name}`}
                      data-testid={`feature-${f.key}`}
                      disabled={salvarFeatures.isPending}
                      onClick={() => void alternarFuncionalidade(f.key, !ativa)}
                      className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
                        ativa ? 'bg-emerald-500' : 'bg-slate-300'
                      } disabled:opacity-60`}
                    >
                      <span
                        className={`block h-5 w-5 rounded-full bg-white transition ${ativa ? 'ml-5' : 'ml-0.5'}`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {(vencidas.data?.items.length ?? 0) > 0 && (
            <div className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Ocorrências vencidas durante a inativação
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Nada foi disparado. Decida uma a uma: executar envia o alerta; descartar fecha a ocorrência.
              </p>
              <ul className="mt-3 grid gap-2" data-testid="ocorrencias-vencidas">
                {vencidas.data!.items.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <strong className="font-medium text-slate-900">{o.taskName}</strong>
                      <span className="text-slate-500"> · requisição nº {o.executionNumber}</span>
                    </span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void decidir.mutateAsync({ id: o.id, decision: 'execute' })}
                        className="min-h-9 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Executar
                      </button>
                      <button
                        type="button"
                        onClick={() => void decidir.mutateAsync({ id: o.id, decision: 'discard' })}
                        className="min-h-9 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Descartar
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AcaoModo({ ativa, titulo, descricao, icone, onClick, testid, ocupado, perigosa }: {
  ativa: boolean; titulo: string; descricao: string; icone: React.ReactNode;
  onClick: () => void; testid: string; ocupado: boolean; perigosa?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ativa || ocupado}
      data-testid={testid}
      aria-pressed={ativa}
      className={`flex h-full flex-col gap-1 rounded-lg border p-3 text-left text-sm transition ${
        ativa
          ? 'border-slate-900 bg-slate-900 text-white'
          : perigosa
            ? 'border-red-200 bg-white text-red-700 hover:border-red-400'
            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
      } disabled:cursor-default`}
    >
      <span className="flex items-center gap-1.5 font-medium">{icone}{titulo}</span>
      <span className={`text-xs ${ativa ? 'text-slate-300' : 'text-slate-500'}`}>{descricao}</span>
    </button>
  );
}

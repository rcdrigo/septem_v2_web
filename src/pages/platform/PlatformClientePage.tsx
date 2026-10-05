import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { CartaoProvisionamento } from '@/components/platform/CartaoProvisionamento';
import { useAdminInvites, useResendInvite, usePlatformClientMetrics, usePlatformClientHistory, useSetPlatformClientStatus } from '@/lib/api/platform-clients';
import {
  MODE_LABEL,
  PURPOSE_LABEL,
  STATE_LABEL,
  usePlatformClient,
} from '@/lib/api/platform-clients';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';
import { platformApi } from '@/lib/platform-api';
import type { OperationDetail } from '@/lib/api/platform-clients';

/**
 * Detalhe do cliente e seus ambientes. Cliente, finalidade e modo aparecem em todo
 * cartão porque a spec exige que apareçam "em todos os detalhes e confirmações" —
 * é o que evita agir no ambiente errado.
 */
export function PlatformClientePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // Enquanto houver operação em andamento, o detalhe se atualiza sozinho: o ambiente
  // aparece na tela no momento em que o job o reserva.
  const { data, isLoading, isError, error } = usePlatformClient(id);
  const convites = useAdminInvites(id);
  const metrics = usePlatformClientMetrics(id);
  const history = usePlatformClientHistory(id);
  const changeStatus = useSetPlatformClientStatus(id ?? '');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [dismissedOperations, setDismissedOperations] = useState<string[]>([]);
  const [trackedOperations, setTrackedOperations] = useState<string[]>(() =>
    Array.isArray(location.state?.provisioningOperationIds)
      ? location.state.provisioningOperationIds.filter((value: unknown) => typeof value === 'string') : []);
  const reenviar = useResendInvite(id ?? '');
  useDocumentTitle(data ? `${data.name} · área central` : 'Cliente · área central');

  const naoEncontrado = isError && (error as { status?: number } | undefined)?.status === 404;
  const environments = data?.environments ?? [];
  const provisioningTitle = (purpose: string) => purpose === 'staging'
    ? 'Ambiente de homologação' : purpose === 'demo' ? 'Ambiente de demonstração' : 'Ambiente de produção';
  const operations = data ? [
    ...(data.pendingOperations ?? []).map((operation) => ({
      operationId: operation.operationId,
      title: provisioningTitle(operation.purpose ?? (operation.target.startsWith('hml-') || operation.target.endsWith('-hml') ? 'staging' : 'production')),
      url: operation.host ? 'https://' + operation.host : undefined,
      status: operation.status,
    })),
    ...environments.filter((environment) => environment.operationId)
      .map((environment) => ({
        operationId: environment.operationId!,
        title: provisioningTitle(environment.purpose),
        url: environment.url || 'https://' + environment.host,
        status: environment.provisioningState,
      })),
  ].filter((operation, index, all) => all.findIndex((candidate) => candidate.operationId === operation.operationId) === index) : [];
  const operationQueries = useQueries({ queries: operations.map((operation) => ({
    queryKey: ['platform', 'operations', operation.operationId],
    queryFn: () => platformApi.get<OperationDetail>(`/operations/${operation.operationId}`),
    refetchInterval: (query: { state: { data?: OperationDetail } }) => {
      const status = query.state.data?.status;
      return !status || status === 'queued' || status === 'running' ? 3000 : false;
    },
  })) });
  const provisioningRunning = operationQueries.some((query, index) => {
    const status = query.data?.status ?? operations[index]?.status;
    return status === 'queued' || status === 'running';
  });
  const provisioningFailed = operationQueries.some((query, index) =>
    (query.data?.status ?? operations[index]?.status) === 'failed');
  const hasUnfinishedOperations = operations.some((operation, index) => {
    const status = operationQueries[index]?.data?.status ?? operation.status;
    return status !== 'ready' && status !== 'completed';
  });
  const operationIds = operations.map((operation) => operation.operationId).join('|');
  useEffect(() => {
    if (!hasUnfinishedOperations) return;
    const ids = operationIds.split('|').filter(Boolean);
    // A conclusão de um ambiente preserva o cartão até o acompanhamento ser fechado.
    setTrackedOperations((current) => ids.every((id) => current.includes(id))
      ? current : [...new Set([...current, ...ids])]);
  }, [hasUnfinishedOperations, operationIds]);
  const modalOperations = operations.filter((operation) => trackedOperations.includes(operation.operationId)
    && (provisioningRunning || !dismissedOperations.includes(operation.operationId)));

  return (
    <section>
      <Link to={routes.platformClients} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      )}

      {naoEncontrado && (
        <p data-testid="platform-cliente-404" className="rounded-md border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
          Cliente não encontrado.
        </p>
      )}

      {isError && !naoEncontrado && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Não foi possível carregar este cliente.
        </p>
      )}

      {data && (
        <>
          <Dialog
            open={modalOperations.length > 0}
            onClose={() => {
              setDismissedOperations(operations.map((operation) => operation.operationId));
              navigate(location.pathname + location.search + location.hash, { replace: true, state: null });
            }}
            title="Provisionamento de ambiente"
            width="lg"
            dismissible={!provisioningRunning}
            footer={provisioningRunning
              ? <span className="mr-auto text-xs text-slate-500">Mantenha esta janela aberta enquanto uma etapa estiver em execução.</span>
              : <span className="mr-auto text-xs text-slate-500">{provisioningFailed ? 'Há uma operação com falha. Retome pelo cartão de progresso.' : 'Provisionamento concluído. Abra os ambientes ou feche esta janela.'}</span>}
          >
            <p className="text-sm text-slate-600">O progresso é salvo no servidor e continuará acompanhado se você atualizar a página.</p>
            <div className="mt-4 grid gap-3" data-testid="provisioning-modal-content">
              {modalOperations.map((operation) => <CartaoProvisionamento key={operation.operationId} operationId={operation.operationId} titulo={operation.title} environmentUrl={operation.url} />)}
            </div>
            {provisioningRunning && <span className="sr-only" data-testid="provisioning-modal-not-dismissible">Fechamento indisponível durante a execução</span>}
            {!provisioningRunning && <span className="sr-only" data-testid="fechar-modal-provisionamento">Você pode fechar o acompanhamento</span>}
          </Dialog>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div><h1 className="text-lg font-semibold text-slate-900" data-testid="platform-cliente-nome">{data.name}</h1><p className="text-sm text-slate-500">{environments.length} ambiente{environments.length === 1 ? '' : 's'}</p></div>
            <div className="flex items-center gap-3">
              <span className={data.status === 'active' ? 'text-sm font-medium text-emerald-700' : 'text-sm font-medium text-amber-700'}>{data.status === 'active' ? 'Ativo' : 'Inativado'}</span>
              {data.canManageClient && <button type="button" disabled={changeStatus.isPending} onClick={() => { setStatusError(null); void changeStatus.mutateAsync(data.status === 'active' ? 'inactive' : 'active').catch(() => setStatusError('Não foi possível alterar o estado do cliente. Atualize a página e tente novamente.')); }} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-700 disabled:opacity-50">{changeStatus.isPending ? 'Salvando…' : data.status === 'active' ? 'Inativar cliente' : 'Reativar cliente'}</button>}
            </div>
          </div>
          {statusError && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{statusError}</p>}
          {metrics.isLoading && <p className="mb-3 text-sm text-slate-500">Carregando métricas de produção…</p>}
          {metrics.isError && <p role="alert" className="mb-3 text-sm text-red-700">Não foi possível carregar as métricas.</p>}
          {metrics.data && <section className="mb-5 border-y border-slate-200 py-3" aria-label="Usuários ativos em produção">
            <h2 className="text-sm font-semibold text-slate-900">Usuários ativos em produção</h2>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-slate-500">Internos</dt><dd className="font-medium tabular-nums text-slate-900">{metrics.data.internalUsers}</dd></div>
              <div><dt className="text-slate-500">Externos</dt><dd className="font-medium tabular-nums text-slate-900">{metrics.data.externalUsers}</dd></div>
              <div><dt className="text-slate-500">Ambientes de produção</dt><dd className="font-medium tabular-nums text-slate-900">{metrics.data.productionEnvironments}</dd></div>
            </dl>
          </section>}

          {(convites.data?.items?.length ?? 0) > 0 && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4" data-testid="convites">
              <h2 className="text-sm font-semibold text-slate-900">Convite do administrador</h2>
              {convites.data!.items.slice(0, 1).map((c) => {
                const entregue = !!c.sentAt;
                const aceito = !!c.acceptedAt;
                return (
                  <div key={c.inviteId} className="mt-1 text-xs text-slate-600">
                    <p data-testid="convite-situacao">
                      {c.email} ·{' '}
                      {aceito ? 'Convite aceito' : entregue ? 'Convite enviado' : 'Convite não entregue'}
                    </p>
                    {!entregue && c.lastSendError && (
                      <p className="mt-1 text-amber-700">{c.lastSendError}</p>
                    )}
                    {!aceito && (
                      <button
                        type="button"
                        data-testid="reenviar-convite"
                        disabled={reenviar.isPending}
                        onClick={() => void reenviar.mutateAsync()}
                        className="mt-2 inline-flex min-h-9 items-center rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Reenviar convite
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(data.pendingOperations?.length ?? 0) > 0 && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2" data-testid="operacoes-pendentes">
              {data.pendingOperations!.map((o) => (
                <CartaoProvisionamento key={o.operationId} operationId={o.operationId} titulo={o.target} />
              ))}
            </div>
          )}

          {environments.length === 0 && (data.pendingOperations?.length ?? 0) === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Este cliente ainda não tem ambientes.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2" data-testid="platform-ambientes">
              {environments.map((a) => (
                <li key={a.tenantId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <Link
                    to={routes.platformEnvironment(a.tenantId)}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    data-testid={`abrir-ambiente-${a.tenantId}`}
                  >
                    {a.displayName || a.tenantId}
                  </Link>
                  <p className="break-all text-xs text-slate-500">{a.url || a.host}</p>
                  {a.databaseName && <p className="mt-1 text-xs text-slate-500">Banco: {a.databaseName}</p>}
                  <a href={a.url || ('https://' + a.host)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-slate-700 underline underline-offset-2">Abrir ambiente</a>
                  {a.provisioningState !== 'ready' && a.operationId && (
                    <div className="mt-3">
                      <CartaoProvisionamento operationId={a.operationId} titulo="Provisionamento" />
                    </div>
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
                    <dt className="text-slate-500">Finalidade</dt>
                    <dd className="text-slate-800" data-testid={`ambiente-finalidade-${a.tenantId}`}>
                      {PURPOSE_LABEL[a.purpose] ?? a.purpose}
                    </dd>
                    <dt className="text-slate-500">Modo</dt>
                    <dd className="text-slate-800">{MODE_LABEL[a.operatingMode] ?? a.operatingMode}</dd>
                    <dt className="text-slate-500">Provisionamento</dt>
                    <dd className="text-slate-800">{STATE_LABEL[a.provisioningState] ?? a.provisioningState}</dd>
                    <dt className="text-slate-500">Credenciais</dt>
                    <dd className="text-slate-800">
                      {a.clientCanEditCredentials ? 'O cliente pode alterar' : 'Somente a Septem altera'}
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          )}

          <section className="mt-6 border-t border-slate-200 pt-4">
            <h2 className="text-sm font-semibold text-slate-900">Histórico do cliente</h2>
            {history.isLoading && <p className="mt-2 text-sm text-slate-500">Carregando histórico…</p>}
            {history.isError && <p role="alert" className="mt-2 text-sm text-red-700">Não foi possível carregar o histórico.</p>}
            {history.data?.items?.length === 0 && <p className="mt-2 text-sm text-slate-500">Ainda não há alterações registradas.</p>}
            {(history.data?.items?.length ?? 0) > 0 && <ol className="mt-2 divide-y divide-slate-200">
              {history.data!.items.map((item) => <li key={item.id} className="grid gap-1 py-2 text-sm sm:grid-cols-[1fr_auto]">
                <span className="text-slate-800">{item.type}{item.environmentId ? ' · ' + item.environmentId : ''}{item.result ? ' · ' + item.result : ''}</span>
                <time className="text-xs text-slate-500" dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time>
                <span className="text-xs text-slate-500 sm:col-span-2">{item.actorName || 'Sistema'}</span>
              </li>)}
            </ol>}
          </section>
        </>
      )}
    </section>
  );
}

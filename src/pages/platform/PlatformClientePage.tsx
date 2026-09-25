import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { CartaoProvisionamento } from '@/components/platform/CartaoProvisionamento';
import { useAdminInvites, useResendInvite } from '@/lib/api/platform-clients';
import {
  MODE_LABEL,
  PURPOSE_LABEL,
  STATE_LABEL,
  usePlatformClient,
} from '@/lib/api/platform-clients';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Detalhe do cliente e seus ambientes. Cliente, finalidade e modo aparecem em todo
 * cartão porque a spec exige que apareçam "em todos os detalhes e confirmações" —
 * é o que evita agir no ambiente errado.
 */
export function PlatformClientePage() {
  const { id } = useParams<{ id: string }>();
  // Enquanto houver operação em andamento, o detalhe se atualiza sozinho: o ambiente
  // aparece na tela no momento em que o job o reserva.
  const { data, isLoading, isError, error } = usePlatformClient(id);
  const convites = useAdminInvites(id);
  const reenviar = useResendInvite(id ?? '');
  useDocumentTitle(data ? `${data.name} · área central` : 'Cliente · área central');

  const naoEncontrado = isError && (error as { status?: number } | undefined)?.status === 404;

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
          <h1 className="text-lg font-semibold text-slate-900" data-testid="platform-cliente-nome">
            {data.name}
          </h1>
          <p className="mb-4 text-sm text-slate-500">
            {data.environments.length} ambiente{data.environments.length === 1 ? '' : 's'}
          </p>

          {(convites.data?.items.length ?? 0) > 0 && (
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

          {data.environments.length === 0 && (data.pendingOperations?.length ?? 0) === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Este cliente ainda não tem ambientes.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2" data-testid="platform-ambientes">
              {data.environments.map((a) => (
                <li key={a.tenantId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <Link
                    to={routes.platformEnvironment(a.tenantId)}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    data-testid={`abrir-ambiente-${a.tenantId}`}
                  >
                    {a.displayName || a.tenantId}
                  </Link>
                  <p className="break-all text-xs text-slate-500">{a.host}</p>
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
        </>
      )}
    </section>
  );
}

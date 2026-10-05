import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { platformApi } from '@/lib/platform-api';
import { ApiError } from '@/lib/api';
import { platformClientKeys, PURPOSE_LABEL, useOperation, useRetryOperation } from '@/lib/api/platform-clients';
import { routes } from '@/lib/routes';

type Preview = {
  clientName: string;
  confirmationToken: string;
  warning: string;
  environments: { tenantId: string; host: string; databaseName: string; purpose: string }[];
};

function errorMessage(error: unknown) {
  return error instanceof ApiError && error.detail
    ? error.detail : 'Não foi possível solicitar a remoção. Atualize a página para conferir o estado do cliente antes de tentar novamente.';
}

export function ClientRemovalButton({ clientId, onAccepted }: { clientId: string; onAccepted: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const preview = useQuery({
    queryKey: ['platform', 'clients', clientId, 'removal-preview'],
    queryFn: () => platformApi.get<Preview>(`/clients/${clientId}/removal-preview`),
    enabled: open,
    staleTime: 0,
  });
  const removal = useMutation({
    mutationFn: () => platformApi.post<{ operationId: string }>(`/clients/${clientId}/remove`, {
      confirmName: name, risksAcknowledged: acknowledged, confirmationToken: preview.data!.confirmationToken,
    }),
    onSuccess: (result) => {
      onAccepted(result.operationId);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: platformClientKeys.all });
    },
    onError: (error) => setError(errorMessage(error)),
  });
  const valid = !!preview.data && !preview.isFetching && !preview.isError && name === preview.data.clientName && acknowledged;
  return <>
    <button type="button" data-testid="remover-cliente" onClick={() => {
      setName(''); setAcknowledged(false); setError(null); setOpen(true);
    }} className="min-h-10 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">Remover cliente</button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Remover cliente definitivamente" width="lg" dismissible={!removal.isPending}
      footer={<>
        <button type="button" disabled={removal.isPending} onClick={() => setOpen(false)} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50">Cancelar</button>
        <button type="button" data-testid="confirmar-remocao-cliente" disabled={!valid || removal.isPending} onClick={() => removal.mutate()}
          className="min-h-10 rounded-md bg-red-700 px-3 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50">
          {removal.isPending ? 'Solicitando remoção…' : 'Remover definitivamente'}
        </button>
      </>}
    >
      {preview.isLoading && <p role="status" className="text-sm text-slate-600">Conferindo os ambientes do cliente…</p>}
      {preview.isError && <div role="alert" className="text-sm text-red-700"><p>Não foi possível conferir os ambientes para remoção.</p><button type="button" onClick={() => void preview.refetch()} className="mt-2 min-h-10 underline underline-offset-2">Tentar novamente</button></div>}
      {preview.data && !preview.isError && <>
        <p className="text-sm font-semibold text-slate-900">{preview.data.clientName}</p>
        <p id="client-removal-warning" className="mt-3 text-sm leading-relaxed text-red-800">{preview.data.warning}</p>
        <p className="mt-3 text-sm text-slate-600">Buckets, roles IAM, certificados e identidades de e-mail compartilhados são preservados.</p>
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-slate-900">Ambientes que serão removidos</h2>
          {preview.data.environments.length === 0 ? <p className="mt-2 text-sm text-slate-600">O cliente não possui ambientes. Seu cadastro e seus vínculos de acesso serão removidos.</p> :
            <ul className="mt-2 divide-y divide-slate-200">{preview.data.environments.map(environment => <li key={environment.tenantId} className="py-2 text-sm">
              <p className="font-medium text-slate-900">{PURPOSE_LABEL[environment.purpose] ?? environment.purpose}</p>
              <p className="break-all text-slate-600">{environment.host}</p>
              <p className="break-all text-slate-600">Banco: {environment.databaseName}</p>
            </li>)}</ul>}
        </div>
        <label htmlFor="client-removal-name" className="mt-4 block text-sm font-medium text-slate-900">Digite o nome exato do cliente para confirmar</label>
        <input id="client-removal-name" data-testid="nome-confirmacao-remocao" type="text" value={name} onChange={event => setName(event.target.value)} disabled={removal.isPending}
          autoComplete="off" spellCheck={false} aria-describedby="client-removal-warning" className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700" />
        <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-slate-800">
          <input type="checkbox" data-testid="aceitar-riscos-remocao" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={removal.isPending} className="mt-1 h-4 w-4 shrink-0 accent-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700" />
          Compreendo que os dados serão apagados definitivamente e que devo validar os backups antes de continuar.
        </label>
      </>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </Dialog>
  </>;
}

const labels: Record<string, string> = {
  'inventariar-recursos': 'Conferindo os recursos do cliente',
  'aws-ses': 'Removendo o locatário e os vínculos no AWS SES',
  'cadastro-central': 'Removendo o cadastro e os vínculos de acesso',
  iis: 'Removendo o binding IIS do ambiente', dns: 'Removendo o endereço DNS do ambiente',
  arquivos: 'Apagando arquivos e versões do ambiente', openrouter: 'Removendo a chave de integração do ambiente',
  banco: 'Apagando o banco do ambiente',
};

export function ClientRemovalProgress({ operationId }: { operationId: string }) {
  const operation = useOperation(operationId, true);
  const retry = useRetryOperation();
  const [retryError, setRetryError] = useState<string | null>(null);
  const complete = operation.data?.status === 'completed';
  const failed = operation.data?.status === 'failed' || operation.data?.status === 'needs_reconciliation';
  return <section data-testid="progresso-remocao-cliente" className="mt-4 border-t border-slate-200 pt-4" aria-label="Remoção do cliente">
    <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
      {complete ? null : failed ? <AlertTriangle aria-hidden="true" className="h-5 w-5 text-red-700" /> : <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-slate-600" />}
      {complete ? 'Cliente removido' : failed ? 'Remoção interrompida' : 'Removendo cliente'}
    </h1>
    <p role="status" className="mt-2 text-sm text-slate-700">{complete ? 'A limpeza dos recursos do cliente foi concluída.' : failed
      ? 'A limpeza pode estar parcial. Corrija a falha e retome a mesma operação para concluir a remoção.'
      : 'Os acessos estão bloqueados. A remoção continua no servidor se você sair desta página.'}</p>
    {operation.isError && <div role="alert" className="mt-3 text-sm text-red-700"><p>Não foi possível consultar o progresso. A operação pode continuar no servidor.</p><button type="button" onClick={() => void operation.refetch()} className="min-h-10 underline underline-offset-2">Consultar novamente</button></div>}
    {operation.data?.safeError && <p role="alert" className="mt-3 text-sm text-red-700">{operation.data.safeError}</p>}
    <ol className="mt-4 divide-y divide-slate-200">{(operation.data?.steps ?? []).map(step => <li key={step.name} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
      <span className="text-slate-800">{labels[step.name] ?? labels[step.name.replace(/-\d+$/, '')] ?? step.name}</span>
      <span className={step.status === 'failed' ? 'text-red-700' : 'text-slate-600'}>{step.status === 'completed' ? 'Concluído' : step.status === 'failed' ? 'Falhou' : step.status === 'running' ? 'Em execução' : 'Aguardando'}</span>
    </li>)}</ol>
    {failed && <button type="button" disabled={retry.isPending} data-testid="retomar-remocao-cliente" onClick={() => {
      setRetryError(null); void retry.mutateAsync(operationId).catch(error => setRetryError(errorMessage(error)));
    }} className="mt-4 min-h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50">{retry.isPending ? 'Retomando…' : 'Retomar remoção de onde parou'}</button>}
    {retryError && <p role="alert" className="mt-2 text-sm text-red-700">{retryError}</p>}
    <Link to={routes.platformClients} className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-slate-800 underline underline-offset-2">Voltar à lista de clientes</Link>
  </section>;
}

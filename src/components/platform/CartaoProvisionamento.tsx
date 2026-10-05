import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RotateCw } from 'lucide-react';
import { useOperation, useRetryOperation, type OperationStep } from '@/lib/api/platform-clients';

/**
 * Cartão de progresso de um ambiente sendo provisionado (ADM-03, Fase 11a).
 *
 * Mostra as etapas com o que já passou, o erro **acionável** quando trava e o botão de
 * retomar. Enquanto o trabalho anda, ele se atualiza sozinho — provisionar leva minutos, e
 * mandar a pessoa recarregar a página seria transferir a ela um problema nosso.
 */
const ROTULO: Record<string, string> = {
  reservar: 'Reservando nomes',
  'criar-banco': 'Criando o banco',
  migrar: 'Aplicando a estrutura',
  'cadastros-essenciais': 'Cadastros essenciais',
  'configuracao-inicial': 'Configuração inicial',
  armazenamento: 'Verificando armazenamento',
  funcionalidades: 'Funcionalidades contratadas',
  'processos-do-catalogo': 'Processos do catálogo',
  'dados-ficticios': 'Dados fictícios',
  superadmins: 'Superadministradores',
  'vinculo-do-admin': 'Vínculo do administrador',
  prontidao: 'Verificando prontidão',
  dns: 'Configurando endereço',
  'binding-iis': 'Configurando HTTPS',
  https: 'Verificando HTTPS',
  'convite-do-admin': 'Convite do administrador',
};

export function CartaoProvisionamento({ operationId, titulo, environmentUrl }: { operationId: string; titulo: string; environmentUrl?: string }) {
  const { data } = useOperation(operationId, true);
  const retry = useRetryOperation();
  const [retryError, setRetryError] = useState<string | null>(null);

  const emAndamento = data?.status === 'running' || data?.status === 'queued';
  const pronto = data?.status === 'completed';
  const falhou = data?.status === 'failed';

  return (
    <article data-testid={`operacao-${operationId}`} className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
          {pronto ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : falhou ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
          {titulo}
        </span>
        <span className="text-xs text-slate-500" data-testid="operacao-status">
          {pronto ? 'Concluído' : falhou ? 'Falhou' : emAndamento ? 'Provisionando…' : data?.status}
        </span>
      </header>

      {data?.safeError && (
        <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
          {data.safeError}
        </p>
      )}

      <ol className="mt-3 grid gap-1" data-testid="operacao-etapas">
        {(data?.steps ?? []).map((e) => (
          <EtapaLinha key={e.name} etapa={e} />
        ))}
        {(data?.steps ?? []).length === 0 && <li className="text-xs text-slate-400">Aguardando o início…</li>}
      </ol>

      {pronto && environmentUrl && (
        <a
          href={environmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${titulo.toLocaleLowerCase('pt-BR')} em nova aba`}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
        >
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /> Abrir ambiente
        </a>
      )}

      {falhou && (
        <button
          type="button"
          data-testid="operacao-retomar"
          disabled={retry.isPending}
          onClick={() => { setRetryError(null); void retry.mutateAsync(operationId).catch(() => setRetryError('Não foi possível retomar o provisionamento. Confira a configuração e tente novamente.')); }}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RotateCw className="h-3.5 w-3.5" /> Retomar de onde parou
        </button>
      )}
      {retryError && <p role="alert" className="mt-2 text-xs text-red-700">{retryError}</p>}
    </article>
  );
}

function EtapaLinha({ etapa }: { etapa: OperationStep }) {
  const cor =
    etapa.status === 'completed' ? 'text-emerald-700'
      : etapa.status === 'failed' ? 'text-red-700'
      : etapa.status === 'running' ? 'text-slate-900'
      : 'text-slate-400';

  return (
    <li className={`flex items-start justify-between gap-2 text-xs ${cor}`}>
      <span>{ROTULO[etapa.name] ?? etapa.name}</span>
      <span className="shrink-0">
        {etapa.status === 'completed' ? '✓' : etapa.status === 'failed' ? '✗' : etapa.status === 'running' ? '…' : ''}
      </span>
    </li>
  );
}

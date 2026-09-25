import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Loader2, RotateCcw, Share2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import {
  TRANSFER_ACTION_LABEL,
  TRANSFER_KIND_LABEL,
  useApplyTransfer,
  useClientEnvironments,
  useCompareTransfer,
  useEnvironmentArtifacts,
  type TransferKind,
  type TransferPlan,
} from '@/lib/api/client-transfers';
import { useDocumentTitle } from '@/lib/use-document-title';
import { toast } from '@/stores/toast';

/**
 * Assistente de transferência entre ambientes (ADM-06, Fase 13).
 *
 * Quatro passos: tipo → origem e destino → serviços → diferenças e confirmação.
 *
 * Duas coisas que a tela NÃO pode esconder, e é por isso que ela existe:
 *  - **o que será sobrescrito** (conflito), com confirmação explícita antes de aplicar;
 *  - **as dependências que entraram sozinhas** no conjunto, inclusive quando são
 *    compartilhadas com processos que ninguém selecionou.
 */
const PASSOS = ['Tipo', 'Ambientes', 'Serviços', 'Conferir'];

export function TransferenciasPage() {
  const ambientes = useClientEnvironments();
  // A lista de serviços vem do ambiente de ORIGEM (ou, na atualização do catálogo, dos
  // serviços do DESTINO que vieram do catálogo — são esses que podem ser atualizados).
  const [origem, setOrigemInterna] = useState('');
  const [destino, setDestinoInterno] = useState('');
  const [kind, setKindInterno] = useState<TransferKind>('promote');
  const doCatalogoInterno = kind === 'catalog_update';
  const artefatos = useEnvironmentArtifacts(doCatalogoInterno ? destino || undefined : origem || undefined);
  const comparar = useCompareTransfer();
  const aplicar = useApplyTransfer();
  useDocumentTitle('Transferências');

  const [passo, setPasso] = useState(0);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [plano, setPlano] = useState<TransferPlan | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string[] | null>(null);

  const lista = ambientes.data?.items ?? [];
  const doCatalogo = doCatalogoInterno;

  const destinos = useMemo(
    () => lista.filter((a) => (kind === 'promote' ? a.purpose === 'production' : a.purpose !== 'production')),
    [lista, kind],
  );
  const origens = useMemo(
    () => lista.filter((a) => a.tenantId !== destino
      && (kind === 'promote' ? a.purpose !== 'production' : a.purpose === 'production')),
    [lista, destino, kind],
  );

  const setKind = setKindInterno;
  const setOrigem = setOrigemInterna;
  const setDestino = setDestinoInterno;

  /**
   * O que pode ser transferido, na linguagem da tela.
   *
   * Promover/sincronizar: os serviços PUBLICADOS da origem (é a versão publicada que viaja).
   * Atualizar do catálogo: os serviços do destino que têm origem de catálogo — a chave
   * enviada é a do CATÁLOGO, não a local.
   */
  const ofertados = useMemo(() => {
    const processos = artefatos.data?.processes ?? [];
    if (doCatalogo)
      return processos
        .filter((p) => !!p.catalogKey)
        .map((p) => ({
          chave: p.catalogKey!,
          nome: p.name,
          detalhe: `do catálogo v${p.catalogVersion ?? '?'}${p.customized ? ', personalizado' : ''}`,
        }));
    // Transferível é quem TEM versão publicada — não quem está publicado AGORA. Um processo
    // publicado com um rascunho novo em cima continua transferível (o que viaja é a
    // publicada); filtrar pelo status da última versão o fazia desaparecer da lista.
    return processos
      .filter((p) => p.publishedVersion != null)
      .map((p) => ({
        chave: p.key,
        nome: p.name,
        detalhe: p.publishedVersion === p.currentVersion
          ? `v${p.publishedVersion}`
          : `v${p.publishedVersion} publicada · v${p.currentVersion} em rascunho`,
      }));
  }, [artefatos.data, doCatalogo]);

  function trocarTipo(novo: TransferKind) {
    setKind(novo);
    setOrigem('');
    setDestino('');
    setEscolhidos([]);
    setPlano(null);
    setResultado(null);
  }

  async function compararAgora() {
    setAviso(null);
    setResultado(null);
    setConfirmado(false);
    try {
      const p = await comparar.mutateAsync({
        kind,
        source: doCatalogo ? null : origem,
        destination: destino,
        artifactKeys: escolhidos,
      });
      setPlano(p);
      setPasso(3);
    } catch (e) {
      setPlano(null);
      setPasso(3);
      setAviso(mensagem(e, 'Não foi possível comparar os ambientes.'));
    }
  }

  async function aplicarAgora() {
    if (!plano) return;
    setAviso(null);
    try {
      const r = await aplicar.mutateAsync({
        planId: plano.id,
        confirmOverwriteConflicts: confirmado,
        expectedPlanVersion: plano.planVersion,
      });
      setResultado(r.details.length ? r.details : ['Nada a transferir.']);
      toast.success('Transferência aplicada.');
      setPlano({ ...plano, status: 'applied' });
    } catch (e) {
      // 409 é o caso normal aqui: o estado mudou e a comparação tem de ser refeita.
      setAviso(mensagem(e, 'Não foi possível aplicar a transferência.'));
    }
  }

  const podeAvancar =
    (passo === 0)
    || (passo === 1 && !!destino && (doCatalogo || !!origem))
    || (passo === 2 && escolhidos.length > 0);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Share2 className="h-5 w-5 text-slate-500" /> Transferências entre ambientes
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Leve serviços de um ambiente para outro do seu cliente. As solicitações, os usuários e as
          credenciais <strong>não</strong> são transferidos — só a definição e o que ela depende.
        </p>
      </header>

      <ol className="mb-4 flex flex-wrap gap-2 text-xs" data-testid="transf-passos">
        {PASSOS.map((rotulo, i) => (
          <li
            key={rotulo}
            aria-current={i === passo ? 'step' : undefined}
            className={`rounded-full px-3 py-1 ${
              i === passo ? 'bg-slate-900 text-white'
                : i < passo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}
          >
            {i < passo && <Check className="mr-1 inline h-3 w-3" />}
            {rotulo}
          </li>
        ))}
      </ol>

      {aviso && (
        <p role="alert" data-testid="transf-aviso"
           className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {aviso}
        </p>
      )}

      {ambientes.isError && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Não foi possível carregar os seus ambientes.
        </p>
      )}

      {!ambientes.isLoading && lista.length < 2 && !doCatalogo && (
        <p data-testid="transf-sem-ambientes"
           className="mb-4 rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
          Você alcança apenas um ambiente. Promover e sincronizar exigem dois ambientes do mesmo
          cliente — fale com a Septem para criar o ambiente de homologação.
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {passo === 0 && (
          <fieldset className="grid gap-2" data-testid="transf-tipos">
            <legend className="mb-1 text-sm font-medium text-slate-800">O que você quer fazer?</legend>
            {(Object.keys(TRANSFER_KIND_LABEL) as TransferKind[]).map((k) => (
              <label key={k} className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-sm">
                <input type="radio" name="kind" value={k} checked={kind === k}
                       data-testid={`transf-tipo-${k}`}
                       onChange={() => trocarTipo(k)} />
                <span>{TRANSFER_KIND_LABEL[k]}</span>
              </label>
            ))}
          </fieldset>
        )}

        {passo === 1 && (
          <div className="grid gap-3 sm:grid-cols-2" data-testid="transf-ambientes">
            {!doCatalogo && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Origem</span>
                <select value={origem} onChange={(e) => setOrigem(e.target.value)}
                        data-testid="transf-origem"
                        className="min-h-11 rounded-md border border-slate-300 px-3">
                  <option value="">Escolha…</option>
                  {origens.map((a) => (
                    <option key={a.tenantId} value={a.tenantId}>{a.displayName} — {a.host}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Destino</span>
              <select value={destino} onChange={(e) => setDestino(e.target.value)}
                      data-testid="transf-destino"
                      className="min-h-11 rounded-md border border-slate-300 px-3">
                <option value="">Escolha…</option>
                {destinos.map((a) => (
                  <option key={a.tenantId} value={a.tenantId}>{a.displayName} — {a.host}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {passo === 2 && (
          <div>
            <p className="mb-2 text-sm text-slate-600">
              Escolha os serviços. As dependências (fontes, modelos, categorias) entram
              automaticamente e aparecem na conferência.
            </p>
            {artefatos.isLoading && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Lendo os serviços do ambiente…
              </p>
            )}
            {!artefatos.isLoading && ofertados.length === 0 && (
              <p data-testid="transf-sem-servicos"
                 className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-600">
                {doCatalogo
                  ? 'Nenhum serviço deste ambiente veio do catálogo da Septem — não há o que atualizar.'
                  : 'O ambiente de origem não tem serviço publicado para transferir.'}
              </p>
            )}
            <ul className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2" data-testid="transf-servicos">
              {ofertados.map((p) => (
                <li key={p.chave}>
                  <label className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={escolhidos.includes(p.chave)}
                      data-testid={`transf-servico-${p.chave}`}
                      onChange={() => setEscolhidos((atual) =>
                        atual.includes(p.chave) ? atual.filter((k) => k !== p.chave) : [...atual, p.chave])}
                    />
                    <span>
                      {p.nome}
                      <span className="ml-1 text-xs text-slate-500">{p.detalhe}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {passo === 3 && (
          <div data-testid="transf-conferir">
            {comparar.isPending && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Comparando…
              </p>
            )}

            {plano && (
              <>
                {plano.blockers.length > 0 && (
                  <div data-testid="transf-bloqueios"
                       className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-4 w-4" /> Não é possível aplicar
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {plano.blockers.map((b) => <li key={b.reason + b.detail}>{b.detail}</li>)}
                    </ul>
                  </div>
                )}

                <ul className="divide-y divide-slate-100 text-sm" data-testid="transf-itens">
                  {plano.items.map((i) => (
                    <li key={`${i.type}:${i.logicalId}`}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2">
                      <span className="font-medium text-slate-800">{i.name}</span>
                      <span className="text-xs text-slate-500">{i.type}</span>
                      {i.dependency && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          dependência
                        </span>
                      )}
                      <span
                        data-testid={`transf-acao-${i.logicalId}`}
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          i.action === 'conflict' ? 'bg-red-100 text-red-800'
                            : i.action === 'update' ? 'bg-amber-100 text-amber-800'
                            : i.action === 'new' ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'}`}
                      >
                        {TRANSFER_ACTION_LABEL[i.action] ?? i.action}
                        {i.targetVersion ? ` (destino v${i.targetVersion})` : ''}
                      </span>
                      {i.sharedWith.length > 0 && (
                        <span data-testid={`transf-compartilhado-${i.logicalId}`}
                              className="w-full text-xs text-amber-700">
                          Também usado por: {i.sharedWith.join(', ')} — esses processos serão afetados.
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {plano.requiresConfirmation && plano.status !== 'applied' && (
                  <label className="mt-3 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                    <input type="checkbox" checked={confirmado} data-testid="transf-confirmar"
                           onChange={(e) => setConfirmado(e.target.checked)} />
                    <span>
                      Entendo que {plano.conflicts.length} item(ns) com alteração local serão
                      <strong> sobrescritos</strong> no destino. A versão anterior continua recuperável.
                    </span>
                  </label>
                )}

                {resultado && (
                  <div data-testid="transf-resultado"
                       className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    <p className="font-medium">Aplicado</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {resultado.map((d) => <li key={d}>{d}</li>)}
                    </ul>
                    <p className="mt-1 flex items-center gap-1.5 text-xs">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Precisou voltar atrás? A versão anterior de cada serviço continua no histórico do
                      processo, em Processos.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setPasso((p) => Math.max(0, p - 1))}
          disabled={passo === 0}
          data-testid="transf-voltar"
          className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Voltar
        </button>

        {passo < 2 && (
          <button type="button" onClick={() => setPasso((p) => p + 1)} disabled={!podeAvancar}
                  data-testid="transf-avancar"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            Avançar <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {passo === 2 && (
          <button type="button" onClick={() => void compararAgora()}
                  disabled={!podeAvancar || comparar.isPending}
                  data-testid="transf-comparar"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {comparar.isPending ? 'Comparando…' : 'Comparar'}
          </button>
        )}

        {passo === 3 && plano && plano.status !== 'applied' && (
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setPlano(null); setPasso(2); }}
                    data-testid="transf-cancelar"
                    className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void aplicarAgora()}
              disabled={!plano.canApply || aplicar.isPending || (plano.requiresConfirmation && !confirmado)}
              data-testid="transf-aplicar"
              className="min-h-11 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {aplicar.isPending ? 'Aplicando…' : 'Confirmar e aplicar'}
            </button>
          </span>
        )}
      </div>
    </section>
  );
}

function mensagem(erro: unknown, padrao: string): string {
  if (erro instanceof ApiError) {
    const corpo = erro.body as { detail?: string } | undefined;
    if (corpo?.detail) return corpo.detail;
  }
  return erro instanceof Error && erro.message ? erro.message : padrao;
}

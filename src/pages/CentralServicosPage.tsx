import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Lock, Search, Unlock, Workflow } from 'lucide-react';
import { FALLBACK_COLOR, groupByCategory, NamedIcon, tintOf } from '@/components/catalog/category-catalog';
import { usePublicServices, type PublicService } from '@/lib/api/catalog';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';
import { routes } from '@/lib/routes';
import { CategoryButton } from '@/components/catalog/CategoryButton';
import '@/styles/new-request.css';
import { ContextHelp } from '@/components/guide/ContextHelp';

/** Busca sem acento e sem caixa — "creche" acha "Creche" e "Crèche". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Central de serviços — vitrine PÚBLICA (Fase 8), acessível sem login.
 *
 * Reaproveita o agrupamento por categoria do modal "Nova requisição"
 * (`category-catalog`), com as mesmas cores e ícones: quem chega pela Central e
 * quem chega logado vê a mesma organização, e existe UM lugar para mudá-la.
 */
export function CentralServicosPage() {
  const { data, isLoading, isError } = usePublicServices();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('all');
  // O tenant já vem do bootstrap (é ele que dá logo e nome do cliente), e o
  // bootstrap acontece antes do login — a Central pode contar com ele.
  const tenant = useSessionStore((estado) => estado.tenant);
  // Rota FORA do AppShell e sem login: precisa disparar o bootstrap por conta
  // própria. Sem isto o tenant não carrega numa visita DIRETA (logo, nome do órgão
  // e a chave do captcha ficam vazios) — e só funcionava por acidente, quando a
  // pessoa vinha da tela de login.
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const statusSessao = useSessionStore((s) => s.status);
  useEffect(() => { if (statusSessao === 'idle') void bootstrap(); }, [statusSessao, bootstrap]);

  useDocumentTitle('Central de serviços');

  const servicos = data ?? [];
  const alvo = normalizar(busca.trim());
  const grupos = useMemo(() => groupByCategory(servicos), [servicos]);
  const filtrados = useMemo(() => servicos.filter((s) =>
    (categoria === 'all' || String(s.categoryId ?? 'none') === categoria) &&
    (!alvo || normalizar([s.name, s.category, textoSimples(s.description ?? '')].filter(Boolean).join(' ')).includes(alvo)),
  ), [servicos, alvo, categoria]);
  const categoriaSelecionada = grupos.find((grupo) => grupo.key === categoria);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50" data-testid="central-servicos">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <a href={`${import.meta.env.BASE_URL}${routes.login.replace(/^\//, '')}`} aria-label="Voltar ao login" title="Voltar ao login" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-200">
              <ArrowLeft size={18} aria-hidden="true" />
            </a>
            {tenant?.logoUrl && <img src={tenant.logoUrl} alt="" className="h-9 w-auto shrink-0" />}
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1">
                <h1 className="text-lg font-semibold leading-snug text-slate-900">Central de serviços</h1>
                <ContextHelp manual="jornada-solicitante-externo" section="localizar-servico" label="Abrir manual da jornada do solicitante externo" />
              </div>
              <p className="truncate text-sm text-slate-500">{tenant?.clienteNome ?? 'Serviços disponíveis'}</p>
            </div>
          </div>

          {tenant?.operatingMode === 'new_requests_blocked' && (
            <p
              role="alert"
              data-testid="central-bloqueada"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              Este órgão não está recebendo novos pedidos no momento. Os pedidos já enviados
              continuam em andamento.
            </p>
          )}

        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-1">
        <aside aria-label="Filtrar serviços" className="flex max-h-56 min-h-0 flex-col border-b border-slate-200 bg-slate-50/70 md:max-h-none md:border-b-0 md:border-r">
          <div className="shrink-0 p-4">
            <label htmlFor="central-busca" className="mb-1.5 block text-xs font-semibold text-slate-700">Buscar serviços</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="central-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou descrição" data-testid="central-busca" autoComplete="off" className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-2 outline-transparent placeholder:text-slate-400 hover:bg-slate-50 focus-visible:outline-slate-700" />
            </div>
          </div>
          <nav aria-label="Categorias" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <p className="px-2 pb-1.5 text-xs font-semibold text-slate-500">Categorias</p>
            <CategoryButton active={categoria === 'all'} label="Todas" count={servicos.length} onClick={() => setCategoria('all')} />
            {grupos.map((grupo) => <CategoryButton key={grupo.key} active={categoria === grupo.key} label={grupo.name} count={grupo.items.length} color={grupo.color} icon={grupo.icon} onClick={() => setCategoria(grupo.key)} />)}
          </nav>
        </aside>
        <section aria-labelledby="central-resultados" className="flex min-h-0 min-w-0 flex-col bg-white">
          <header className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 id="central-resultados" className="text-sm font-semibold text-slate-900">{categoriaSelecionada?.name ?? 'Todos os serviços'}</h2>
            <p className="mt-0.5 text-xs text-slate-500" aria-live="polite">{filtrados.length} {filtrados.length === 1 ? 'serviço encontrado' : 'serviços encontrados'}</p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {isLoading && <p className="text-sm text-slate-500">Carregando serviços…</p>}
            {isError && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="central-erro">
                Não foi possível carregar os serviços agora. Tente novamente em instantes.
              </p>
            )}

            {!isLoading && !isError && filtrados.length === 0 && (
              <p className="text-sm text-slate-500" data-testid="central-vazio">
                {servicos.length === 0
                  ? 'Nenhum serviço disponível no momento.'
                  : busca.trim() ? `Nenhum serviço encontrado para "${busca.trim()}".` : 'Nenhum serviço encontrado nesta categoria.'}
              </p>
            )}

            {!isLoading && !isError && <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
              {filtrados.map((servico) => <CardServico key={servico.key} servico={servico} />)}
            </ul>}
          </div>
        </section>
      </main>
    </div>
  );
}

function CardServico({ servico }: { servico: PublicService }) {
  const cor = servico.categoryColor ?? FALLBACK_COLOR;
  return (
    <li>
      <a
        href={`${import.meta.env.BASE_URL}${routes.publicService(servico.key).replace(/^\//, '')}`}
        data-testid="central-servico" data-key={servico.key}
        className="new-request-card group flex h-full min-h-40 min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
      >
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: tintOf(cor), color: cor }}>
          <NamedIcon name={servico.icon} fallback={<Workflow size={18} />} />
        </span>
        <span className="mt-3 min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900">{servico.name}</span>
          {servico.description && (
            <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-500">{textoSimples(servico.description)}</span>
          )}
          {/* O visitante precisa saber ANTES de clicar se vai precisar de conta. */}
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500"
                data-testid={servico.requiresLogin ? 'central-exige-login' : 'central-sem-login'}>
            {servico.requiresLogin
              ? <><Lock size={12} /> Exige entrar na conta</>
              : <><Unlock size={12} /> Envio sem cadastro</>}
          </span>
        </span>
        <span className="mt-auto flex w-full min-w-0 items-end justify-between gap-3 pt-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} /><span className="truncate">{servico.category ?? 'Sem categoria'}</span></span>
          <span className="new-request-action inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700">Iniciar <ArrowRight size={14} /></span>
        </span>
      </a>
    </li>
  );
}

/** A descrição do processo é rich-text; no card queremos só o texto. */
function textoSimples(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

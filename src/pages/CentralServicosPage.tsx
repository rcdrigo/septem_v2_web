import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Lock, Search, Tags, Unlock, Workflow } from 'lucide-react';
import { FALLBACK_COLOR, groupByCategory, NamedIcon, tintOf } from '@/components/catalog/category-catalog';
import { usePublicServices, type PublicService } from '@/lib/api/catalog';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';
import { routes } from '@/lib/routes';

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
  const filtrados = useMemo(() => servicos.filter((s) => !alvo || normalizar(
    [s.name, s.category, s.description].filter(Boolean).join(' '),
  ).includes(alvo)), [servicos, alvo]);
  const grupos = useMemo(() => groupByCategory(filtrados), [filtrados]);

  return (
    <div className="min-h-dvh bg-slate-50" data-testid="central-servicos">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:py-10">
          <div className="flex min-w-0 items-center gap-3">
            {tenant?.logoUrl && <img src={tenant.logoUrl} alt="" className="h-9 w-auto shrink-0" />}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-slate-900 sm:text-3xl">Central de serviços</h1>
              <p className="truncate text-sm text-slate-500">{tenant?.clienteNome ?? 'Serviços disponíveis'}</p>
            </div>
          </div>

          {/* "campo de busca grande" — é o primeiro controle da página, de propósito. */}
          <label className="relative block">
            <span className="sr-only">Buscar serviço</span>
            <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="O que você precisa?" data-testid="central-busca" autoComplete="off"
              className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-800 focus:ring-2 focus:ring-slate-200 sm:h-16 sm:text-lg"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
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
              : `Nenhum serviço encontrado para "${busca.trim()}".`}
          </p>
        )}

        <div className="flex flex-col gap-8">
          {grupos.map((grupo) => (
            <section key={grupo.key} data-testid="central-grupo" data-categoria={grupo.name}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded"
                      style={{ backgroundColor: tintOf(grupo.color ?? FALLBACK_COLOR), color: grupo.color ?? FALLBACK_COLOR }}>
                  <NamedIcon name={grupo.icon} fallback={<Tags size={14} />} />
                </span>
                {grupo.name}
              </h2>

              <ul className="grid gap-3 sm:grid-cols-2">
                {grupo.items.map((servico) => <CardServico key={servico.key} servico={servico} />)}
              </ul>
            </section>
          ))}
        </div>
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
        className="flex h-full min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
      >
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: tintOf(cor), color: cor }}>
          <NamedIcon name={servico.icon} fallback={<Workflow size={18} />} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-800">{servico.name}</span>
          {servico.description && (
            <span className="mt-0.5 block line-clamp-2 text-sm text-slate-500">{textoSimples(servico.description)}</span>
          )}
          {/* O visitante precisa saber ANTES de clicar se vai precisar de conta. */}
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500"
                data-testid={servico.requiresLogin ? 'central-exige-login' : 'central-sem-login'}>
            {servico.requiresLogin
              ? <><Lock size={12} /> Exige entrar na conta</>
              : <><Unlock size={12} /> Envio sem cadastro</>}
          </span>
        </span>
        <ArrowRight size={16} className="mt-1 shrink-0 text-slate-400" aria-hidden="true" />
      </a>
    </li>
  );
}

/** A descrição do processo é rich-text; no card queremos só o texto. */
function textoSimples(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, Plus, Search } from 'lucide-react';
import {
  useSupportTickets, useSupportTeams, ESTADOS, PRIORIDADES, NATUREZAS,
  type SupportScope, type SupportTicketRow,
} from '@/lib/api/support';
import { Select, TextInput } from '@/components/ui/Field';
import { routes } from '@/lib/routes';
import { Quando } from '@/components/ui/Quando';

/**
 * "Meus chamados" (Fase 4 — SUP-01). Substitui o stub de `/support`.
 *
 * <p>
 * A lista mostra o que a pessoa precisa para se reconhecer: protocolo (o número que ela fala ao
 * telefone), assunto, natureza, estado, prioridade e a última movimentação — que é também o
 * critério de ordenação, porque o chamado que acabou de receber resposta é o que ela quer ver.
 * </p>
 * <p>
 * Encerrados e cancelados ENTRAM na lista. Esconder o que terminou parece limpeza, mas tira da
 * pessoa a única forma de reencontrar o histórico do próprio pedido.
 * </p>
 */
/** Recorte da lista: o que o servidor já deixa ver, estreitado para o trabalho de cada um. */
type Recorte = 'mine' | 'team' | 'triage' | undefined;

const TITULOS: Record<string, { titulo: string; sub: string }> = {
  mine: { titulo: 'Meus chamados', sub: 'Os pedidos que você abriu, inclusive os já encerrados.' },
  team: { titulo: 'Fila da equipe', sub: 'Chamados encaminhados às equipes de que você participa.' },
  triage: { titulo: 'Triagem', sub: 'Chamados de todos os clientes, para classificar e encaminhar.' },
};

export function MeusChamadosPage({ escopo = 'cliente', recorte }: { escopo?: SupportScope; recorte?: Recorte }) {
  const [busca, setBusca] = useState('');
  const [estado, setEstado] = useState('');
  const [natureza, setNatureza] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [responsavel, setResponsavel] = useState('');
  // Responsáveis possíveis: os membros das equipes que esta pessoa enxerga — o servidor já
  // filtra a lista de equipes por quem administra ou participa.
  const equipes = useSupportTeams(escopo);
  const responsaveis = [...new Map((equipes.data ?? []).flatMap((e) => e.members)
    .map((m) => [m.userId, m.name] as const)).entries()].map(([value, label]) => ({ value, label }));
  const [pagina, setPagina] = useState(1);
  const ehFila = recorte === 'team' || recorte === 'triage';

  const filtros = { q: busca, state: estado, nature: natureza, priority: prioridade, ownerId: responsavel, scope: recorte, page: pagina, pageSize: 25 };
  const chamados = useSupportTickets(escopo, filtros);
  const itens = chamados.data?.items ?? [];
  const total = chamados.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / 25));

  function trocarFiltro(fn: () => void) {
    fn();
    setPagina(1);   // trocar filtro e continuar na página 7 mostra uma lista vazia sem motivo
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">
            {recorte ? TITULOS[recorte].titulo : escopo === 'septem' ? 'Chamados' : 'Meus chamados'}
          </h1>
          <p className="text-sm text-slate-500">
            {recorte ? TITULOS[recorte].sub
              : escopo === 'septem' ? 'Chamados encaminhados para você ou para as suas equipes.'
              : 'Os pedidos que você abriu, inclusive os já encerrados.'}
          </p>
        </div>
        {escopo === 'cliente' && !ehFila && (
          <Link
            to={routes.supportNew}
            data-testid="novo-chamado"
            className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            <Plus size={16} /> Abrir chamado
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="mb-1 block text-xs font-medium text-slate-500">Buscar</span>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <TextInput
              value={busca}
              onChange={(e) => trocarFiltro(() => setBusca(e.target.value))}
              placeholder="Protocolo ou assunto"
              className="pl-8"
              data-testid="busca-chamados"
            />
          </div>
        </label>
        <label className="w-40">
          <span className="mb-1 block text-xs font-medium text-slate-500">Situação</span>
          <Select
            value={estado}
            onChange={(e) => trocarFiltro(() => setEstado(e.target.value))}
            data-testid="filtro-estado"
            options={[{ value: '', label: 'Todas' }, ...Object.entries(ESTADOS).map(([value, label]) => ({ value, label }))]}
          />
        </label>
        {ehFila && (
          <label className="w-48">
            <span className="mb-1 block text-xs font-medium text-slate-500">Responsável</span>
            <Select
              value={responsavel}
              onChange={(e) => trocarFiltro(() => setResponsavel(e.target.value))}
              data-testid="filtro-responsavel"
              options={[{ value: '', label: 'Todos' }, ...responsaveis]}
            />
          </label>
        )}
        {ehFila && (
          <label className="w-36">
            <span className="mb-1 block text-xs font-medium text-slate-500">Prioridade</span>
            <Select
              value={prioridade}
              onChange={(e) => trocarFiltro(() => setPrioridade(e.target.value))}
              data-testid="filtro-prioridade"
              options={[{ value: '', label: 'Todas' }, ...Object.entries(PRIORIDADES).map(([value, label]) => ({ value, label }))]}
            />
          </label>
        )}
        <label className="w-44">
          <span className="mb-1 block text-xs font-medium text-slate-500">Natureza</span>
          <Select
            value={natureza}
            onChange={(e) => trocarFiltro(() => setNatureza(e.target.value))}
            data-testid="filtro-natureza"
            options={[{ value: '', label: 'Todas' }, ...NATUREZAS.map((n) => ({ value: n.value, label: n.label }))]}
          />
        </label>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {chamados.isLoading && <p className="text-sm text-slate-400">Carregando…</p>}

        {chamados.isError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" data-testid="chamados-erro">
            Não foi possível carregar seus chamados.{' '}
            <button type="button" onClick={() => void chamados.refetch()} className="font-medium underline">
              Tentar de novo
            </button>
          </div>
        )}

        {!chamados.isLoading && !chamados.isError && itens.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="chamados-vazio">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <LifeBuoy size={26} />
            </div>
            <p className="text-sm font-medium text-slate-700">
              {busca || estado || natureza ? 'Nada encontrado com esses filtros' : 'Você ainda não abriu chamados'}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {busca || estado || natureza
                ? 'Tente limpar a busca ou escolher outra situação.'
                : 'Quando algo não funcionar como esperado, abra um chamado — é por ele que a conversa fica registrada.'}
            </p>
          </div>
        )}

        <ul className="grid gap-2">
          {itens.map((t) => <LinhaChamado key={t.id} chamado={t} escopo={escopo} mostrarCliente={recorte === 'triage'} />)}
        </ul>

        {paginas > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm" data-testid="paginacao-chamados">
            <span className="text-slate-500">{total} chamado{total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button
                type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}
                className="rounded-md border border-slate-300 px-2.5 py-1 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-slate-500">{pagina} de {paginas}</span>
              <button
                type="button" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}
                className="rounded-md border border-slate-300 px-2.5 py-1 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LinhaChamado({ chamado, escopo, mostrarCliente }: { chamado: SupportTicketRow; escopo: SupportScope; mostrarCliente?: boolean }) {
  const destino = escopo === 'septem'
    ? `${routes.platformSupportTickets}/${chamado.id}`
    : routes.supportTicket(chamado.id);

  return (
    <li>
      <Link
        to={destino}
        data-testid="chamado-linha"
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300 hover:bg-slate-50"
      >
        <code className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600" data-testid="chamado-protocolo">
          {chamado.protocol}
        </code>
        {/* Na triagem, o cliente é a primeira coisa a saber: a fila mistura clientes (S-A02). */}
        {mostrarCliente && (
          <span className="shrink-0 rounded bg-cyan-50 px-1.5 py-0.5 text-[11px] font-medium text-cyan-900" data-testid="chamado-cliente">
            {chamado.client ?? 'Cliente não identificado'}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{chamado.subject}</span>
        <span className="shrink-0 text-xs text-slate-500">{NATUREZAS.find((n) => n.value === chamado.nature)?.label ?? chamado.nature}</span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700" data-testid="chamado-estado">
          {ESTADOS[chamado.state] ?? chamado.state}
        </span>
        <span className="shrink-0 text-xs text-slate-500">{PRIORIDADES[chamado.priority] ?? chamado.priority}</span>
        <Quando iso={chamado.updatedAt} className="shrink-0 text-xs text-slate-400" />
      </Link>
    </li>
  );
}

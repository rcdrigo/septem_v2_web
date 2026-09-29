import { useState } from 'react';
import { Plus, Pencil, UserPlus, UserMinus, Users, ShieldCheck } from 'lucide-react';
import {
  useSupportTeams,
  useCreateSupportTeam,
  useUpdateSupportTeam,
  useAddSupportMember,
  useRemoveSupportMember,
  useSupportCandidates,
  usePlatformIdentities,
  useSetPlatformRole,
  PAPEIS_DE_SUPORTE,
  SUPPORT_TEAM_ADMIN,
  type SupportScope,
  type SupportTeam,
} from '@/lib/api/support';
import { useSessionStore } from '@/stores/session';
import { usePlatformSession } from '@/stores/platform-session';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput, TextArea } from '@/components/ui/Field';
import { Combobox } from '@/components/ui/Combobox';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';

/**
 * Equipes de suporte (Fase 3 — SUP-04). **Uma tela para os dois lados:** o cliente em
 * `/support/teams` e a Septem em `/platform/support/teams`.
 *
 * <p>
 * Por que não duas telas: a diferença entre os lados é só o token e quem pode entrar na equipe —
 * tudo o mais (criar, renomear, desativar, incluir e remover membro) é idêntico. Duplicar a tela
 * duplicaria a regra de quando cada botão aparece, que é exatamente o que não pode divergir.
 * </p>
 */
export function EquipesSuportePage({ escopo }: { escopo: SupportScope }) {
  const equipes = useSupportTeams(escopo);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<SupportTeam | null>(null);

  // No lado do cliente, administrar equipes exige a permissão CONCEDIDA — o curinga `*` não
  // serve, igual ao backend (S-A03). Repetir a regra aqui é só para a tela explicar o que falta;
  // quem recusa de verdade é o servidor.
  // Seletor que devolve BOOLEANO, não a lista: `s.user?.perms ?? []` cria um array novo a cada
  // leitura, e no lado central (onde não há sessão de ambiente) isso levava o store a se
  // considerar sempre mudado — a tela entrava em laço de renderização e caía no erro do React.
  const temPermissao = useSessionStore((s) => s.user?.perms.includes(SUPPORT_TEAM_ADMIN) ?? false);
  const podeAdministrar = escopo === 'septem' || temPermissao;

  const lista = equipes.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">Equipes de suporte</h1>
          <p className="text-sm text-slate-500">
            {escopo === 'septem'
              ? 'Equipes da Septem que atendem os chamados encaminhados pela triagem.'
              : 'Equipes do seu órgão que atendem os chamados abertos aqui dentro.'}
          </p>
        </div>
        {podeAdministrar && (
          <button
            type="button"
            onClick={() => setCriando(true)}
            data-testid="nova-equipe"
            className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            <Plus size={16} /> Nova equipe
          </button>
        )}
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {!podeAdministrar && (
          <div
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            data-testid="equipes-sem-permissao"
            role="status"
          >
            Você vê apenas as equipes de que participa. Gerenciar equipes depende da permissão{' '}
            <code className="rounded bg-amber-100 px-1">{SUPPORT_TEAM_ADMIN}</code>, concedida no perfil de acesso.
          </div>
        )}

        {equipes.isLoading && <p className="text-sm text-slate-400">Carregando…</p>}

        {equipes.isError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" data-testid="equipes-erro">
            Não foi possível carregar as equipes.{' '}
            <button type="button" onClick={() => void equipes.refetch()} className="font-medium underline">
              Tentar de novo
            </button>
          </div>
        )}

        {!equipes.isLoading && !equipes.isError && lista.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="equipes-vazio">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Users size={26} />
            </div>
            <p className="text-sm font-medium text-slate-700">Nenhuma equipe ainda</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              A equipe é o que define quem enxerga um chamado. Sem equipe, o atendimento fica só com a triagem.
            </p>
          </div>
        )}

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((equipe) => (
            <CartaoEquipe
              key={equipe.id}
              escopo={escopo}
              equipe={equipe}
              podeAdministrar={podeAdministrar}
              onEditar={() => setEditando(equipe)}
            />
          ))}
        </ul>

        {escopo === 'septem' && <PapeisDaSeptem />}
      </div>

      {criando && <DialogoEquipe escopo={escopo} onClose={() => setCriando(false)} />}
      {editando && <DialogoEquipe escopo={escopo} equipe={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}

function CartaoEquipe({
  escopo, equipe, podeAdministrar, onEditar,
}: {
  escopo: SupportScope;
  equipe: SupportTeam;
  podeAdministrar: boolean;
  onEditar: () => void;
}) {
  const [incluindo, setIncluindo] = useState(false);
  const remover = useRemoveSupportMember(escopo);

  async function pedirRemocao(userId: string, nome: string) {
    const ok = await confirm({
      title: 'Remover da equipe?',
      message: `${nome} deixa de receber chamados desta equipe. O histórico e as horas já registradas ficam.`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remover.mutateAsync({ teamId: equipe.id, userId });
      toast.success(`${nome} saiu da equipe.`);
    } catch {
      toast.error('Falha ao remover o membro.');
    }
  }

  return (
    <li
      className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="equipe-cartao"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900" data-testid="equipe-nome">{equipe.name}</h2>
          {equipe.description && <p className="mt-0.5 text-xs text-slate-500">{equipe.description}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            equipe.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
          data-testid="equipe-situacao"
        >
          {equipe.active ? 'Ativa' : 'Inativa'}
        </span>
      </div>

      <ul className="mt-3 flex-1 space-y-1.5">
        {equipe.members.length === 0 && (
          <li className="text-xs text-slate-400">Sem membros — ninguém recebe chamado desta equipe ainda.</li>
        )}
        {equipe.members.map((m) => (
          <li key={m.userId} className="flex min-w-0 items-center gap-2 text-sm" data-testid="equipe-membro">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
              {m.platform ? <ShieldCheck size={13} /> : <Users size={13} />}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-700">{m.name}</span>
            {podeAdministrar && (
              <button
                type="button"
                onClick={() => void pedirRemocao(m.userId, m.name)}
                title={`Remover ${m.name}`}
                aria-label={`Remover ${m.name}`}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
              >
                <UserMinus size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {podeAdministrar && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setIncluindo(true)}
            data-testid="incluir-membro"
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <UserPlus size={14} /> Incluir membro
          </button>
          <button
            type="button"
            onClick={onEditar}
            data-testid="editar-equipe"
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <Pencil size={14} /> Editar
          </button>
        </div>
      )}

      {incluindo && <DialogoMembro escopo={escopo} equipe={equipe} onClose={() => setIncluindo(false)} />}
    </li>
  );
}

/** Criar e editar compartilham o formulário: os campos são os mesmos, e a diferença é só o verbo. */
function DialogoEquipe({
  escopo, equipe, onClose,
}: {
  escopo: SupportScope;
  equipe?: SupportTeam;
  onClose: () => void;
}) {
  const [name, setName] = useState(equipe?.name ?? '');
  const [description, setDescription] = useState(equipe?.description ?? '');
  const [active, setActive] = useState(equipe?.active ?? true);
  const criar = useCreateSupportTeam(escopo);
  const alterar = useUpdateSupportTeam(escopo);
  const salvando = criar.isPending || alterar.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (equipe) {
        await alterar.mutateAsync({ id: equipe.id, name, description: description || null, active });
        toast.success(`Equipe "${name}" atualizada.`);
      } else {
        await criar.mutateAsync({ name, description: description || null });
        toast.success(`Equipe "${name}" criada.`);
      }
      onClose();
    } catch {
      toast.error(equipe ? 'Falha ao atualizar a equipe.' : 'Falha ao criar a equipe.');
    }
  }

  return (
    <Dialog open onClose={onClose} title={equipe ? 'Editar equipe' : 'Nova equipe'}>
      <form onSubmit={submit} className="flex flex-col gap-3" data-testid="form-equipe">
        <Field label="Nome" help="Como a equipe aparece na fila e no chamado.">
          <TextInput name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus />
        </Field>
        <Field label="Descrição" help="Opcional — o que esta equipe atende.">
          <TextArea name="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
        </Field>
        {equipe && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="active" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Equipe ativa
          </label>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || !name.trim()}
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {equipe ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function DialogoMembro({
  escopo, equipe, onClose,
}: {
  escopo: SupportScope;
  equipe: SupportTeam;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [userId, setUserId] = useState('');
  const candidatos = useSupportCandidates(escopo, busca);
  const incluir = useAddSupportMember(escopo);

  // Quem já é membro não aparece: oferecer a pessoa duas vezes só produz um clique sem efeito.
  const jaMembros = new Set(equipe.members.map((m) => m.userId));
  const opcoes = (candidatos.data ?? [])
    .filter((c) => !jaMembros.has(c.userId))
    .map((c) => ({ value: c.userId, label: c.email ? `${c.name} · ${c.email}` : c.name }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const escolhido = (candidatos.data ?? []).find((c) => c.userId === userId);
    try {
      await incluir.mutateAsync({ teamId: equipe.id, userId });
      toast.success(`${escolhido?.name ?? 'Membro'} entrou na equipe.`);
      onClose();
    } catch {
      toast.error('Falha ao incluir o membro.');
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Incluir membro em ${equipe.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3" data-testid="form-membro">
        <Field
          label={escopo === 'septem' ? 'Pessoa da equipe Septem' : 'Usuário do ambiente'}
          help="A busca procura por nome e e-mail."
        >
          <Combobox
            value={userId}
            options={opcoes}
            onChange={setUserId}
            onQueryChange={setBusca}
            placeholder={candidatos.isLoading ? 'Carregando…' : 'Selecione a pessoa'}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!userId || incluir.isPending}
            data-testid="confirmar-membro"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Incluir
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Papéis centrais de suporte — só o SUPER ADMIN vê e mexe.
 *
 * <p>
 * Mora aqui, embaixo das equipes, porque é a outra metade da mesma pergunta: a equipe diz quem
 * atende um chamado encaminhado; o papel diz quem pode receber e encaminhar. Antes desta seção os
 * papéis eram respeitados pela autorização mas não havia como concedê-los — só o super admin
 * nascia, pelo bootstrap, e a fila de triagem ficava sem ninguém.
 * </p>
 */
function PapeisDaSeptem() {
  const ehSuperAdmin = usePlatformSession((s) => s.identity?.roles.includes('super_admin') ?? false);
  const pessoas = usePlatformIdentities(ehSuperAdmin);
  const definir = useSetPlatformRole();

  if (!ehSuperAdmin) return null;

  async function alternar(userId: string, nome: string, role: string, label: string, conceder: boolean) {
    try {
      await definir.mutateAsync({ userId, role, conceder });
      toast.success(conceder ? `${nome} agora é ${label.toLowerCase()}.` : `${nome} não é mais ${label.toLowerCase()}.`);
    } catch {
      toast.error('Falha ao alterar o papel.');
    }
  }

  return (
    <section className="mt-8" data-testid="papeis-septem">
      <h2 className="text-sm font-semibold text-slate-900">Pessoas da Septem</h2>
      <p className="mb-3 text-sm text-slate-500">
        Quem pode operar a triagem e atender. Revogar o papel corta o acesso, mas não apaga o que a
        pessoa já registrou.
      </p>

      {pessoas.isLoading && <p className="text-sm text-slate-400">Carregando…</p>}

      <ul className="grid gap-2 lg:grid-cols-2">
        {(pessoas.data ?? []).map((p) => (
          <li
            key={p.userId}
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            data-testid="pessoa-septem"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
              <p className="truncate text-xs text-slate-500">{p.email}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {PAPEIS_DE_SUPORTE.map((papel) => {
                const tem = p.roles.includes(papel.role);
                return (
                  <button
                    key={papel.role}
                    type="button"
                    title={papel.help}
                    disabled={definir.isPending}
                    aria-pressed={tem}
                    data-testid={`papel-${papel.role}`}
                    onClick={() => void alternar(p.userId, p.name, papel.role, papel.label, !tem)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                      tem
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {papel.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  useUsersList,
  useUser,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type UserListItem,
  type CreatedUser,
} from '@/lib/api/users';
import { useAccessProfiles } from '@/lib/api/access-profiles';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';

/**
 * Admin › Configurações › Usuários — IF1.b. Lista com busca + status + paginação,
 * criar (mostra senha inicial uma vez), editar (status + perfis de acesso) e
 * soft-delete via ConfirmDialog.
 */
export function UsuariosPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const list = useUsersList({ q: q || undefined, status: status || undefined, page, pageSize });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const del = useDeleteUser();

  async function askDelete(user: UserListItem) {
    const ok = await confirm({
      title: 'Desativar usuário?',
      message: `O acesso de ${user.name} (${user.email}) será desativado. Você poderá reativar depois.`,
      confirmLabel: 'Desativar',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(user.id);
      toast.success(`Usuário ${user.name} desativado.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao desativar.');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Usuários</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          <Plus size={16} /> Novo usuário
        </button>
      </header>

      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar por nome ou e-mail..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          <option value="active">Ativos</option>
          <option value="disabled">Desativados</option>
          <option value="invited">Convidados</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-left">E-mail</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Acesso</th>
              <th className="px-4 py-2 w-20" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>
            )}
            {!list.isLoading && (list.data?.items.length ?? 0) === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nenhum usuário encontrado.</td></tr>
            )}
            {list.data?.items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-2 text-slate-600">{u.email}</td>
                <td className="px-4 py-2"><StatusBadge status={u.status} /></td>
                <td className="px-4 py-2 text-slate-600">{u.isInternal ? 'Interno' : 'Externo'}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditId(u.id)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => askDelete(u)}
                      className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                      title="Desativar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{total} usuário{total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-300 p-1 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span>{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-300 p-1 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editId && <EditUserDialog id={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

function StatusBadge({ status }: { status: UserListItem['status'] }) {
  const map: Record<UserListItem['status'], { label: string; cls: string }> = {
    active:   { label: 'Ativo',     cls: 'bg-emerald-100 text-emerald-700' },
    disabled: { label: 'Desativado', cls: 'bg-slate-200 text-slate-600' },
    invited:  { label: 'Convidado', cls: 'bg-amber-100 text-amber-700' },
  };
  const v = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

// ---------------------------------------------------------------------------
function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [result, setResult] = useState<CreatedUser | null>(null);
  const create = useCreateUser();

  function handleClose() {
    setName(''); setEmail(''); setIsInternal(true); setResult(null);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await create.mutateAsync({ name, email, isInternal });
      setResult(created);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 409 ? 'E-mail já em uso.' : 'Não foi possível criar.';
      toast.error(msg);
    }
  }

  if (result) {
    return (
      <Dialog open={open} onClose={handleClose} title="Usuário criado" footer={
        <button onClick={handleClose} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Fechar</button>
      }>
        <p className="text-sm text-slate-700">
          <strong>{result.name}</strong> foi criado.
        </p>
        <p className="mt-3 text-sm text-slate-600">Senha inicial (anote agora — não será mostrada de novo):</p>
        <code className="mt-1 block break-all rounded bg-slate-100 px-3 py-2 font-mono text-sm">{result.initialPassword}</code>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Novo usuário" footer={
      <>
        <button onClick={handleClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button
          form="create-user-form"
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >Criar</button>
      </>
    }>
      <form id="create-user-form" className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Nome">
          <TextInput required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="E-mail">
          <TextInput required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
          Usuário interno (funcionário)
        </label>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function EditUserDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const user = useUser(id);
  const profiles = useAccessProfiles();
  const update = useUpdateUser();

  const [name, setName] = useState('');
  const [status, setStatus] = useState<'active' | 'disabled' | 'invited'>('active');
  const [profileIds, setProfileIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  if (user.data && !hydrated) {
    setName(user.data.name);
    setStatus(user.data.status);
    setProfileIds(new Set(user.data.accessProfiles.map((p) => p.id)));
    setHydrated(true);
  }

  function toggleProfile(pid: string) {
    setProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ id, body: { name, status, accessProfileIds: Array.from(profileIds) } });
      toast.success('Alterações salvas.');
      onClose();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <Dialog open onClose={onClose} title="Editar usuário" width="lg" footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button
          form="edit-user-form"
          type="submit"
          disabled={!user.data || update.isPending}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >Salvar</button>
      </>
    }>
      {!user.data && <p className="text-sm text-slate-500">Carregando...</p>}
      {user.data && (
        <form id="edit-user-form" className="flex flex-col gap-3" onSubmit={submit}>
          <Field label="Nome">
            <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-mail">
            <TextInput value={user.data.email} readOnly className="bg-slate-50 text-slate-500" />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'disabled' | 'invited')}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="active">Ativo</option>
              <option value="disabled">Desativado</option>
              <option value="invited">Convidado</option>
            </select>
          </Field>
          <Field label="Perfis de acesso">
            <div className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-2">
              {profiles.isLoading && <span className="text-xs text-slate-400">Carregando perfis...</span>}
              {profiles.data?.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={profileIds.has(p.id)} onChange={() => toggleProfile(p.id)} />
                  <span className="text-slate-700">{p.name}</span>
                  {p.isSystem && <span className="rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-600">sistema</span>}
                </label>
              ))}
              {profiles.data && profiles.data.length === 0 && <span className="text-xs text-slate-400">Nenhum perfil cadastrado.</span>}
            </div>
          </Field>
        </form>
      )}
    </Dialog>
  );
}

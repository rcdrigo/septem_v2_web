import { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  useUsersList,
  useUser,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type UserListItem,
  type UserCadastral,
  type UserPositionRef,
  type CreatedUser,
} from '@/lib/api/users';
import { useAccessProfiles } from '@/lib/api/access-profiles';
import { useOrgUnitsFlat } from '@/lib/api/org-units';
import { usePositions } from '@/lib/api/positions';
import { maskCpf, maskPhone, isValidCpf } from '@/lib/masks';
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
  const [cadastral, setCadastral] = useState<UserCadastral>({});
  const [result, setResult] = useState<CreatedUser | null>(null);
  const create = useCreateUser();

  function handleClose() {
    setName(''); setEmail(''); setIsInternal(true); setCadastral({}); setResult(null);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cadastral.cpf && !isValidCpf(cadastral.cpf)) { toast.error('CPF inválido.'); return; }
    try {
      const created = await create.mutateAsync({ name, email, isInternal, ...cadastral });
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
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 break-all rounded bg-slate-100 px-3 py-2 font-mono text-sm">{result.initialPassword}</code>
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(result.initialPassword).then(() => toast.success('Senha copiada.')); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Copy size={14} /> Copiar
          </button>
        </div>
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
        <CadastralGrid value={cadastral} onChange={setCadastral} />
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
  const [cadastral, setCadastral] = useState<UserCadastral>({});
  const [positions, setPositions] = useState<UserPositionRef[]>([]);
  const [hydrated, setHydrated] = useState(false);

  if (user.data && !hydrated) {
    setName(user.data.name);
    setStatus(user.data.status);
    setProfileIds(new Set(user.data.accessProfiles.map((p) => p.id)));
    setCadastral({ rg: user.data.rg, cpf: user.data.cpf, matricula: user.data.matricula, telefone: user.data.telefone, cargo: user.data.cargo });
    setPositions(user.data.positions);
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
    if (cadastral.cpf && !isValidCpf(cadastral.cpf)) { toast.error('CPF inválido.'); return; }
    try {
      await update.mutateAsync({ id, body: {
        name, status, accessProfileIds: Array.from(profileIds),
        positionIds: positions.map((p) => p.id), ...cadastral,
      } });
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
          <CadastralGrid value={cadastral} onChange={setCadastral} />
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
          <Field label="Unidades e posições">
            <PositionsEditor positions={positions} onChange={setPositions} />
          </Field>
        </form>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
/** Campos cadastrais opcionais (RG, CPF, matrícula, telefone, cargo). */
function CadastralGrid({ value, onChange }: { value: UserCadastral; onChange: (v: UserCadastral) => void }) {
  const set = (k: keyof UserCadastral) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const cpfInvalid = !!value.cpf && !isValidCpf(value.cpf);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="CPF">
        <TextInput
          value={value.cpf ?? ''}
          inputMode="numeric"
          placeholder="000.000.000-00"
          aria-invalid={cpfInvalid}
          className={cpfInvalid ? 'border-rose-400' : undefined}
          onChange={(e) => onChange({ ...value, cpf: maskCpf(e.target.value) })}
        />
        {cpfInvalid && <span className="mt-0.5 block text-xs text-rose-600">CPF inválido.</span>}
      </Field>
      <Field label="RG"><TextInput value={value.rg ?? ''} onChange={set('rg')} /></Field>
      <Field label="Matrícula"><TextInput value={value.matricula ?? ''} onChange={set('matricula')} /></Field>
      <Field label="Telefone">
        <TextInput
          value={value.telefone ?? ''}
          inputMode="numeric"
          placeholder="(00) 00000-0000"
          onChange={(e) => onChange({ ...value, telefone: maskPhone(e.target.value) })}
        />
      </Field>
      <div className="col-span-2"><Field label="Cargo"><TextInput value={value.cargo ?? ''} onChange={set('cargo')} /></Field></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
/** Atribui unidades organizacionais + posições ao usuário (mapeia para positionIds). */
function PositionsEditor({ positions, onChange }: { positions: UserPositionRef[]; onChange: (v: UserPositionRef[]) => void }) {
  const [orgId, setOrgId] = useState('');
  const [posId, setPosId] = useState('');
  const orgs = useOrgUnitsFlat();
  const orgPositions = usePositions(orgId || null);

  function add() {
    if (!posId) return;
    if (positions.some((p) => p.id === posId)) return;
    const org = orgs.data?.find((o) => o.id === orgId);
    const pos = orgPositions.data?.find((p) => p.id === posId);
    if (!org || !pos) return;
    onChange([...positions, { id: pos.id, key: pos.key, name: pos.name, orgUnitId: org.id, orgUnitName: org.name }]);
    setPosId('');
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      {positions.length === 0 && <span className="text-xs text-slate-400">Nenhuma posição atribuída.</span>}
      {positions.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-sm">
          <span className="text-slate-700"><span className="text-slate-400">{p.orgUnitName} ·</span> {p.name}</span>
          <button type="button" onClick={() => onChange(positions.filter((x) => x.id !== p.id))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button>
        </div>
      ))}
      <div className="flex items-end gap-2">
        <label className="flex-1 text-xs text-slate-500">
          Unidade
          <select value={orgId} onChange={(e) => { setOrgId(e.target.value); setPosId(''); }} className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm">
            <option value="">Selecione…</option>
            {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label className="flex-1 text-xs text-slate-500">
          Posição
          <select value={posId} onChange={(e) => setPosId(e.target.value)} disabled={!orgId} className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-100">
            <option value="">Selecione…</option>
            {orgPositions.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={add} disabled={!posId} className="rounded-md bg-slate-700 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40">Adicionar</button>
      </div>
    </div>
  );
}

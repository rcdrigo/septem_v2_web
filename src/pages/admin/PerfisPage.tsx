import { useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  useAccessProfiles,
  usePermissionsCatalog,
  useCreateAccessProfile,
  useUpdateAccessProfile,
  useDeleteAccessProfile,
  type AccessProfile,
  type Permission,
} from '@/lib/api/access-profiles';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput, TextArea } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';

/** Rótulos amigáveis para os prefixos de permission (parte antes do `:`). */
const GROUP_LABELS: Record<string, string> = {
  workflow: 'Processos',
  reports: 'Relatórios',
  admin: 'Configurações',
  users: 'Usuários',
  org: 'Unidades e posições',
  profiles: 'Perfis de acesso',
  audit: 'Auditoria',
};

/**
 * Admin › Configurações › Perfis — IF1.d. Lista perfis de acesso e edita a
 * **matriz de permissions** (agrupada por recurso). Perfis de sistema são
 * somente-leitura (não editáveis nem removíveis — o backend devolve 409 no delete).
 */
export function PerfisPage() {
  const profiles = useAccessProfiles();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<AccessProfile | null>(null);
  const del = useDeleteAccessProfile();

  async function askDelete(p: AccessProfile) {
    const ok = await confirm({
      title: 'Excluir perfil?',
      message: `"${p.name}" será removido. Usuários vinculados perdem essas permissões.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(p.id);
      toast.success(`Perfil "${p.name}" excluído.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast.error('Perfis de sistema não podem ser excluídos.');
      else toast.error('Falha ao excluir o perfil.');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Perfis de acesso</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          <Plus size={16} /> Novo perfil
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Perfil</th>
              <th className="px-4 py-2 text-left">Descrição</th>
              <th className="px-4 py-2 text-left">Usuários</th>
              <th className="px-4 py-2 text-left">Permissões</th>
              <th className="px-4 py-2 w-20" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {profiles.isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
            {profiles.data?.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">
                  <span className="inline-flex items-center gap-2">
                    {p.name}
                    {p.isSystem && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                        <ShieldCheck size={11} /> sistema
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">{p.description ?? '—'}</td>
                <td className="px-4 py-2 text-slate-600">{p.userCount}</td>
                <td className="px-4 py-2 text-slate-600">{p.permissions.length}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => setEditProfile(p)} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" title={p.isSystem ? 'Ver permissões' : 'Editar'}>
                      <Pencil size={15} />
                    </button>
                    {!p.isSystem && (
                      <button type="button" onClick={() => askDelete(p)} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && <ProfileDialog onClose={() => setCreateOpen(false)} />}
      {editProfile && <ProfileDialog profile={editProfile} onClose={() => setEditProfile(null)} />}
    </div>
  );
}

function ProfileDialog({ profile, onClose }: { profile?: AccessProfile; onClose: () => void }) {
  const catalog = usePermissionsCatalog();
  const create = useCreateAccessProfile();
  const update = useUpdateAccessProfile();
  const readOnly = profile?.isSystem ?? false;

  const [name, setName] = useState(profile?.name ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(profile?.permissions ?? []));

  const groups = groupPermissions(catalog.data ?? []);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    const body = { name, description: description || undefined, permissions: Array.from(selected) };
    try {
      if (profile) await update.mutateAsync({ id: profile.id, body });
      else await create.mutateAsync(body);
      toast.success(profile ? 'Perfil atualizado.' : `Perfil "${name}" criado.`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast.error('Já existe um perfil com esse nome.');
      else toast.error('Não foi possível salvar o perfil.');
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog
      open
      onClose={onClose}
      width="lg"
      title={profile ? (readOnly ? `Perfil "${profile.name}" (sistema)` : 'Editar perfil') : 'Novo perfil'}
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button form="profile-form" type="submit" disabled={pending || !name}
              className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
              Salvar
            </button>
          )}
        </>
      }
    >
      <form id="profile-form" className="flex flex-col gap-3" onSubmit={submit}>
        {readOnly && (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-500">
            Perfil de sistema — somente leitura.
          </p>
        )}
        <Field label="Nome">
          <TextInput required readOnly={readOnly} value={name} onChange={(e) => setName(e.target.value)} className={readOnly ? 'bg-slate-50 text-slate-500' : ''} />
        </Field>
        <Field label="Descrição">
          <TextArea rows={2} readOnly={readOnly} value={description} onChange={(e) => setDescription(e.target.value)} className={readOnly ? 'bg-slate-50 text-slate-500' : ''} />
        </Field>

        <Field label="Permissões">
          <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            {catalog.isLoading && <span className="text-xs text-slate-400">Carregando permissões...</span>}
            {groups.map(({ prefix, label, perms }) => (
              <div key={prefix}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {perms.map((perm) => (
                    <label key={perm.key} className={`flex items-start gap-2 text-sm ${readOnly ? 'opacity-70' : ''}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        disabled={readOnly}
                        checked={selected.has(perm.key)}
                        onChange={() => toggle(perm.key)}
                      />
                      <span className="leading-tight">
                        <span className="text-slate-700">{perm.description}</span>
                        <code className="ml-1 text-[11px] text-slate-400">{perm.key}</code>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Field>
      </form>
    </Dialog>
  );
}

function groupPermissions(perms: Permission[]): { prefix: string; label: string; perms: Permission[] }[] {
  const byPrefix = new Map<string, Permission[]>();
  for (const p of perms) {
    const prefix = p.key.split(':')[0];
    (byPrefix.get(prefix) ?? byPrefix.set(prefix, []).get(prefix)!).push(p);
  }
  return Array.from(byPrefix.entries()).map(([prefix, list]) => ({
    prefix,
    label: GROUP_LABELS[prefix] ?? prefix,
    perms: list,
  }));
}

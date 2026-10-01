import { useMemo, useState, type FormEvent } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { platformApi } from '@/lib/platform-api';
import { usePlatformClients, useResendSuperAdminInvite, useSaveSuperAdmin, useSuperAdmins, type PlatformClientDetail, type SuperAdminRow } from '@/lib/api/platform-clients';
import { useDocumentTitle } from '@/lib/use-document-title';
import { usePlatformSession } from '@/stores/platform-session';

const blank: SuperAdminRow = { id: '', version: 0, name: '', email: '', status: 'active', globalAccess: false, clients: [], environments: [] };

export function PlatformSuperAdminsPage() {
  const admins = useSuperAdmins();
  const clients = usePlatformClients();
  const save = useSaveSuperAdmin();
  const resend = useResendSuperAdminInvite();
  const globalAccess = usePlatformSession((state) => state.identity?.globalAccess === true);
  const [form, setForm] = useState<SuperAdminRow>(blank);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const environmentQueries = useQueries({ queries: (clients.data?.items ?? []).map((client) => ({
    queryKey: ['platform', 'clients', client.id],
    queryFn: () => platformApi.get<PlatformClientDetail>('/clients/' + client.id),
    enabled: globalAccess,
  })) });
  const environments = useMemo(() => environmentQueries.flatMap((query) => query.data?.environments ?? []), [environmentQueries]);
  useDocumentTitle('Usuários · área central');

  if (!globalAccess) return <section className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">Somente super administradores globais podem gerenciar estes acessos.</section>;

  function toggle(values: string[], value: string) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    if (!form.id && form.status === 'active' && !form.globalAccess && form.clients.length === 0 && form.environments.length === 0) {
      setError('Escolha pelo menos um cliente ou ambiente para conceder acesso.');
      return;
    }
    try {
      const { version, ...input } = form;
      const result = await save.mutateAsync({ ...input, id: form.id || crypto.randomUUID(), expectedVersion: form.id ? version : undefined });
      setNotice(result.created
        ? result.invitationSent
          ? 'Acesso criado. Um código foi enviado para definir a senha.'
          : 'Acesso criado, mas o envio do código falhou. Reenvie o convite na lista.'
        : 'Acesso atualizado.');
      setForm(blank);
    } catch (error) {
      setError(error instanceof ApiError && error.status === 409
        ? 'Este acesso foi alterado por outra pessoa. Recarregue a lista e abra a edição novamente.'
        : 'Não foi possível salvar o acesso. Confira o e-mail e tente novamente.');
      if (error instanceof ApiError && error.status === 409) void admins.refetch();
    }
  }

  return <section className="max-w-4xl">
    <h1 className="text-lg font-semibold text-slate-900">Usuários</h1>
    <p className="mt-1 text-sm text-slate-600">Acesso global permite cadastrar clientes e administrar outras identidades centrais. O acesso restrito vale somente para os clientes e ambientes escolhidos.</p>
    {(admins.isLoading || clients.isLoading) && <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando acessos…</p>}
    {(admins.isError || clients.isError) && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Não foi possível carregar as identidades e os clientes.</p>}
    {notice && <p role="status" className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

    <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{form.id ? 'Editar acesso' : 'Adicionar usuário'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-700">Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="min-h-10 rounded-md border border-slate-300 px-3" /></label>
        <label className="grid gap-1 text-sm text-slate-700">E-mail<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="min-h-10 rounded-md border border-slate-300 px-3" /></label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.globalAccess} onChange={(e) => setForm({ ...form, globalAccess: e.target.checked, clients: [], environments: [] })} />Acesso global à plataforma</label>
      <label className="grid max-w-xs gap-1 text-sm text-slate-700">Estado do acesso<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="min-h-10 rounded-md border border-slate-300 px-3"><option value="active">Ativo</option><option value="disabled">Inativado</option></select></label>
      {!form.globalAccess && <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium text-slate-900">Clientes (inclui ambientes futuros)</legend>
          {(clients.data?.items ?? []).map((client) => <label key={client.id} className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.clients.includes(client.id)} onChange={() => setForm({ ...form, clients: toggle(form.clients, client.id) })} /><span>{client.name}</span></label>)}
          {(clients.data?.items.length ?? 0) === 0 && <p className="text-xs text-slate-500">Nenhum cliente disponível.</p>}
        </fieldset>
        <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium text-slate-900">Ambientes específicos (não inclui ambientes futuros)</legend>
          {environments.map((environment) => <label key={environment.tenantId} className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.environments.includes(environment.tenantId)} onChange={() => setForm({ ...form, environments: toggle(form.environments, environment.tenantId) })} /><span>{environment.displayName || environment.tenantId}<span className="block text-xs text-slate-500">{environment.host}</span></span></label>)}
          {clients.data && environments.length === 0 && <p className="text-xs text-slate-500">Nenhum ambiente disponível.</p>}
        </fieldset>
      </div>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={save.isPending} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-50">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{form.id ? 'Salvar acesso' : 'Adicionar e enviar código'}</button>
        {form.id && <button type="button" onClick={() => setForm(blank)} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-700">Cancelar edição</button>}
      </div>
    </form>

    <section className="mt-6">
      <h2 className="text-sm font-semibold text-slate-900">Acessos existentes</h2>
      {admins.data?.items.length === 0 && <p className="mt-2 text-sm text-slate-500">Nenhum super administrador cadastrado.</p>}
      <ul className="mt-2 divide-y divide-slate-200 border-y border-slate-200">
        {(admins.data?.items ?? []).map((admin) => <li key={admin.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><p className="font-medium text-slate-900">{admin.name}</p><p className="text-sm text-slate-500">{admin.email} · {admin.globalAccess ? 'Acesso global' : admin.clients.length + ' cliente(s), ' + admin.environments.length + ' ambiente(s)'} · {admin.status === 'active' ? 'Ativo' : 'Inativado'}</p></div>
          <div className="flex gap-2">
            {admin.status === 'active' && <button type="button" disabled={resend.isPending} onClick={() => void resend.mutateAsync(admin.id).then((result) => { setError(null); setNotice(result.invitationSent ? 'Novo código de configuração enviado.' : 'O código não foi enviado. Tente novamente mais tarde.'); }).catch((err: unknown) => {
              const code = err instanceof ApiError ? (err.body as { error?: string } | undefined)?.error : undefined;
              setNotice(null);
              setError(code === 'already_activated' ? 'Esta conta já definiu uma senha e não precisa de um novo código.' : code === 'wait_before_resending' ? 'Um código foi enviado recentemente. Aguarde antes de solicitar outro.' : 'Não foi possível enviar outro código.');
            })} className="min-h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Reenviar código</button>}
            <button type="button" onClick={() => { setForm({ ...admin }); setError(null); setNotice(null); }} className="min-h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50">Editar</button>
          </div>
        </li>)}
      </ul>
    </section>
  </section>;
}

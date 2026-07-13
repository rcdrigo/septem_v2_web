import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Monitor, Save, Trash2, User as UserIcon } from 'lucide-react';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/use-document-title';
import { MudarSenhaDialog } from '@/components/MudarSenhaDialog';
import { useTrustedDevices, useRemoveDevice, useSaveProfile, type Profile } from '@/lib/api/account';

/**
 * Meus dados (Fase 2). O usuário edita o que é dele — nome, e-mail, matrícula,
 * telefone e foto. Tipo de acesso, perfis e permissões NÃO aparecem aqui: quem
 * define isso é o admin, em Configurações › Usuários.
 * Ao lado, a tabela de dispositivos confiáveis do 2FA (com remoção).
 */
export function MeuDadosPage() {
  useDocumentTitle('Meus dados');
  const user = useSessionStore((s) => s.user);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const save = useSaveProfile();

  const [form, setForm] = useState<Profile | null>(null);
  const [senhaAberta, setSenhaAberta] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      email: user.email,
      matricula: user.matricula ?? null,
      telefone: user.telefone ?? null,
      photoUrl: user.photoUrl ?? null,
    });
  }, [user]);

  if (!user || !form) return <div className="p-6 text-sm text-slate-400">Carregando...</div>;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      await save.mutateAsync(form);
      await bootstrap();   // nome/foto mudam no cabeçalho sem recarregar
      toast.success('Dados salvos.');
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { error?: string; detail?: string } | undefined) : undefined;
      toast.error(body?.detail ?? (body?.error === 'invalid_email' ? 'E-mail inválido.' : 'Não foi possível salvar.'));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold text-slate-900">Meus dados</h1>
        <button
          type="button"
          onClick={() => setSenhaAberta(true)}
          className="flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <KeyRound size={16} /> Mudar senha
        </button>
      </header>

      {/* 50% card / 50% tabela no desktop; empilhado no mobile. */}
      <div className="grid flex-1 gap-5 overflow-auto p-4 sm:p-6 lg:grid-cols-2">
        <form
          onSubmit={submit}
          className="space-y-4 rounded-md border border-slate-200 bg-white p-4 sm:p-5"
          data-testid="form-meus-dados"
        >
          <div className="flex items-center gap-4">
            <Foto url={form.photoUrl} nome={form.name} />
            <div className="min-w-0 flex-1">
              <Campo label="URL da foto">
                <input
                  value={form.photoUrl ?? ''}
                  onChange={(e) => set('photoUrl', e.target.value || null)}
                  placeholder="https://..."
                  className={inputCls}
                  name="photoUrl"
                />
              </Campo>
            </div>
          </div>

          <Campo label="Nome" required>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              className={inputCls}
              name="name"
            />
          </Campo>

          <Campo label="E-mail" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
              className={inputCls}
              name="email"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Matrícula">
              <input
                value={form.matricula ?? ''}
                onChange={(e) => set('matricula', e.target.value || null)}
                className={inputCls}
                name="matricula"
              />
            </Campo>
            <Campo label="Telefone">
              <input
                value={form.telefone ?? ''}
                onChange={(e) => set('telefone', e.target.value || null)}
                placeholder="(00) 00000-0000"
                className={inputCls}
                name="telefone"
              />
            </Campo>
          </div>

          <button
            type="submit"
            disabled={save.isPending}
            className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
          </button>
        </form>

        <Dispositivos />
      </div>

      <MudarSenhaDialog open={senhaAberta} onClose={() => setSenhaAberta(false)} />
    </div>
  );
}

function Dispositivos() {
  const { data, isLoading } = useTrustedDevices();
  const remove = useRemoveDevice();

  async function remover(id: number, nome: string) {
    try {
      await remove.mutateAsync(id);
      toast.success(`"${nome}" removido. O próximo acesso nele vai pedir o código.`);
    } catch {
      toast.error('Não foi possível remover o dispositivo.');
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5" data-testid="dispositivos">
      <h2 className="text-sm font-semibold text-slate-900">Dispositivos confiáveis</h2>
      <p className="mb-4 mt-0.5 text-xs text-slate-500">
        Aparelhos em que a verificação em duas etapas não é mais pedida. Remover um deles faz o
        próximo acesso voltar a exigir o código.
      </p>

      {isLoading && <p className="text-sm text-slate-400">Carregando...</p>}

      {data && data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          Nenhum dispositivo confiável.
        </p>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-2 text-left font-medium">Dispositivo</th>
                <th className="py-2 text-left font-medium">Último acesso</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="py-2.5">
                    <span className="flex items-center gap-2 text-slate-800">
                      <Monitor size={15} className="shrink-0 text-slate-400" /> {d.name}
                    </span>
                    {d.ip && <span className="ml-6 text-xs text-slate-400">{d.ip}</span>}
                  </td>
                  <td className="py-2.5 text-slate-600">
                    {new Date(d.lastUsedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => remover(d.id, d.name)}
                      aria-label={`Remover ${d.name}`}
                      className="rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Foto({ url, nome }: { url: string | null; nome: string }) {
  if (url) {
    return <img src={url} alt={nome} className="h-16 w-16 shrink-0 rounded-full object-cover" data-testid="foto" />;
  }
  return (
    <span
      data-testid="foto"
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400"
    >
      <UserIcon size={26} />
    </span>
  );
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500';

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

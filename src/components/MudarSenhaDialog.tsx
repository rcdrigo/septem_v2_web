import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { PasswordChecklist, isPasswordValid } from '@/components/PasswordChecklist';
import { changePassword } from '@/lib/api/account';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';

/**
 * Mudar senha em MODAL (Fase 2 — antes era página própria). Mesmo checklist de
 * requisitos do reset. Trocar a senha revoga todos os refresh tokens no backend,
 * então o usuário é deslogado em seguida — é o comportamento correto, e a tela
 * avisa antes de fazer.
 */
export function MudarSenhaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const logout = useSessionStore((s) => s.logout);

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [salvando, setSalvando] = useState(false);

  const naoConfere = confirma.length > 0 && nova !== confirma;
  const podeSalvar = atual.length > 0 && isPasswordValid(nova) && nova === confirma && !salvando;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      await changePassword(atual, nova);
      toast.success('Senha alterada. Entre novamente com a nova senha.');
      await logout();
      window.location.assign(import.meta.env.BASE_URL + 'login');
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { error?: string } | undefined) : undefined;
      if (body?.error === 'invalid_current_password') toast.error('Senha atual incorreta.');
      else if (body?.error === 'weak_password') toast.error('A nova senha não atende aos requisitos.');
      else toast.error('Não foi possível alterar a senha.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Mudar senha" width="sm">
      <form onSubmit={submit} className="space-y-4" data-testid="form-mudar-senha">
        <Campo label="Senha atual">
          <input
            type="password"
            required
            name="currentPassword"
            autoComplete="current-password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            className={inputCls}
          />
        </Campo>

        <Campo label="Nova senha">
          <input
            type="password"
            required
            name="newPassword"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            className={inputCls}
          />
        </Campo>

        <PasswordChecklist password={nova} />

        <Campo label="Confirmar nova senha">
          <input
            type="password"
            required
            name="confirmPassword"
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            className={inputCls}
          />
        </Campo>
        {naoConfere && <p className="text-xs text-rose-600">As senhas não conferem.</p>}

        <p className="text-xs text-slate-500">
          Ao trocar a senha, as sessões abertas em outros dispositivos são encerradas.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!podeSalvar}
            className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {salvando && <Loader2 size={15} className="animate-spin" />} Alterar senha
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

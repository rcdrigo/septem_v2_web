import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, TextInput } from '@/components/ui/Field';
import { useChangePassword } from '@/lib/api/me';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';

/**
 * Mudar senha — IF1.e. Valida confirmação + tamanho mínimo no cliente; o backend
 * revoga todos os refresh tokens ao trocar a senha, então deslogamos em seguida.
 */
export function MudarSenhaPage() {
  const navigate = useNavigate();
  const logout = useSessionStore((s) => s.logout);
  const change = useChangePassword();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current && next.length >= 8 && next === confirm && !change.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      toast.success('Senha alterada. Faça login novamente.');
      await logout();
      navigate('/login');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) toast.error('Senha atual incorreta.');
      else toast.error('Não foi possível alterar a senha.');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Mudar senha</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={submit} className="max-w-md space-y-4 rounded-md border border-slate-200 bg-white p-5">
          <Field label="Senha atual">
            <TextInput type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
            <TextInput type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          {tooShort && <p className="-mt-2 text-xs text-rose-600">A nova senha precisa ter ao menos 8 caracteres.</p>}
          <Field label="Confirmar nova senha">
            <TextInput type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {mismatch && <p className="-mt-2 text-xs text-rose-600">As senhas não conferem.</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => navigate('/me')} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
            <button type="submit" disabled={!canSubmit} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
              Alterar senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

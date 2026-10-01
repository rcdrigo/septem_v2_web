import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useCompleteSuperAdminSetup } from '@/lib/api/platform-clients';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

export function PlatformSuperAdminSetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const complete = useCompleteSuperAdminSetup();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle('Definir acesso central · Septem');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 12) { setError('A senha precisa ter pelo menos 12 caracteres.'); return; }
    if (password !== confirmPassword) { setError('As senhas não correspondem.'); return; }
    try {
      await complete.mutateAsync({ email: email.trim(), code: code.trim(), password });
      navigate(routes.platformLogin, { replace: true });
    } catch {
      setError('O código pode ter expirado ou já ter sido usado. Peça um novo código ao administrador global.');
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8">
    <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <ShieldCheck className="mb-3 h-7 w-7 text-slate-700" />
      <h1 className="text-lg font-semibold text-slate-900">Defina seu acesso central</h1>
      <p className="mt-1 text-sm text-slate-600">Use o código enviado ao seu e-mail e escolha uma senha pessoal.</p>
      {error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm text-slate-700">E-mail<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-10 rounded-md border border-slate-300 px-3" /></label>
        <label className="grid gap-1 text-sm text-slate-700">Código de configuração<input required autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="min-h-10 rounded-md border border-slate-300 px-3" /></label>
        <label className="grid gap-1 text-sm text-slate-700">Senha (mínimo 12 caracteres)<input required type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-10 rounded-md border border-slate-300 px-3" /></label>
        <label className="grid gap-1 text-sm text-slate-700">Confirmar senha<input required type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="min-h-10 rounded-md border border-slate-300 px-3" /></label>
        <button type="submit" disabled={complete.isPending} className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50">{complete.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Definir senha</button>
      </form>
      <Link to={routes.platformLogin} className="mt-4 inline-block text-sm text-slate-600 underline underline-offset-2">Voltar ao login</Link>
    </section>
  </main>;
}


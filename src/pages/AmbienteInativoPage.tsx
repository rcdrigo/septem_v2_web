import { useEffect, useState } from 'react';
import { CircleSlash, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Ambiente inativado (ADM-07). Fica no lugar do login e é o **único** conteúdo visível:
 * nenhum dado carregado antes pode continuar atrás dela.
 *
 * O que mostrar vem de `GET /api/v1/environment-status`, a única rota que o backend
 * mantém de pé com o ambiente inativado — branding e modo, nada de banco ou diagnóstico.
 */
type Status = {
  clienteNome: string;
  ambienteNome: string;
  logoUrl?: string | null;
  primaryColor: string;
  operatingMode: string;
};

export function AmbienteInativoPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checando, setChecando] = useState(false);
  useDocumentTitle('Ambiente indisponível');

  async function checar() {
    setChecando(true);
    try {
      const atual = await apiFetch<Status>('/api/v1/environment-status', { anonymous: true });
      setStatus(atual);
      // Voltou ao ar: recarrega de verdade, para nada do estado anterior sobreviver.
      if (atual.operatingMode !== 'inactive') window.location.replace('/');
    } catch {
      // Sem status não há o que mostrar além da mensagem genérica.
    } finally {
      setChecando(false);
    }
  }

  useEffect(() => {
    void checar();
    // Volta do foco = a pessoa voltou para a aba; é o momento natural de reconferir,
    // sem ficar consultando o servidor em laço.
    const aoFocar = () => void checar();
    window.addEventListener('focus', aoFocar);
    return () => window.removeEventListener('focus', aoFocar);
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {status?.logoUrl ? (
          <img src={status.logoUrl} alt={status.clienteNome} className="mx-auto mb-4 max-h-16" />
        ) : (
          <CircleSlash className="mx-auto mb-4 h-10 w-10 text-slate-400" />
        )}

        <h1 className="text-lg font-semibold text-slate-900" data-testid="ambiente-inativo-titulo">
          Ambiente indisponível
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {status?.clienteNome
            ? `O ambiente ${status.ambienteNome || ''} de ${status.clienteNome} está inativado no momento.`
            : 'Este ambiente está inativado no momento.'}{' '}
          Entre em contato com a Septem para mais informações.
        </p>

        <button
          type="button"
          onClick={() => void checar()}
          disabled={checando}
          data-testid="ambiente-inativo-verificar"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {checando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Verificar novamente
        </button>
      </div>
    </div>
  );
}

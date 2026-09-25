import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DocumentValidationForm } from '@/components/public/DocumentValidationForm';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';
import { ContextHelp } from '@/components/guide/ContextHelp';

/**
 * Validação pública de documento (Fase 9), sem login.
 *
 * O QR impresso no papel já chega com número e código na URL — quem tem o documento
 * em mãos só resolve o captcha e consulta.
 */
export function ValidacaoPage() {
  const [params] = useSearchParams();
  const tenant = useSessionStore((s) => s.tenant);
  // Rota FORA do AppShell e sem login: precisa disparar o bootstrap por conta
  // própria. Sem isto o tenant não carrega numa visita DIRETA (logo, nome do órgão
  // e a chave do captcha ficam vazios) — e só funcionava por acidente, quando a
  // pessoa vinha da tela de login.
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const statusSessao = useSessionStore((s) => s.status);
  useEffect(() => { if (statusSessao === 'idle') void bootstrap(); }, [statusSessao, bootstrap]);

  useDocumentTitle('Validar documento');

  return (
    <div className="min-h-dvh bg-slate-50" data-testid="validacao">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-5 flex items-center gap-3">
          {tenant?.logoUrl && <img src={tenant.logoUrl} alt="" className="h-9 w-auto shrink-0" />}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Validar documento</h1>
              <ContextHelp manual="validacao-documentos" section="validar-documento" label="Abrir manual de validação de documentos" />
            </div>
            <p className="text-sm text-slate-500">
              Confira a autenticidade de um documento emitido {tenant?.clienteNome ? `por ${tenant.clienteNome}` : 'por este órgão'}.
            </p>
          </div>
        </div>

        <DocumentValidationForm initialNumber={params.get('number') ?? ''} initialCode={params.get('code') ?? ''} />
      </div>
    </div>
  );
}

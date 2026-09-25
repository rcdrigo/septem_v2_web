import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AutomationEditor } from '@/components/form/AutomationEditor';
import { Toaster } from '@/components/ui/Toaster';
import { useSessionStore } from '@/stores/session';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Editor de um formulário em aba própria, aberto pela visão Formulário. */
export function FormAutomationPage() {
  const { processKey } = useParams<{ processKey: string }>();
  const status = useSessionStore(s => s.status);
  const bootstrap = useSessionStore(s => s.bootstrap);
  const can = useSessionStore(s => s.can('forms:javascript'));
  useEffect(() => { if (status === 'idle') void bootstrap(); }, [status, bootstrap]);
  useDocumentTitle(`JavaScript · ${processKey ?? 'Formulário'}`);

  return <main className="min-h-screen overflow-auto bg-slate-50 p-4 sm:p-6">
    {status === 'idle' || status === 'booting'
      ? <p role="status">Carregando sessão…</p>
      : !can
        ? <p role="alert">Você não tem permissão para customizar JavaScript.</p>
        : processKey && <AutomationEditor key={processKey} processKey={processKey} onClose={() => window.close()} />}
    <Toaster />
  </main>;
}

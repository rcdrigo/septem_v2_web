import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ManualEditor } from '@/pages/admin/ManuaisPage';
import { Toaster } from '@/components/ui/Toaster';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';

/**
 * Criar/editar manual em aba própria (rota /manual/:id, fora do AppShell — sem
 * menus), no mesmo padrão da Fonte de Dados. `:id === 'nova'` cria; `?tecnico=1`
 * pré-marca "manual técnico". Faz bootstrap próprio para ter user/permissões.
 */
export function ManualEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const canTechnical = useSessionStore((s) => s.can('manuals:technical'));
  useEffect(() => { if (status === 'idle') void bootstrap(); }, [status, bootstrap]);

  const editId = id && id !== 'nova' ? id : null;
  const defaultTechnical = params.get('tecnico') === '1';
  useDocumentTitle(editId ? 'Editar manual' : 'Novo manual');

  return (
    <>
      <ManualEditor id={editId} defaultTechnical={defaultTechnical} canTechnical={canTechnical} onClose={() => window.close()} fullPage />
      <Toaster />
    </>
  );
}

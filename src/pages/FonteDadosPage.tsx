import { useParams, useSearchParams } from 'react-router-dom';
import { DataSourceDialog } from '@/pages/admin/FontesDadosPage';
import { Toaster } from '@/components/ui/Toaster';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { DataSourceScope } from '@/lib/api/data-sources';

/**
 * Criar/editar fonte de dados em aba própria (rota /fonte-dados/:id, fora do
 * AppShell — sem menus). `:id === 'nova'` cria; com o agrupamento "Onde é
 * utilizada" abaixo do editor.
 */
export function FonteDadosPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const scope: DataSourceScope = params.get('scope') === 'report' ? 'report' : 'process';
  const editId = id && id !== 'nova' ? id : undefined;
  useDocumentTitle(editId ? 'Editar fonte de dados' : 'Nova fonte de dados');
  return (
    <div className="h-screen bg-slate-100">
      <DataSourceDialog id={editId} scope={scope} onClose={() => window.close()} />
      <Toaster />
    </div>
  );
}

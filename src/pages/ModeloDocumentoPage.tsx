import { useParams } from 'react-router-dom';
import { DocumentTemplateEditor } from '@/pages/admin/ModelosDocumentoPage';
import { Toaster } from '@/components/ui/Toaster';
import { useDocumentTitle } from '@/lib/use-document-title';

export function ModeloDocumentoPage() {
  const { id } = useParams<{ id: string }>();
  const editId = id && id !== 'novo' ? id : undefined;
  useDocumentTitle(editId ? 'Editar modelo de documento' : 'Novo modelo de documento');
  return (
    <>
      <DocumentTemplateEditor key={editId ?? 'novo'} id={editId} onClose={() => window.close()} />
      <Toaster />
    </>
  );
}

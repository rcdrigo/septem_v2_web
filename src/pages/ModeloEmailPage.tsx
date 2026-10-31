import { useParams } from 'react-router-dom';
import { EmailTemplateEditor } from '@/pages/admin/ModelosEmailPage';
import { Toaster } from '@/components/ui/Toaster';
import { useDocumentTitle } from '@/lib/use-document-title';

export function ModeloEmailPage() {
  const { id } = useParams<{ id: string }>();
  const editId = id && id !== 'novo' ? id : undefined;
  useDocumentTitle(editId ? 'Editar modelo de e-mail' : 'Novo modelo de e-mail');
  return (
    <>
      <EmailTemplateEditor key={editId ?? 'novo'} id={editId} onClose={() => window.close()} />
      <Toaster />
    </>
  );
}

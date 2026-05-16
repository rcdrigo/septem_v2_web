import { useRef } from 'react';
import { Download, FilePlus, Upload } from 'lucide-react';
import { Toolbar, ToolbarButton } from '@/components/ui/Toolbar';
import { FormBuilder, type FormBuilderHandle } from '@/components/form/FormBuilder';
import { downloadText, readTextFile } from '@/lib/download';

export function FormularioPage() {
  const builderRef = useRef<FormBuilderHandle>(null);

  async function handleNew() {
    if (!confirm('Descartar o formulário atual e começar do zero?')) return;
    await builderRef.current?.reset();
  }

  function handleExport() {
    try {
      const schema = builderRef.current!.saveSchema();
      downloadText('formulario.form.json', JSON.stringify(schema, null, 2), 'application/json');
    } catch (err) {
      console.error(err);
      alert('Falha ao exportar formulário. Veja console.');
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readTextFile(file);
      const schema = JSON.parse(text);
      await builderRef.current?.importSchema(schema);
    } catch (err) {
      console.error(err);
      alert('Não foi possível importar este formulário (JSON inválido?).');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <>
      <Toolbar title="Formulário" subtitle="form-js — schema JSON visual">
        <ToolbarButton onClick={handleNew}>
          <FilePlus size={16} /> Novo
        </ToolbarButton>
        <ToolbarButton asLabel htmlFor="form-import">
          <Upload size={16} /> Importar
        </ToolbarButton>
        <input
          id="form-import"
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImport}
        />
        <ToolbarButton variant="primary" onClick={handleExport}>
          <Download size={16} /> Exportar
        </ToolbarButton>
      </Toolbar>
      <FormBuilder ref={builderRef} />
    </>
  );
}

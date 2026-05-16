import { useRef } from 'react';
import { Download, FilePlus, Upload } from 'lucide-react';
import { Toolbar, ToolbarButton } from '@/components/ui/Toolbar';
import { BpmnModeler, type BpmnModelerHandle } from '@/components/bpmn/BpmnModeler';
import { downloadText, readTextFile } from '@/lib/download';

export function ModeladorPage() {
  const modelerRef = useRef<BpmnModelerHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleNew() {
    if (!confirm('Descartar o diagrama atual e começar do zero?')) return;
    await modelerRef.current?.reset();
  }

  async function handleExport() {
    try {
      const xml = await modelerRef.current!.saveXML();
      downloadText('processo.bpmn', xml, 'application/xml');
    } catch (err) {
      console.error(err);
      alert('Falha ao exportar BPMN. Veja console.');
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const xml = await readTextFile(file);
      await modelerRef.current?.importXML(xml);
    } catch (err) {
      console.error(err);
      alert('Não foi possível importar este arquivo BPMN.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <>
      <Toolbar title="Modelador" subtitle="BPMN 2.0 — desenhe processos executáveis">
        <ToolbarButton onClick={handleNew}>
          <FilePlus size={16} /> Novo
        </ToolbarButton>
        <ToolbarButton asLabel htmlFor="bpmn-import">
          <Upload size={16} /> Importar
        </ToolbarButton>
        <input
          id="bpmn-import"
          ref={fileInputRef}
          type="file"
          accept=".bpmn,.xml,application/xml,text/xml"
          className="hidden"
          onChange={handleImport}
        />
        <ToolbarButton variant="primary" onClick={handleExport}>
          <Download size={16} /> Exportar
        </ToolbarButton>
      </Toolbar>
      <BpmnModeler ref={modelerRef} />
    </>
  );
}

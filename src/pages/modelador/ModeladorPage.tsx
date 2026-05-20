import { useCallback, useRef, useState } from 'react';
import { ModeladorNavbar, type RecursosHandlers } from '@/components/modelador/ModeladorNavbar';
import { FluxoView } from '@/components/modelador/views/FluxoView';
import { FormularioView } from '@/components/modelador/views/FormularioView';
import { TarefasCamposView } from '@/components/modelador/views/TarefasCamposView';
import { ConfiguracoesView } from '@/components/modelador/views/ConfiguracoesView';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useModeladorStore } from '@/stores/modelador';
import { useProcessNameSync } from '@/lib/useProcessNameSync';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';
import { exportBpmn, exportPng, importBpmn } from '@/lib/recursos';
import { toast } from '@/stores/toast';
import type { BpmnModelerHandle } from '@/components/bpmn/BpmnModeler';

/**
 * Shell da página `/modelador`. Não contém lógica de modelagem — só:
 *  - monta a navbar
 *  - mantém a instância do modeler (vivo em todas as views via display:none)
 *  - troca qual view está visível conforme `currentView`
 *  - liga o sync nome ↔ XML
 *  - injeta os handlers do dropdown "Recursos"
 */
export function ModeladorPage() {
  const currentView = useModeladorStore((s) => s.currentView);
  const processName = useModeladorStore((s) => s.processName);
  const modelerHandleRef = useRef<BpmnModelerHandle>(null);
  const [modeler, setModeler] = useState<any>(null);

  const onReady = useCallback((m: any) => setModeler(m), []);
  useProcessNameSync(modeler);

  const recursos: RecursosHandlers = {
    onImport: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.bpmn,.xml,application/xml,text/xml';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          await importBpmn(modeler, file);
          toast.success(`Fluxo "${file.name}" importado.`);
        } catch (err) {
          console.error(err);
          toast.error('Não foi possível importar este arquivo BPMN.');
        }
      };
      input.click();
    },
    onExport: async () => {
      try {
        await exportBpmn(modeler, processName);
        toast.success('Fluxo exportado.');
      } catch (err) {
        console.error(err);
        toast.error('Falha ao exportar BPMN. Veja o console.');
      }
    },
    onExportPng: async () => {
      try {
        await exportPng(modeler, processName);
        toast.success('Imagem PNG salva.');
      } catch (err) {
        console.error(err);
        toast.error('Falha ao exportar PNG. Veja o console.');
      }
    },
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <ModeladorNavbar recursos={recursos} modeler={modeler} />
      <div className="relative flex flex-1 overflow-hidden">
        {/*
          O FluxoView fica SEMPRE montado (oculto via `hidden`) — desmontar/remontar
          o bpmn-js seria custoso e perderíamos a referência do modeler usada pelas
          outras views. Demais views, mais leves, são render condicional.
        */}
        <div className={currentView === 'fluxo' ? 'flex flex-1 overflow-hidden' : 'hidden flex-1'}>
          <FluxoView ref={modelerHandleRef} onReady={onReady} modelerInstance={modeler} />
        </div>
        {currentView === 'formulario' && (
          <ErrorBoundary context="o editor de formulário">
            <FormularioView modeler={modeler} />
          </ErrorBoundary>
        )}
        {currentView === 'tarefasXcampos' && (
          <ErrorBoundary context="a matriz Tarefas × Campos">
            <TarefasCamposView modeler={modeler} />
          </ErrorBoundary>
        )}
        {currentView === 'configuracoes' && (
          <ErrorBoundary context="as configurações do processo">
            <ConfiguracoesView modeler={modeler} />
          </ErrorBoundary>
        )}
      </div>
      <ShortcutsListener recursos={recursos} />
    </div>
  );
}

function ShortcutsListener({ recursos }: { recursos: RecursosHandlers }) {
  useKeyboardShortcuts(recursos);
  return null;
}

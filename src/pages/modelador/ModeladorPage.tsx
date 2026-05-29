import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { ApiError } from '@/lib/api';
import { useProcessDefinition, useSaveProcess, usePatchProcessStatus } from '@/lib/api/process-definitions';
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

  // ── Persistência no backend (IF2) ──────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const key = searchParams.get('key');
  const detail = useProcessDefinition(key);
  const saveMut = useSaveProcess();
  const patchMut = usePatchProcessStatus();
  const loadedKeyRef = useRef<string | null>(null);

  // Carrega o XML do processo existente no modeler quando ele e o fetch estão prontos.
  useEffect(() => {
    if (!modeler || !key || !detail.data) return;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    void modelerHandleRef.current?.importXML(detail.data.bpmnXml);
  }, [modeler, key, detail.data]);

  async function persist(publish: boolean) {
    if (!modeler) return;
    try {
      const { xml } = await modeler.saveXML({ format: true });
      const saved = await saveMut.mutateAsync({ bpmnXml: xml as string, key: key ?? undefined });
      if (publish) await patchMut.mutateAsync({ key: saved.key, status: 'published' });

      const warns = saved.warnings?.length ?? 0;
      const suffix = warns ? ` (${warns} aviso${warns === 1 ? '' : 's'})` : '';
      toast.success((publish ? `Publicado v${saved.version}` : `Rascunho salvo v${saved.version}`) + suffix);

      if (key !== saved.key) {
        loadedKeyRef.current = saved.key; // não re-importar o que acabamos de salvar
        setSearchParams({ key: saved.key }, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const issues = Array.isArray(err.issues) ? (err.issues as { message: string }[]) : [];
        toast.error(issues[0]?.message ?? 'Diagrama inválido. Corrija os apontamentos do lint.');
      } else if (err instanceof ApiError && err.status === 403) {
        toast.error('Você não tem permissão para publicar processos.');
      } else if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message);
      } else {
        toast.error('Não foi possível salvar o processo.');
      }
    }
  }

  const persistence = {
    onSave: () => void persist(false),
    onPublish: () => void persist(true),
    saving: saveMut.isPending || patchMut.isPending,
  };

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
      <ModeladorNavbar recursos={recursos} modeler={modeler} persistence={persistence} />
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

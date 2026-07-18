import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';
import { ModeladorNavbar, type RecursosHandlers } from '@/components/modelador/ModeladorNavbar';
import { FluxoView } from '@/components/modelador/views/FluxoView';
import { FormularioView } from '@/components/modelador/views/FormularioView';
import { TarefasCamposView } from '@/components/modelador/views/TarefasCamposView';
import { ConfiguracoesView } from '@/components/modelador/views/ConfiguracoesView';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';
import { useModeladorStore } from '@/stores/modelador';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useProcessNameSync } from '@/lib/useProcessNameSync';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';
import { exportBpmn, exportPng, importBpmn } from '@/lib/recursos';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import {
  useProcessDefinition,
  useSaveProcess,
  useUpdateProcess,
  usePatchProcessStatus,
  type SavedProcess,
} from '@/lib/api/process-definitions';
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
  // Roda em aba própria (sem AppShell). Compartilha o token via localStorage com
  // a aba principal; sem sessão → volta para o login.
  const token = useSessionStore((s) => s.accessToken);

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
  // Título da aba: nome salvo do processo (do backend) tem precedência — o
  // processName do store só é preenchido depois que o XML importa no modeler.
  useDocumentTitle(detail.data?.name || processName || 'Modelador');
  const saveMut = useSaveProcess();     // POST = nova versão (Versionar)
  const updateMut = useUpdateProcess(); // PUT  = salva no lugar (Salvar)
  const patchMut = usePatchProcessStatus();
  const loadedKeyRef = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const suppressDirty = useRef(false);

  // Marca "alterações pendentes" a cada edição do fluxo (ignorando o import programático).
  useEffect(() => {
    if (!modeler) return;
    const bus = modeler.get('eventBus');
    const onChanged = () => { if (!suppressDirty.current) setDirty(true); };
    bus.on('commandStack.changed', onChanged);
    return () => bus.off('commandStack.changed', onChanged);
  }, [modeler]);

  // Carrega o XML do processo existente no modeler quando ele e o fetch estão prontos.
  useEffect(() => {
    if (!modeler || !key || !detail.data) return;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    suppressDirty.current = true;
    void modelerHandleRef.current?.importXML(detail.data.bpmnXml).finally(() => {
      setDirty(false);
      setTimeout(() => { suppressDirty.current = false; }, 0);
    });
  }, [modeler, key, detail.data]);

  async function currentXml(): Promise<string | null> {
    // O schema do formulário entra no BPMN por polling (600ms). Sem empurrar agora, um
    // Salvar logo após uma alteração gravaria o processo SEM ela — perda silenciosa.
    useModeladorStore.getState().flushForm?.();
    if (!modeler) return null;
    const { xml } = await modeler.saveXML({ format: true });
    return xml as string;
  }

  function afterPersist(r: SavedProcess) {
    setDirty(false);
    if (key !== r.key) {
      loadedKeyRef.current = r.key; // não re-importar o que acabamos de salvar
      setSearchParams({ key: r.key }, { replace: true });
    }
  }

  function warnSuffix(r: SavedProcess): string {
    const n = r.warnings?.length ?? 0;
    return n ? ` (${n} aviso${n === 1 ? '' : 's'})` : '';
  }

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.status === 422) {
      const issues = Array.isArray(err.issues) ? (err.issues as { message: string }[]) : [];
      toast.error(issues[0]?.message ?? 'Diagrama inválido. Corrija os apontamentos do lint.');
    } else if (err instanceof ApiError && err.status === 403) {
      toast.error('Você não tem permissão para publicar processos.');
    } else if (err instanceof ApiError && err.status === 409) {
      toast.error(err.detail ?? err.message);
    } else {
      toast.error('Não foi possível salvar o processo.');
    }
  }

  // Salvar: atualiza a versão corrente no lugar (ou cria a v1 se for novo).
  async function onSave() {
    const xml = await currentXml();
    if (xml == null) return;
    try {
      const r = key
        ? await updateMut.mutateAsync({ key, bpmnXml: xml })
        : await saveMut.mutateAsync({ bpmnXml: xml });
      // Editar publicado salva no lugar (sem versionar); rascunho idem.
      const label = r.status === 'published' ? `Salvo (publicado) v${r.version}` : `Rascunho salvo v${r.version}`;
      toast.success(label + warnSuffix(r));
      afterPersist(r);
    } catch (err) { handleError(err); }
  }

  // Versionar: cria uma NOVA versão explicitamente.
  async function onVersion() {
    const xml = await currentXml();
    if (xml == null) return;
    try {
      const r = await saveMut.mutateAsync({ bpmnXml: xml, key: key ?? undefined });
      toast.success(`Versão v${r.version} criada.` + warnSuffix(r));
      afterPersist(r);
    } catch (err) { handleError(err); }
  }

  // Publicar: salva o estado atual e marca como publicado.
  async function onPublish() {
    const xml = await currentXml();
    if (xml == null) return;
    try {
      const r = key
        ? await updateMut.mutateAsync({ key, bpmnXml: xml })
        : await saveMut.mutateAsync({ bpmnXml: xml });
      await patchMut.mutateAsync({ key: r.key, status: 'published' });
      toast.success(`Publicado v${r.version}.`);
      afterPersist(r);
    } catch (err) { handleError(err); }
  }

  const persistence = {
    onSave,
    onPublish,
    onVersion,
    dirty,
    saving: saveMut.isPending || updateMut.isPending || patchMut.isPending,
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

  // Guard de sessão depois de todos os hooks (regras de hooks).
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
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
        {/*
          O editor de Formulário (form-js) também fica SEMPRE montado (oculto via
          `hidden`): remontá-lo ao trocar de view fazia a paleta de componentes
          sumir e recriava o editor desnecessariamente.
        */}
        <div className={currentView === 'formulario' ? 'flex flex-1 overflow-hidden' : 'hidden flex-1'}>
          <ErrorBoundary context="o editor de formulário">
            <FormularioView modeler={modeler} />
          </ErrorBoundary>
        </div>
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
      {/* Standalone (fora do AppShell): precisa dos hosts de toast/confirm aqui. */}
      <Toaster />
      <ConfirmDialogHost />
    </div>
  );
}

function ShortcutsListener({ recursos }: { recursos: RecursosHandlers }) {
  useKeyboardShortcuts(recursos);
  return null;
}

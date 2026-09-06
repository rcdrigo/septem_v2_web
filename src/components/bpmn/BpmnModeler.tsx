import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Modeler from 'bpmn-js/lib/Modeler';
import emptyDiagram from '@/assets/empty-diagram.bpmn?raw';
import { SeptemPaletteModule } from './SeptemPaletteProvider';
import { SeptemContextPadModule } from './SeptemContextPadProvider';
import septemModdle from './septem-moddle.json';
import { useModeladorStore } from '@/stores/modelador';

export type BpmnModelerHandle = {
  importXML: (xml: string) => Promise<void>;
  saveXML: () => Promise<string>;
  reset: () => Promise<void>;
};

type Props = {
  onReady?: (modeler: any) => void;
};

const STORAGE_KEY = 'septem.modelador.xml';
const AUTOSAVE_DEBOUNCE_MS = 500;

export const BpmnModeler = forwardRef<BpmnModelerHandle, Props>(({ onReady }, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  const importQueue = useRef<Promise<void>>(Promise.resolve());
  const setXml = useModeladorStore((s) => s.setXml);
  const setSelectedElementId = useModeladorStore((s) => s.setSelectedElementId);

  function loadDiagram(modeler: any, xml: string): Promise<void> {
    const pending = importQueue.current.catch(() => {}).then(async () => {
      if (modelerRef.current !== modeler) throw new Error('Modelador indisponível.');
      await modeler.importXML(xml);
      if (modelerRef.current === modeler) modeler.get('canvas').zoom('fit-viewport', 'auto');
    });
    importQueue.current = pending;
    return pending;
  }

  useEffect(() => {
    if (!canvasRef.current) return;

    const modeler = new Modeler({
      container: canvasRef.current,
      additionalModules: [SeptemPaletteModule, SeptemContextPadModule],
      moddleExtensions: { septem: septemModdle as any },
      // keyboard.bindTo foi removido no diagram-js atual (bind agora é implícito).
    });
    modelerRef.current = modeler;
    onReady?.(modeler);

    // Começa SEMPRE em branco: um processo existente é importado por ModeladorPage
    // (via ?key=), e "Novo processo" (sem key) fica em branco. NÃO restauramos do
    // localStorage aqui — o rascunho era global e, como o auto-save gravava qualquer
    // diagrama aberto, "Novo" acabava restaurando o último processo editado.
    void loadDiagram(modeler, emptyDiagram).catch(() => {});
    window.localStorage.removeItem(STORAGE_KEY); // limpa rascunho global legado (contaminado)

    // Espelha o XML no store (consumido por outras views), com debounce.
    let saveTimer: number | undefined;
    const scheduleSave = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(async () => {
        try {
          const { xml } = await modeler.saveXML({ format: true });
          if (modelerRef.current !== modeler) return;
          setXml(xml as string);
        } catch (err) {
          console.warn('Auto-save falhou:', err);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    };

    const eventBus: any = modeler.get('eventBus');
    const watchedEvents = ['commandStack.changed', 'elements.changed', 'shape.added', 'connection.added'];
    watchedEvents.forEach((ev) => eventBus.on(ev, scheduleSave));

    const onSelectionChanged = (e: any) => {
      const sel = e.newSelection?.[0];
      setSelectedElementId(sel ? sel.id : null);
    };
    eventBus.on('selection.changed', onSelectionChanged);

    return () => {
      window.clearTimeout(saveTimer);
      watchedEvents.forEach((ev) => eventBus.off(ev, scheduleSave));
      eventBus.off('selection.changed', onSelectionChanged);
      modelerRef.current = null;
      setSelectedElementId(null);
      modeler.destroy();
    };
  }, [onReady, setXml, setSelectedElementId]);

  useImperativeHandle(
    ref,
    () => ({
      async importXML(xml: string) {
        if (!modelerRef.current) return;
        await loadDiagram(modelerRef.current, xml);
      },
      async saveXML() {
        if (!modelerRef.current) throw new Error('Modeler não inicializado');
        const { xml } = await modelerRef.current.saveXML({ format: true });
        return xml as string;
      },
      async reset() {
        if (!modelerRef.current) return;
        window.localStorage.removeItem(STORAGE_KEY);
        await loadDiagram(modelerRef.current, emptyDiagram);
      },
    }),
    [],
  );

  return <div ref={canvasRef} className="flex-1 bg-white" />;
});

BpmnModeler.displayName = 'BpmnModeler';

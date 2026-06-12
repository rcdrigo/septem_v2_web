import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Modeler from 'bpmn-js/lib/Modeler';
import emptyDiagram from '@/assets/empty-diagram.bpmn?raw';
import { SeptemPaletteModule } from './SeptemPaletteProvider';
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
  const setXml = useModeladorStore((s) => s.setXml);
  const setSelectedElementId = useModeladorStore((s) => s.setSelectedElementId);

  async function loadDiagram(modeler: any, xml: string) {
    try {
      await modeler.importXML(xml);
      if (modelerRef.current !== modeler) return;
      modeler.get('canvas').zoom('fit-viewport', 'auto');
    } catch (err) {
      if (modelerRef.current === modeler) {
        console.error('Falha ao carregar diagrama BPMN:', err);
      }
    }
  }

  useEffect(() => {
    if (!canvasRef.current) return;

    const modeler = new Modeler({
      container: canvasRef.current,
      additionalModules: [SeptemPaletteModule],
      moddleExtensions: { septem: septemModdle as any },
      // keyboard.bindTo foi removido no diagram-js atual (bind agora é implícito).
    });
    modelerRef.current = modeler;
    onReady?.(modeler);

    const stored = readStoredXml();
    void loadDiagram(modeler, stored ?? emptyDiagram);

    // Auto-save em localStorage + store, com debounce
    let saveTimer: number | undefined;
    const scheduleSave = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(async () => {
        try {
          const { xml } = await modeler.saveXML({ format: true });
          if (modelerRef.current !== modeler) return;
          window.localStorage.setItem(STORAGE_KEY, xml as string);
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

function readStoredXml(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

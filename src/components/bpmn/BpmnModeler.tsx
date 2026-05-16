import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Modeler from 'bpmn-js/lib/Modeler';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from 'bpmn-js-properties-panel';
import emptyDiagram from '@/assets/empty-diagram.bpmn?raw';

export type BpmnModelerHandle = {
  importXML: (xml: string) => Promise<void>;
  saveXML: () => Promise<string>;
  reset: () => Promise<void>;
};

export const BpmnModeler = forwardRef<BpmnModelerHandle>((_, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);

  /** Importa e enquadra o diagrama; ignora resultado se o modeler já foi destruído. */
  async function loadDiagram(modeler: any, xml: string) {
    try {
      await modeler.importXML(xml);
      if (modelerRef.current !== modeler) return; // desmontado durante o await (StrictMode)
      modeler.get('canvas').zoom('fit-viewport', 'auto');
    } catch (err) {
      if (modelerRef.current === modeler) {
        console.error('Falha ao carregar diagrama BPMN:', err);
      }
    }
  }

  useEffect(() => {
    if (!canvasRef.current || !propertiesRef.current) return;

    const modeler = new Modeler({
      container: canvasRef.current,
      propertiesPanel: { parent: propertiesRef.current },
      additionalModules: [BpmnPropertiesPanelModule, BpmnPropertiesProviderModule],
      keyboard: { bindTo: document },
    });
    modelerRef.current = modeler;

    void loadDiagram(modeler, emptyDiagram);

    return () => {
      modelerRef.current = null;
      modeler.destroy();
    };
  }, []);

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
        await loadDiagram(modelerRef.current, emptyDiagram);
      },
    }),
    [],
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <div ref={canvasRef} className="flex-1 bg-white" />
      <div
        ref={propertiesRef}
        className="w-[360px] shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50"
      />
    </div>
  );
});

BpmnModeler.displayName = 'BpmnModeler';

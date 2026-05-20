import { useEffect, useState } from 'react';
import { useModeladorStore } from '@/stores/modelador';
import { resolvePanel } from './panels/registry';

type Props = {
  modeler: any | null;
};

/**
 * Painel direito de propriedades.
 *
 * Substitui o `bpmn-js-properties-panel` padrão. É apenas um dispatcher:
 * resolve qual `Panel*` renderizar via `panels/registry.ts` e o monta dentro
 * de um chrome consistente (header + scroll). Cada Panel compõe seções
 * vindas de `sections/`. Toda a lógica de UI específica mora lá.
 */
export function PropertiesPanel({ modeler }: Props) {
  const selectedId = useModeladorStore((s) => s.selectedElementId);
  const xmlVersion = useModeladorStore((s) => s.xml); // força refresh quando o modelo muda
  const [element, setElement] = useState<any | null>(null);

  useEffect(() => {
    if (!modeler || !selectedId) {
      setElement(null);
      return;
    }
    const el = modeler.get('elementRegistry').get(selectedId);
    setElement(el ?? null);
  }, [modeler, selectedId, xmlVersion]);

  if (!modeler) {
    return <PanelChrome message="Modelador carregando…" />;
  }
  if (!element) {
    return <PanelChrome message="Selecione um elemento no canvas para configurar." />;
  }

  const { Panel, label, type } = resolvePanel(element);

  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-slate-50">
      <PanelHeader type={type} label={label} />
      <Panel modeler={modeler} element={element} />
    </aside>
  );
}

function PanelChrome({ message }: { message: string }) {
  return (
    <aside className="flex w-[380px] shrink-0 items-center justify-center border-l border-slate-200 bg-slate-50 px-6 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </aside>
  );
}

function PanelHeader({ type, label }: { type: string; label: string }) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{type}</p>
      <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
    </header>
  );
}

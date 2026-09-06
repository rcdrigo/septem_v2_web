import { useEffect, useRef } from 'react';
import { useModeladorStore } from '@/stores/modelador';
import { getProcessName, setProcessName as writeProcessName } from './bpmn-process';

/**
 * Mantém `processName` no Zustand sincronizado com `bpmn:Process.name` do diagrama.
 *
 * Direção XML → Zustand: ao montar o modeler e a cada `import.done` (importação de
 * outro arquivo ou reset), lê o nome do processo e atualiza o store.
 *
 * Direção Zustand → XML: ao usuário renomear pela navbar, escreve em
 * `bpmn:Process` via `modeling.updateProperties`. O auto-save propaga para
 * o store do XML automaticamente.
 *
 * O hook evita loop: usa uma `ref` para o último valor sincronizado e só
 * propaga quando há divergência real.
 */
export function useProcessNameSync(modeler: any | null) {
  const processName = useModeladorStore((s) => s.processName);
  const setProcessNameStore = useModeladorStore((s) => s.setProcessName);
  const lastSynced = useRef<string>('');

  // XML → store
  useEffect(() => {
    if (!modeler) return;
    function pullFromXml() {
      const xmlName = getProcessName(modeler);
      if (!xmlName) return;
      lastSynced.current = xmlName;
      if (xmlName !== useModeladorStore.getState().processName) setProcessNameStore(xmlName);
    }
    // ao montar (após import inicial)
    pullFromXml();
    const bus = modeler.get('eventBus');
    const events = ['import.done', 'elements.changed'];
    events.forEach((ev) => bus.on(ev, pullFromXml));
    return () => events.forEach((ev) => bus.off(ev, pullFromXml));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeler]);

  // store → XML
  useEffect(() => {
    if (!modeler) return;
    // O efeito XML → store pode ter atualizado o nome neste mesmo commit.
    // Não escreva o snapshot antigo do render por cima do processo importado.
    if (processName !== useModeladorStore.getState().processName) return;
    if (processName === lastSynced.current) return;
    const xmlName = getProcessName(modeler);
    if (xmlName === processName) {
      lastSynced.current = processName;
      return;
    }
    writeProcessName(modeler, processName);
    lastSynced.current = processName;
  }, [modeler, processName]);
}

import { useEffect } from 'react';
import { useFormStore } from '@/stores/form';
import { extractFields } from '@/lib/form-schema';
import { getEmbeddedFormSchema } from '@/lib/bpmn-process';
import { useModeladorStore } from '@/stores/modelador';

/**
 * Garante que o `formStore` esteja populado com os campos do formulário a partir
 * do schema embutido no XML — usado em painéis do modelador (matriz, seletores
 * de campo) que abrem sem ter passado pela aba Formulário (onde o polling popula).
 */
export function useEnsureFormFields(modeler: any | null) {
  const setFields = useFormStore((s) => s.setFields);
  useEffect(() => {
    if (!modeler) { setFields([]); return; }
    let disposed = false;
    let lastSchema: string | undefined;
    const refresh = () => {
      if (disposed) return;
      const schema = getEmbeddedFormSchema(modeler);
      const serialized = JSON.stringify(schema);
      if (serialized === lastSchema) return;
      lastSchema = serialized;
      try { setFields(extractFields(schema)); }
      catch { setFields([]); }
    };
    const clear = () => { lastSchema = undefined; setFields([]); };
    const bus = modeler.get('eventBus');
    // Flush the current editor draft before reading BPMN when a panel opens.
    // Its periodic persistence may otherwise lag behind the latest field edit.
    const flush = useModeladorStore.getState().flushForm;
    if (flush) void flush().then(refresh).catch(() => { if (!disposed) clear(); });
    else refresh();
    bus.on('import.parse.start', clear);
    bus.on('import.done', refresh);
    bus.on('commandStack.changed', refresh);
    return () => {
      disposed = true;
      bus.off('import.parse.start', clear);
      bus.off('import.done', refresh);
      bus.off('commandStack.changed', refresh);
    };
  }, [modeler, setFields]);
}

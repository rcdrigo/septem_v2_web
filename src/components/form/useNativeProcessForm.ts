import { syncTaskFieldEntries } from '@/lib/bpmn-form-fields';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createNativeForm, parseNativeForm, type NativeFormDefinition } from '@/lib/native-form';
import { getEmbeddedFormSchema, getProcessShape, setEmbeddedNativeForm } from '@/lib/bpmn-process';
import { useModeladorStore } from '@/stores/modelador';
import { useFormStore } from '@/stores/form';
import { extractFields } from '@/lib/form-schema';

/** The ref owns the draft so save immediately after an input never reads a stale render. */
export function useNativeProcessForm(modeler: any, processReady: boolean) {
  const [definition, setDefinition] = useState<NativeFormDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const draft = useRef<NativeFormDefinition | null>(null);
  const lastStored = useRef('');
  const active = useRef(false);

  useEffect(() => {
    const pause = () => { active.current = false; draft.current = null; setDefinition(null); useFormStore.getState().setFields([]); };
    const load = (event?: { error?: unknown }) => {
      pause(); setError(null);
      if (!processReady || !getProcessShape(modeler)) return;
      try {
        if (event?.error) throw event.error;
        const stored = getEmbeddedFormSchema(modeler, true);
        if (stored && (stored as { format?: string }).format !== 'septem-native') {
          throw new Error('Este formulário usa o formato anterior e não pode ser editado aqui. Abra um processo novo ou uma definição nativa.');
        }
        const next = stored ? parseNativeForm(stored) : createNativeForm();
        lastStored.current = stored ? JSON.stringify(next) : '';
        draft.current = next; active.current = true; setDefinition(next); setRevision(r => r + 1);
        useFormStore.getState().setFields(extractFields(next));
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o formulário. Reabra o processo.'); }
    };
    const bus = modeler?.get?.('eventBus');
    load();
    bus?.on('import.parse.start', pause); bus?.on('import.done', load);
    const flush = async () => {
      if (!active.current || !draft.current || useModeladorStore.getState().flushForm !== flush) throw new Error('O formulário não está pronto para salvar.');
      const serialized = JSON.stringify(draft.current);
      if (serialized !== lastStored.current) {
        setEmbeddedNativeForm(modeler, draft.current);
        lastStored.current = serialized;
      }
    };
    useModeladorStore.getState().setFlushForm(flush);
    const interval = window.setInterval(() => { if (active.current) void flush().catch(cause => setError(String(cause))); }, 600);
    return () => {
      active.current = false; window.clearInterval(interval);
      bus?.off('import.parse.start', pause); bus?.off('import.done', load);
      if (useModeladorStore.getState().flushForm === flush) useModeladorStore.getState().setFlushForm(null);
    };
  }, [modeler, processReady]);

  const update = useCallback((change: (next: NativeFormDefinition) => void) => {
    if (!active.current || !draft.current) return;
    const next = structuredClone(draft.current); change(next);
    const valid = parseNativeForm(next);
    syncTaskFieldEntries(modeler, extractFields(draft.current), extractFields(valid));
    draft.current = valid; setDefinition(valid);
    useFormStore.getState().setFields(extractFields(valid));
  }, [modeler]);
  const importDefinition = useCallback((value: unknown) => {
    const next = parseNativeForm(value);
    if (!active.current) throw new Error('Aguarde o carregamento do formulário.');
    syncTaskFieldEntries(modeler, extractFields(draft.current), extractFields(next));
    draft.current = next; setDefinition(next); setError(null); setRevision(r => r + 1);
    useFormStore.getState().setFields(extractFields(next));
  }, [modeler]);
  return { definition, revision, error, update, importDefinition };
}

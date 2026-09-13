import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormBuilderHandle } from '@/components/form/FormBuilder';
import { extractFields } from '@/lib/form-schema';
import { getEmbeddedFormSchema, setEmbeddedFormSchema } from '@/lib/bpmn-process';
import { fetchDataSourceOptions } from '@/lib/api/catalog';
import { useFormStore } from '@/stores/form';
import { useModeladorStore } from '@/stores/modelador';

/**
 * O editor do form-js só renderiza no canvas os `values` estáticos do componente —
 * ele não conhece nossas fontes de dados. Então, antes de importar o schema, buscamos
 * as opções de cada campo com `septemDataSourceId` e as gravamos em `values`, para o
 * canvas exibir as opções reais (em vez do "Value" default). Em runtime o ReactForm
 * re-busca as opções (estas ficam apenas como snapshot de exibição no modelador).
 */
async function enrichDataSourceOptions(schema: any): Promise<any> {
  if (!schema || typeof schema !== 'object') return schema;
  const cache = new Map<string, { value: string; label: string }[]>();
  async function walk(node: any): Promise<void> {
    if (Array.isArray(node)) { for (const c of node) await walk(c); return; }
    if (!node || typeof node !== 'object') return;
    const dsId: string | undefined = node.properties?.septemDataSourceId;
    if (dsId) {
      try {
        if (!cache.has(dsId)) cache.set(dsId, await fetchDataSourceOptions(dsId));
        const opts = cache.get(dsId)!;
        if (opts.length > 0) node.values = opts;
      } catch { /* fonte indisponível: mantém o campo como está */ }
    }
    if (Array.isArray(node.components)) await walk(node.components);
  }
  await walk(schema.components);
  return schema;
}
type GroupLayout = 'stacked' | 'tabs';

const POLL_MS = 600;

/** Owns process-form ordering and persistence; XML remains the persisted source of truth. */
export function useProcessFormEditor(modeler: any | null, processReady: boolean) {
  const builderRef = useRef<FormBuilderHandle>(null);
  const setFields = useFormStore((s) => s.setFields);
  const [ready, setReady] = useState(false);
  const [selectedField, setSelectedField] = useState<any | null>(null);
  const [groupLayout, setGroupLayout] = useState<GroupLayout>('stacked');
  const [loadError, setLoadError] = useState<string | null>(null);
  const layoutRef = useRef<GroupLayout>('stacked');
  const lastSerialized = useRef('');
  const loadingRef = useRef(true);
  const loadGeneration = useRef(0);
  const loadPromise = useRef<Promise<void>>(Promise.resolve());
  const importQueue = useRef<Promise<void>>(Promise.resolve());
  const errorRef = useRef<string | null>(null);

  const pause = useCallback(() => {
    ++loadGeneration.current;
    loadingRef.current = true;
    setReady(false);
    setSelectedField(null);
  }, []);

  // Both XML loads and manual imports use this transaction. Preparation may overlap,
  // but engine imports never do; only the latest generation can publish its snapshot.
  const replaceSchema = useCallback((
    prepare: () => Promise<{ schema: unknown; layout: GroupLayout }>,
    persist: boolean,
    errorMessage: string,
  ) => {
    pause();
    const generation = loadGeneration.current;
    const current = () => generation === loadGeneration.current;
    errorRef.current = null;
    setLoadError(null);
    const pending = (async () => {
      const { schema, layout } = await prepare();
      if (!current()) return;
      const importing = importQueue.current.catch(() => {}).then(async () => {
        if (!current()) return;
        if (!builderRef.current) throw new Error('Editor indisponível.');
        if (schema || persist) await builderRef.current.importSchema(schema);
        else await builderRef.current.reset();
      });
      importQueue.current = importing;
      await importing;
      if (!current()) return;
      const imported = builderRef.current!.saveSchema();
      if (persist) propagate(imported, modeler, setFields, layout);
      else setFields(extractFields(imported as any));
      lastSerialized.current = JSON.stringify(imported);
      layoutRef.current = layout;
      setGroupLayout(layout);
      loadingRef.current = false;
      setReady(true);
    })();
    // Flush waits for settlement and then checks readiness; manual imports also
    // return the rejecting promise so their dialog can report failure.
    loadPromise.current = pending.catch(() => {
      if (!current()) return;
      errorRef.current = errorMessage;
      setLoadError(errorMessage);
    });
    return pending;
  }, [modeler, pause, setFields]);

  useEffect(() => {
    const bus = modeler?.get?.('eventBus');
    const pauseXml = () => { pause(); setFields([]); };
    function load(event?: { error?: unknown }) {
      setFields([]);
      if (!processReady || !modeler) {
        pause();
        errorRef.current = null;
        setLoadError(null);
        return;
      }
      void replaceSchema(async () => {
        if (event?.error) throw event.error;
        const initial = getEmbeddedFormSchema(modeler, true) as any;
        const layout: GroupLayout = initial?.septemGroupLayout === 'tabs' ? 'tabs' : 'stacked';
        const clean = stripLayout(initial);
        return { schema: clean ? await enrichDataSourceOptions(clean) : null, layout };
      }, false, 'Não foi possível carregar o formulário. Reabra o processo antes de salvar.').catch(() => {});
    }
    load();
    bus?.on('import.parse.start', pauseXml);
    bus?.on('import.done', load);
    return () => {
      ++loadGeneration.current;
      loadingRef.current = true;
      bus?.off('import.parse.start', pauseXml);
      bus?.off('import.done', load);
    };
  }, [modeler, processReady, pause, replaceSchema, setFields]);

  useEffect(() => {
    const flush = async () => {
      let pending: Promise<void>;
      do { pending = loadPromise.current; await pending; } while (pending !== loadPromise.current);
      if (useModeladorStore.getState().flushForm !== flush || loadingRef.current || !processReady || !builderRef.current)
        throw new Error(errorRef.current ?? 'Aguarde o carregamento do formulário.');
      const schema = builderRef.current.saveSchema();
      const serialized = JSON.stringify(schema);
      if (serialized === lastSerialized.current) return;
      propagate(schema, modeler, setFields, layoutRef.current);
      lastSerialized.current = serialized;
    };
    useModeladorStore.getState().setFlushForm(flush);
    const interval = window.setInterval(() => {
      if (!loadingRef.current) void flush().catch(() => {});
    }, POLL_MS);
    return () => {
      window.clearInterval(interval);
      if (useModeladorStore.getState().flushForm === flush)
        useModeladorStore.getState().setFlushForm(null);
    };
  }, [modeler, processReady, setFields]);

  async function importForm(schema: unknown) {
    if (loadingRef.current) throw new Error('Aguarde o carregamento.');
    const importedLayout = (schema as { septemGroupLayout?: string })?.septemGroupLayout;
    const layout = importedLayout === 'tabs' || importedLayout === 'stacked' ? importedLayout : layoutRef.current;
    await replaceSchema(async () => ({ schema: stripLayout(schema), layout }), true,
      'Não foi possível importar o formulário. Reabra o processo antes de salvar.');
  }

  function changeLayout(l: GroupLayout) {
    if (loadingRef.current) return;
    setGroupLayout(l);
    layoutRef.current = l;
    const schema = builderRef.current?.saveSchema();
    if (schema) propagate(schema, modeler, setFields, l);
  }

  function getPreview() {
    if (loadingRef.current || !builderRef.current) return null;
    return { ...(builderRef.current.saveSchema() as object), septemGroupLayout: layoutRef.current };
  }

  return { builderRef, ready, loadError, selectedField, setSelectedField, groupLayout, changeLayout, importForm, getPreview };
}

function stripLayout(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const { septemGroupLayout: _omit, ...clean } = schema;
  return clean;
}

function propagate(schema: unknown, modeler: any | null, setFields: (fs: ReturnType<typeof extractFields>) => void, layout: GroupLayout) {
  const stored = { ...(schema as object), septemGroupLayout: layout };
  setFields(extractFields(schema as any));
  if (modeler) setEmbeddedFormSchema(modeler, stored);
}

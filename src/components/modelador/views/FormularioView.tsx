import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Rows3, Columns3, Regex, Eye, FileUp } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Dialog } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { FormBuilder, type FormBuilderHandle } from '@/components/form/FormBuilder';
import { FormFieldsPalette } from '@/components/form/FormFieldsPalette';
import { FieldConfigPanel } from '@/components/form/FieldConfigPanel';
import { ReactForm } from '@/components/form/ReactForm';
import { MasksDialog } from '@/components/form/MasksDialog';
import { ImportFormDialog } from '@/components/form/ImportFormDialog';
import { useProcessDefinition } from '@/lib/api/process-definitions';
import { extractFields } from '@/lib/form-schema';
import { useFormStore } from '@/stores/form';
import { useModeladorStore } from '@/stores/modelador';
import { useFormMasks } from '@/lib/api/forms';
import { getEmbeddedFormSchema, setEmbeddedFormSchema } from '@/lib/bpmn-process';
import { fetchDataSourceOptions } from '@/lib/api/catalog';

type Props = { modeler: any | null; processReady?: boolean };

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

/**
 * View "Formulário" — editor do @bpmn-io/form-js (FormBuilder) com o painel direito
 * estendido (grupo "Configurações Septem"). Além disso, um seletor define como os
 * grupos PRINCIPAIS são exibidos na execução: empilhados ou em abas. A flag viaja
 * no schema (`septemGroupLayout`), injetada na persistência e removida antes de
 * importar no editor (o form-js não precisa conhecê-la).
 */
export function FormularioView({ modeler, processReady = true }: Props) {
  const builderRef = useRef<FormBuilderHandle>(null);
  const setFields = useFormStore((s) => s.setFields);
  const masks = useFormMasks();
  const [ready, setReady] = useState(false);
  const [masksOpen, setMasksOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [params] = useSearchParams();
  const processDef = useProcessDefinition(params.get('key'));
  const hasInstances = !!processDef.data?.hasInstances;
  const [preview, setPreview] = useState<unknown | null>(null);
  const [selectedField, setSelectedField] = useState<any | null>(null);
  const [groupLayout, setGroupLayout] = useState<GroupLayout>('stacked');
  const layoutRef = useRef<GroupLayout>('stacked');
  layoutRef.current = groupLayout;
  const lastSerialized = useRef<string>('');
  const loadingRef = useRef(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadGeneration = useRef(0);
  const loadPromise = useRef<Promise<void>>(Promise.resolve());
  const importQueue = useRef<Promise<void>>(Promise.resolve());
  const errorRef = useRef<string | null>(null);

  const maskOptions = useMemo(
    () => (masks.data ?? []).map((m) => ({ value: m.id, label: m.name, regex: m.regex, template: m.template, shouldValidate: m.shouldValidate })),
    [masks.data],
  );

  // O XML do processo é a única fonte persistida. Nunca restaurar cache global.
  useEffect(() => {
    const bus = modeler?.get?.('eventBus');
    function pause() {
      ++loadGeneration.current;
      loadingRef.current = true;
      setReady(false);
      setSelectedField(null);
      setFields([]);
    }
    function load(event?: { error?: unknown }) {
      pause();
      const generation = loadGeneration.current;
      errorRef.current = null;
      setLoadError(null);
      if (!processReady || !modeler) return;
      const current = () => generation === loadGeneration.current;
      const pending = (async () => {
        if (event?.error) throw event.error;
        const initial = getEmbeddedFormSchema(modeler, true) as any;
        const layout: GroupLayout = initial?.septemGroupLayout === 'tabs' ? 'tabs' : 'stacked';
        const clean = stripLayout(initial);
        const enriched = clean ? await enrichDataSourceOptions(clean) : null;
        if (!current()) return;
        // Serializa importações, inclusive se a anterior já entrou na engine.
        const importing = importQueue.current.catch(() => {}).then(async () => {
          if (!current()) return;
          if (!builderRef.current) throw new Error('Editor indisponível.');
          if (enriched) await builderRef.current.importSchema(enriched);
          else await builderRef.current.reset();
        });
        importQueue.current = importing;
        await importing;
        if (!current()) return;
        const schema = builderRef.current!.saveSchema();
        lastSerialized.current = JSON.stringify(schema);
        setFields(extractFields(schema as any));
        layoutRef.current = layout;
        setGroupLayout(layout);
        loadingRef.current = false;
        setReady(true);
      })().catch(() => {
        if (!current()) return;
        errorRef.current = 'Não foi possível carregar o formulário. Reabra o processo antes de salvar.';
        setLoadError(errorRef.current);
      });
      loadPromise.current = pending;
    }
    load();
    bus?.on('import.parse.start', pause);
    bus?.on('import.done', load);
    return () => {
      ++loadGeneration.current;
      loadingRef.current = true;
      bus?.off('import.parse.start', pause);
      bus?.off('import.done', load);
    };
  }, [modeler, processReady, setFields]);

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
    const generation = ++loadGeneration.current;
    loadingRef.current = true;
    setReady(false);
    setSelectedField(null);
    const pending = importQueue.current.catch(() => {}).then(async () => {
      if (generation !== loadGeneration.current) return;
      await builderRef.current!.importSchema(stripLayout(schema));
      if (generation !== loadGeneration.current) return;
      const imported = builderRef.current!.saveSchema();
      const layout = (schema as { septemGroupLayout?: string })?.septemGroupLayout;
      if (layout === 'tabs' || layout === 'stacked') {
        layoutRef.current = layout;
        setGroupLayout(layout);
      }
      propagate(imported, modeler, setFields, layoutRef.current);
      lastSerialized.current = JSON.stringify(imported);
      loadingRef.current = false;
      setReady(true);
    });
    importQueue.current = pending;
    loadPromise.current = pending.catch(() => {
      if (generation !== loadGeneration.current) return;
      errorRef.current = 'Não foi possível importar o formulário. Reabra o processo antes de salvar.';
      setLoadError(errorRef.current);
    });
    await pending;
  }

  function changeLayout(l: GroupLayout) {
    if (loadingRef.current) return;
    setGroupLayout(l);
    layoutRef.current = l;
    const schema = builderRef.current?.saveSchema();
    if (schema) propagate(schema, modeler, setFields, l);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Formulário do processo</h2>
          <p className="text-xs text-slate-500">
            Configure cada campo no painel à direita (máscara, fonte de dados, ajuda, visibilidade).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Layout dos grupos principais — só afeta a EXECUÇÃO (não o editor) */}
          <span className="text-xs text-slate-400">Grupos na execução:</span>
          <div className="flex overflow-hidden rounded-md border border-slate-300" title="Como exibir os grupos principais quando o serviço/tarefa é aberto (não muda o editor)">
            <button type="button" onClick={() => changeLayout('stacked')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${groupLayout === 'stacked' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              <Rows3 size={13} /> Empilhados
            </button>
            <button type="button" onClick={() => changeLayout('tabs')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${groupLayout === 'tabs' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              <Columns3 size={13} /> Abas
            </button>
          </div>
          <IconButton disabled={!ready} onClick={() => setPreview({ ...((builderRef.current?.saveSchema() ?? { type: 'default', components: [], schemaVersion: 17 }) as object), septemGroupLayout: groupLayout })}><Eye size={14} /> Pré-visualizar</IconButton>
          <IconButton onClick={() => setMasksOpen(true)}><Regex size={14} /> Máscaras</IconButton>
          {hasInstances ? (
            <Tooltip text="Este processo já tem instâncias iniciadas. Importar sobrescreveria o formulário e quebraria os dados já preenchidos.">
              <span data-testid="import-btn-disabled" className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-300"><FileUp size={14} /> Importar</span>
            </Tooltip>
          ) : (
            <IconButton disabled={!ready} onClick={() => setImportOpen(true)}><FileUp size={14} /> Importar</IconButton>
          )}
          {/* "Limpar formulário" e "Modelo com agrupamento" removidos a pedido do
              dono (2026-07-10): destrutivo/raramente úteis. */}
        </div>
      </header>
      {!ready && <p role={loadError ? 'alert' : 'status'} className="px-5 py-3 text-sm">{loadError ?? 'Carregando formulário…'}</p>}
      <div inert={!ready} className={`septem-cockpit flex flex-1 overflow-hidden ${!ready ? 'invisible' : ''}`}>
        <FormFieldsPalette onAdd={(t) => builderRef.current?.addField(t)} />
        {/* Canvas ocupa todo o meio entre a paleta e o painel de config. */}
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-100 p-3">
          <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <FormBuilder ref={builderRef} onSelect={setSelectedField} />
          </div>
        </div>
        <FieldConfigPanel
          field={selectedField}
          editField={(f, p, v) => builderRef.current?.editField(f, p, v)}
          masks={maskOptions}
        />
      </div>
      {masksOpen && <MasksDialog onClose={() => setMasksOpen(false)} />}
      {importOpen && (
        <ImportFormDialog
          onClose={() => setImportOpen(false)}
          onApply={importForm}
        />
      )}
      {preview != null && (
        <Dialog open onClose={() => setPreview(null)} width="lg" title="Pré-visualização do formulário"
          footer={<button type="button" onClick={() => setPreview(null)} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>}>
          <ReactForm schema={preview} />
        </Dialog>
      )}
    </div>
  );
}

// ─── persistência auxiliar ──────────────────────────────────────────────────

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

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
import { useFormMasks } from '@/lib/api/forms';
import { getEmbeddedFormSchema, setEmbeddedFormSchema } from '@/lib/bpmn-process';
import { fetchDataSourceOptions } from '@/lib/api/catalog';

type Props = { modeler: any | null };

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
export function FormularioView({ modeler }: Props) {
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
  const loadingRef = useRef(false);

  const maskOptions = useMemo(
    () => (masks.data ?? []).map((m) => ({ value: m.id, label: m.name, regex: m.regex, template: m.template, shouldValidate: m.shouldValidate })),
    [masks.data],
  );

  // 1) Carrega o schema persistido (prefere o XML; cai pra localStorage); extrai a flag.
  //    IMPORTANTE: quando o processo é aberto por ?key=, o XML chega DEPOIS deste
  //    mount (fetch assíncrono + importXML). Por isso recarregamos em todo
  //    `import.done` do modeler — sem isso o builder ficava com o schema vazio e o
  //    polling sobrescrevia o formSchema real do XML (perda do formulário).
  useEffect(() => {
    if (!builderRef.current) return;
    let cancelled = false;
    async function load() {
      // Pausa o polling ENQUANTO recarrega. O ref é síncrono: fecha a janela em
      // que um tick disparado entre o import.done e o clear do interval poderia
      // propagar o schema velho/vazio por cima do recém-importado.
      loadingRef.current = true;
      setReady(false);
      const fromXml = modeler ? getEmbeddedFormSchema(modeler) : null;
      const fromLs = readFormFromLocalStorage();
      const initial = (fromXml ?? fromLs) as any;
      const clean = stripLayout(initial);
      const layout = initial?.septemGroupLayout;
      if (layout === 'tabs' || layout === 'stacked') {
        setGroupLayout(layout);
        layoutRef.current = layout;
      }
      // Enriquece com as opções das fontes p/ o canvas exibi-las (não só "Value").
      const enriched = clean ? await enrichDataSourceOptions(clean) : clean;
      if (enriched && !cancelled) {
        try { await builderRef.current!.importSchema(enriched); }
        catch (err) { console.warn('Falha ao carregar schema persistido do form:', err); }
        if (!cancelled && fromXml) setFields(extractFields(enriched));
      }
      if (!cancelled) {
        lastSerialized.current = JSON.stringify(enriched ?? {});
        loadingRef.current = false;
        setReady(true);
      }
    }
    void load();
    const bus = modeler?.get?.('eventBus');
    const onImportDone = () => { void load(); };
    bus?.on('import.done', onImportDone);
    return () => {
      cancelled = true;
      bus?.off('import.done', onImportDone);
    };
  }, [modeler]);

  // 2) Polling: detecta mudanças no schema do editor e propaga (form-js não emite "changed" confiável).
  useEffect(() => {
    if (!ready) return;
    const interval = window.setInterval(() => {
      try {
        if (loadingRef.current) return; // (re)carga em andamento — não propagar
        const schema = builderRef.current?.saveSchema();
        if (!schema) return;
        const serialized = JSON.stringify(schema);
        if (serialized === lastSerialized.current) return;
        lastSerialized.current = serialized;
        propagate(schema, modeler, setFields, layoutRef.current);
      } catch (err) {
        void err; // saveSchema lança se o editor não estiver pronto — ignora
      }
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [ready, modeler, setFields]);

  function changeLayout(l: GroupLayout) {
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
          <IconButton onClick={() => setPreview(builderRef.current?.saveSchema() ?? { type: 'default', components: [], schemaVersion: 17 })}><Eye size={14} /> Pré-visualizar</IconButton>
          <IconButton onClick={() => setMasksOpen(true)}><Regex size={14} /> Máscaras</IconButton>
          {hasInstances ? (
            <Tooltip text="Este processo já tem instâncias iniciadas. Importar sobrescreveria o formulário e quebraria os dados já preenchidos.">
              <span data-testid="import-btn-disabled" className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-300"><FileUp size={14} /> Importar</span>
            </Tooltip>
          ) : (
            <IconButton onClick={() => setImportOpen(true)}><FileUp size={14} /> Importar</IconButton>
          )}
          {/* "Limpar formulário" e "Modelo com agrupamento" removidos a pedido do
              dono (2026-07-10): destrutivo/raramente úteis. */}
        </div>
      </header>
      <div className="septem-cockpit flex flex-1 overflow-hidden">
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
          onApply={(schema) => { void builderRef.current?.importSchema(schema); }}
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
const FORM_LS_KEY = 'septem.modelador.form';

function stripLayout(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const { septemGroupLayout: _omit, ...clean } = schema;
  return clean;
}

function readFormFromLocalStorage(): unknown | null {
  try { const raw = window.localStorage.getItem(FORM_LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function persistFormToLocalStorage(schema: unknown | null) {
  try {
    if (schema == null) window.localStorage.removeItem(FORM_LS_KEY);
    else window.localStorage.setItem(FORM_LS_KEY, JSON.stringify(schema));
  } catch { /* storage cheio / safari privado — ignora */ }
}
function propagate(schema: unknown, modeler: any | null, setFields: (fs: ReturnType<typeof extractFields>) => void, layout: GroupLayout) {
  const stored = { ...(schema as object), septemGroupLayout: layout };
  setFields(extractFields(schema as any));
  persistFormToLocalStorage(stored);
  if (modeler) setEmbeddedFormSchema(modeler, stored);
}


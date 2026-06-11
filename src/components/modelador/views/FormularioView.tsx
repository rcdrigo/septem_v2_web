import { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCcw, Regex } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { FormFieldsBuilder } from '@/components/form/FormFieldsBuilder';
import { ReactForm } from '@/components/form/ReactForm';
import { MasksDialog } from '@/components/form/MasksDialog';
import { buildFormJsSchema, schemaToModel } from '@/lib/form-js-schema';
import { extractFields } from '@/lib/form-schema';
import { useFormStore } from '@/stores/form';
import { useFormMasks } from '@/lib/api/forms';
import { useDataSources } from '@/lib/api/catalog';
import { getEmbeddedFormSchema, setEmbeddedFormSchema } from '@/lib/bpmn-process';
import type { FormGroup, FormField } from '@/lib/api/forms';

type Props = { modeler: any | null };

/**
 * View "Formulário" — builder React próprio (req. 7.1). Opera sobre o modelo
 * {grupos, campos}; cada mudança deriva o schema form-js e o persiste em:
 *  - `septem:FormSchema` no `bpmn:Process` (round-trip ao exportar/importar);
 *  - `localStorage` (sobrevive a F5 antes do save);
 *  - `formStore` (alimenta FieldVisibilityEditor / TarefasCamposView / gateways).
 * O ReactForm renderiza o preview e a execução com os MESMOS componentes.
 */
export function FormularioView({ modeler }: Props) {
  const setStoreFields = useFormStore((s) => s.setFields);
  const masks = useFormMasks();
  const dataSources = useDataSources();

  const [groups, setGroupsState] = useState<FormGroup[]>([]);
  const [fields, setFieldsState] = useState<FormField[]>([]);
  const [ready, setReady] = useState(false);
  const [masksOpen, setMasksOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Carrega o schema persistido (prefere o XML; cai pro localStorage) → modelo.
  useEffect(() => {
    const initial = (modeler ? getEmbeddedFormSchema(modeler) : null) ?? readFormFromLocalStorage();
    const model = schemaToModel(initial);
    setGroupsState(model.groups);
    setFieldsState(model.fields);
    setStoreFields(extractFields(initial as any));
    setReady(true);
  }, [modeler, setStoreFields]);

  const previewSchema = useMemo(() => buildFormJsSchema(groups, fields, masks.data ?? []), [groups, fields, masks.data]);

  function persist(g: FormGroup[], f: FormField[]) {
    const schema = buildFormJsSchema(g, f, masks.data ?? []);
    setStoreFields(extractFields(schema as any));
    persistFormToLocalStorage(schema);
    if (modeler) setEmbeddedFormSchema(modeler, schema);
  }
  function setGroups(g: FormGroup[]) { setGroupsState(g); persist(g, fields); }
  function setFields(f: FormField[]) { setFieldsState(f); persist(groups, f); }

  async function handleReset() {
    const ok = await confirm({
      title: 'Descartar o formulário?',
      message: 'Todos os campos cadastrados serão removidos. Esta ação não pode ser desfeita.',
      confirmLabel: 'Descartar', destructive: true,
    });
    if (!ok) return;
    setGroupsState([]); setFieldsState([]);
    setStoreFields([]);
    persistFormToLocalStorage(null);
    if (modeler) setEmbeddedFormSchema(modeler, { type: 'default', components: [], schemaVersion: 17 });
    toast.success('Formulário descartado.');
  }

  function addSampleGroup() {
    const g: FormGroup[] = [...groups, { key: 'geral', name: 'Geral', order: groups.length, columns: 1 }];
    setGroups(g);
  }

  const maskOptions = [{ value: '', label: '— nenhuma —' }, ...(masks.data ?? []).map((m) => ({ value: m.id, label: m.name }))];
  const dsOptions = [{ value: '', label: '— nenhuma —' }, ...(dataSources.data ?? []).map((d) => ({ value: d.id, label: d.name }))];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Formulário do processo</h2>
          <p className="text-xs text-slate-500">Os campos ficam disponíveis nos painéis das tarefas e na matriz "Tarefas × Campos".</p>
        </div>
        <div className="flex gap-2">
          <IconButton onClick={() => setShowPreview((p) => !p)}><Eye size={14} /> Pré-visualizar</IconButton>
          <IconButton onClick={() => setMasksOpen(true)}><Regex size={14} /> Máscaras</IconButton>
          <IconButton onClick={handleReset}><RefreshCcw size={14} /> Limpar formulário</IconButton>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {!ready ? (
            <p className="text-sm text-slate-400">Carregando…</p>
          ) : groups.length === 0 && fields.length === 0 ? (
            <div className="mx-auto max-w-md py-12 text-center">
              <p className="text-sm font-medium text-slate-700">Formulário vazio</p>
              <p className="mt-1 text-sm text-slate-500">Adicione campos e grupos para montar o formulário do processo.</p>
              <button type="button" onClick={addSampleGroup} className="mt-4 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Começar com um grupo</button>
            </div>
          ) : (
            <div className={showPreview ? '' : 'mx-auto max-w-3xl'}>
              <FormFieldsBuilder groups={groups} fields={fields} onGroups={setGroups} onFields={setFields} maskOptions={maskOptions} dsOptions={dsOptions} />
            </div>
          )}
        </div>
        {showPreview && (
          <div className="w-[440px] shrink-0 overflow-auto border-l border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pré-visualização</p>
            <ReactForm schema={previewSchema} />
          </div>
        )}
      </div>
      {masksOpen && <MasksDialog onClose={() => setMasksOpen(false)} />}
    </div>
  );
}

// ─── persistência auxiliar ──────────────────────────────────────────────────
const FORM_LS_KEY = 'septem.modelador.form';

function readFormFromLocalStorage(): unknown | null {
  try { const raw = window.localStorage.getItem(FORM_LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function persistFormToLocalStorage(schema: unknown | null) {
  try {
    if (schema == null) window.localStorage.removeItem(FORM_LS_KEY);
    else window.localStorage.setItem(FORM_LS_KEY, JSON.stringify(schema));
  } catch { /* storage cheio / safari privado — ignora */ }
}

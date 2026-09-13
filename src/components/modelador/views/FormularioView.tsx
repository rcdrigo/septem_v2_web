import { useSessionStore } from '@/stores/session';
import { openTab } from '@/lib/nav';
import { routes } from '@/lib/routes';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Rows3, Columns3, Regex, Eye, FileUp } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Dialog } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { FormBuilder } from '@/components/form/FormBuilder';
import { useProcessFormEditor } from '@/components/form/useProcessFormEditor';
import { FormFieldsPalette } from '@/components/form/FormFieldsPalette';
import { FieldConfigPanel } from '@/components/form/FieldConfigPanel';
import { ReactForm } from '@/components/form/ReactForm';
import { MasksDialog } from '@/components/form/MasksDialog';
import { ImportFormDialog } from '@/components/form/ImportFormDialog';
import { useProcessDefinition } from '@/lib/api/process-definitions';
import { useFormMasks } from '@/lib/api/forms';

type Props = { modeler: any | null; processReady?: boolean };

/**
 * View "Formulário" — editor do @bpmn-io/form-js (FormBuilder) com o painel direito
 * estendido (grupo "Configurações Septem"). Além disso, um seletor define como os
 * grupos PRINCIPAIS são exibidos na execução: empilhados ou em abas. A flag viaja
 * no schema (`septemGroupLayout`), injetada na persistência e removida antes de
 * importar no editor (o form-js não precisa conhecê-la).
 */
export function FormularioView({ modeler, processReady = true }: Props) {
  const { builderRef, ready, loadError, selectedField, setSelectedField, groupLayout,
    changeLayout, importForm, getPreview } = useProcessFormEditor(modeler, processReady);
  const masks = useFormMasks();
  const canCustomize = useSessionStore(s => s.can('forms:javascript'));
  const [masksOpen, setMasksOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [params] = useSearchParams();
  const processDef = useProcessDefinition(params.get('key'));
  const hasInstances = !!processDef.data?.hasInstances;
  const [preview, setPreview] = useState<unknown | null>(null);
  const maskOptions = useMemo(
    () => (masks.data ?? []).map((m) => ({ value: m.id, label: m.name, regex: m.regex, template: m.template, shouldValidate: m.shouldValidate })),
    [masks.data],
  );

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
          <IconButton disabled={!ready} onClick={() => setPreview(getPreview())}><Eye size={14} /> Pré-visualizar</IconButton>
          {canCustomize && <IconButton disabled={!params.get('key')} onClick={() => openTab(routes.formAutomation(params.get('key')!))}>JavaScript</IconButton>}
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

import { useSessionStore } from '@/stores/session';
import { routes } from '@/lib/routes';
import { useMemo, useRef, useState } from 'react';
import { Regex, FileUp, Download, Eye, Code2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { ReactForm, type ReactFormHandle } from '@/components/form/ReactForm';
import { IconButton } from '@/components/ui/IconButton';
import { MasksDialog } from '@/components/form/MasksDialog';
import { NativeFormEditor } from '@/components/form/NativeFormEditor';
import { useNativeProcessForm } from '@/components/form/useNativeProcessForm';
import { useFormMasks } from '@/lib/api/forms';
import { toast } from '@/stores/toast';

type Props = { modeler: any | null; processReady?: boolean; processKey?: string | null };

/** Native draft editor with the E4 filling preview; automation authoring follows in E6. */
export function FormularioView({ modeler, processReady = true, processKey }: Props) {
  const { definition, revision, error, update, importDefinition } = useNativeProcessForm(modeler, processReady);
  const masks = useFormMasks();
  const canAutomate = useSessionStore(s => s.can('forms:javascript'));
  const [masksOpen, setMasksOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState('');
  const previewRef = useRef<ReactFormHandle>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const maskOptions = useMemo(() => (masks.data ?? []).map(m => ({ value: m.id, label: m.name, regex: m.regex, template: m.template, shouldValidate: m.shouldValidate })), [masks.data]);
  // Async file reads may finish after switching process; never apply to another draft.
  const currentDefinition = useRef(definition);
  currentDefinition.current = definition;
  async function importFile(file?: File) {
    if (!file || !definition) return;
    const original = definition;
    setImporting(true); setImportError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (currentDefinition.current !== original) throw new Error('O formulário mudou durante a leitura. Selecione o arquivo novamente.');
      importDefinition(parsed); toast.success('Definição nativa importada para o rascunho.');
    } catch (cause) { setImportError(cause instanceof Error ? cause.message : 'Não foi possível importar. Escolha uma definição nativa em JSON.'); }
    finally { setImporting(false); if (input.current) input.current.value = ''; }
  }
  function exportDefinition() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'formulario-nativo.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
      <div><h2 className="text-sm font-semibold text-slate-900">Formulário do processo</h2><p className="text-xs text-slate-600">Selecione um agrupamento e adicione os campos. As alterações compõem o rascunho do processo.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {canAutomate && <IconButton disabled={!processKey} title={processKey ? 'Editar automações do processo salvo' : 'Salve o processo para editar automações'} onClick={() => { if (processKey) window.open(`${import.meta.env.BASE_URL ?? '/'}${routes.formAutomation(processKey).replace(/^\//, '')}`, '_blank', 'noopener,noreferrer'); }}><Code2 size={15} /> JavaScript</IconButton>}
        <IconButton disabled={!definition} onClick={() => { setPreviewResult(''); setPreviewOpen(true); }}><Eye size={14} /> Prévia</IconButton>
        <IconButton onClick={() => setMasksOpen(true)}><Regex size={14} /> Máscaras</IconButton>
        <IconButton disabled={!definition || importing} onClick={() => input.current?.click()}><FileUp size={14} /> {importing ? 'Importando…' : 'Importar JSON'}</IconButton>
        <IconButton disabled={!definition} onClick={exportDefinition}><Download size={14} /> Exportar JSON</IconButton>
        <input ref={input} type="file" accept=".json,application/json" aria-label="Importar definição nativa" className="sr-only" tabIndex={-1} onChange={e => void importFile(e.target.files?.[0])} />
      </div>
    </header>
    {error && <p role="alert" className="px-5 py-3 text-sm text-red-700">{error}</p>}
    {importError && <p role="alert" className="px-5 py-3 text-sm text-red-700">{importError}</p>}
    {!definition && !error && <p role="status" className="px-5 py-3 text-sm">Carregando formulário…</p>}
    {definition && <NativeFormEditor key={`${processKey}:${definition.id}:${revision}`} definition={definition} modeler={modeler} processKey={processKey} update={update} masks={maskOptions} />}
    {masksOpen && <MasksDialog onClose={() => setMasksOpen(false)} />}
    {previewOpen && definition && <Dialog open title="Prévia do formulário" width="2xl" onClose={() => setPreviewOpen(false)}>
      <p className="mb-4 text-sm text-slate-600">Teste o preenchimento e as pendências. As respostas desta prévia não serão salvas.</p>
      <ReactForm ref={previewRef} schema={definition} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <IconButton onClick={async () => { const result = await previewRef.current?.submit(); setPreviewResult(result && !Object.keys(result.errors).length ? 'Validação concluída. Nenhuma pendência.' : 'Revise os campos indicados antes de continuar.'); }}>Validar preenchimento</IconButton>
        <p role="status" className="text-sm text-slate-700">{previewResult}</p>
      </div>
    </Dialog>}
  </div>;
}

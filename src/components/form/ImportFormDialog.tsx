import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, AlertTriangle, LoaderCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toast';

type ImportError = { row: number; message: string };

/**
 * Importar formulário via planilha (Fase 4d): baixar o modelo, subir a planilha
 * preenchida e — se válida — SOBRESCREVER o formulário do editor. Os erros da
 * planilha inteira são listados de uma vez (o servidor valida antes de gerar).
 */
export function ImportFormDialog({ onClose, onApply }: { onClose: () => void; onApply: (schema: unknown) => void }) {
  const [erros, setErros] = useState<ImportError[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function baixarModelo() {
    if (baixando) return;
    setBaixando(true);
    try {
      const blob = await api.getBlob('/api/v1/workflow/form-import/template');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'modelo-formulario.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Não foi possível baixar o modelo.'); }
    finally { setBaixando(false); }
  }

  async function importar(file: File) {
    setEnviando(true); setErros(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const schema = await api.postForm<unknown>('/api/v1/workflow/form-import', form);
      onApply(schema);
      toast.success('Formulário importado. Revise e salve o processo.');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const body = e.body as { errors?: ImportError[] } | undefined;
        setErros(body?.errors ?? [{ row: 0, message: 'Planilha inválida.' }]);
      } else {
        toast.error('Não foi possível importar a planilha.');
      }
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Dialog open onClose={onClose} width="lg" title="Importar formulário (planilha)"
      footer={<button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Monte o formulário numa planilha: cada linha é um campo (agrupamento, nome, ajuda,
          obrigatório e tipo). Importar <strong>sobrescreve</strong> o formulário atual do editor.
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={baixarModelo} disabled={baixando} aria-busy={baixando}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">
            {baixando ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />} {baixando ? 'Baixando…' : 'Baixar modelo (.xlsx)'}
          </button>
          <a href="https://septem.app/docs/importar-formulario" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <FileSpreadsheet size={15} /> Manual técnico
          </a>
        </div>

        <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center ${enviando ? 'opacity-60' : 'border-slate-300 hover:border-slate-400'}`}>
          <Upload size={20} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">{enviando ? 'Importando…' : 'Selecionar a planilha preenchida'}</span>
          <span className="text-xs text-slate-400">.xlsx</span>
          <input ref={inputRef} type="file" accept=".xlsx" className="hidden" disabled={enviando}
            data-testid="import-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importar(f); }} />
        </label>

        {erros && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3" data-testid="import-erros">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-rose-700">
              <AlertTriangle size={15} /> A planilha tem {erros.length} problema{erros.length === 1 ? '' : 's'} — corrija e tente de novo:
            </p>
            <ul className="ml-1 flex flex-col gap-0.5 text-sm text-rose-700">
              {erros.map((e, i) => (
                <li key={i}>{e.row > 0 ? <strong>Linha {e.row}:</strong> : null} {e.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

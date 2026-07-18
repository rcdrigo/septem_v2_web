import { useState } from 'react';
import { FileStack, Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Combobox } from '@/components/ui/Combobox';
import { useDocumentTemplates } from '@/lib/api/document-templates';

/** Uma regra: se a condição bater, este modelo é o disponível (modelos_documentos:58). */
export type DocRegra = { fieldRef: string; operator: string; value: string; templateId: string };

/** Parametrização do documento gravada nas properties do campo de anexo. */
export type DocGenConfig = {
  /** fixo | lista | regra */
  mode: 'fixo' | 'lista' | 'regra';
  /** Modelo único (mode = fixo). */
  templateId?: string;
  /** Modelos disponíveis (mode = lista). */
  templateIds?: string[];
  /** Regras avaliadas em ordem; a 1ª que bater define o modelo (mode = regra). */
  rules?: DocRegra[];
};

const OPERADORES = [
  { value: 'eq', label: 'é igual a' },
  { value: 'neq', label: 'é diferente de' },
  { value: 'gt', label: 'é maior que' },
  { value: 'lt', label: 'é menor que' },
  { value: 'contains', label: 'contém' },
  { value: 'empty', label: 'está vazio' },
  { value: 'notEmpty', label: 'não está vazio' },
];

/** Lê a config do JSON guardado na property (tolerante a lixo). */
export function parseDocGen(raw: string | undefined): DocGenConfig {
  if (!raw) return { mode: 'fixo' };
  try {
    const p = JSON.parse(raw) as DocGenConfig;
    return { mode: p.mode ?? 'fixo', templateId: p.templateId, templateIds: p.templateIds ?? [], rules: p.rules ?? [] };
  } catch { return { mode: 'fixo' }; }
}

/**
 * Seção "Parametrização do documento" (modelos_documentos:51-58), exibida quando o campo
 * de anexo tem "Gera documento?" marcado. O documento pode ser FIXO (um modelo), uma
 * LISTA (o executor escolhe) ou vir de REGRA DE NEGÓCIO (a 1ª regra que bater define o
 * modelo; nenhuma regra atendida = nenhum modelo disponível).
 */
export function DocumentGenConfig({
  value, onChange, camposDoForm,
}: {
  value: DocGenConfig;
  onChange: (next: DocGenConfig) => void;
  /** Campos do formulário, para as regras (chave + rótulo). */
  camposDoForm: { key: string; label: string }[];
}) {
  const modelos = useDocumentTemplates();
  const [picker, setPicker] = useState<null | { multi: boolean; ruleIndex?: number }>(null);

  const ativos = (modelos.data ?? []).filter((m) => m.active);
  const nomeDoModelo = (id?: string) => ativos.find((m) => m.id === id)?.name ?? (id ? '(modelo removido)' : '— nenhum —');

  const setMode = (mode: DocGenConfig['mode']) => onChange({ ...value, mode });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-2" data-testid="doc-param">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parametrização do documento</p>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="radio"
          name="docgen-mode"
          checked={value.mode === 'fixo'}
          onChange={() => setMode('fixo')}
          className="mt-0.5"
        />
        Documento fixo
      </label>
      {value.mode === 'fixo' && (
        <div className="ml-5 flex items-center gap-2">
          <span className="truncate text-xs text-slate-600" data-testid="doc-param-fixo">{nomeDoModelo(value.templateId)}</span>
          <button type="button" onClick={() => setPicker({ multi: false })}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">
            Buscar modelo
          </button>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="radio" name="docgen-mode" checked={value.mode === 'lista'} onChange={() => setMode('lista')} className="mt-0.5" />
        Lista de modelos (o executor escolhe)
      </label>
      {value.mode === 'lista' && (
        <div className="ml-5 flex flex-col gap-1">
          <ul className="flex flex-col gap-1" data-testid="doc-param-lista">
            {(value.templateIds ?? []).map((id) => (
              <li key={id} className="flex items-center gap-2 text-xs text-slate-700">
                <FileStack size={12} className="shrink-0 text-slate-400" />
                <span className="truncate">{nomeDoModelo(id)}</span>
                <button type="button" title="Remover"
                  onClick={() => onChange({ ...value, templateIds: (value.templateIds ?? []).filter((x) => x !== id) })}
                  className="ml-auto rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700">
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
            {(value.templateIds ?? []).length === 0 && <li className="text-xs text-slate-400">Nenhum modelo escolhido.</li>}
          </ul>
          <button type="button" onClick={() => setPicker({ multi: true })}
            className="w-fit rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">
            Escolher modelos
          </button>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="radio" name="docgen-mode" checked={value.mode === 'regra'} onChange={() => setMode('regra')} className="mt-0.5" />
        Por regra de negócio
      </label>
      {value.mode === 'regra' && (
        <div className="ml-5 flex flex-col gap-1" data-testid="doc-param-regras">
          {(value.rules ?? []).map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1 rounded border border-slate-200 bg-white p-1">
              <span className="text-[11px] text-slate-500">se</span>
              <select
                value={r.fieldRef}
                aria-label="Campo da regra"
                onChange={(e) => updateRule(i, { fieldRef: e.target.value })}
                className="min-w-0 flex-1 rounded border border-slate-300 px-1 py-0.5 text-xs"
              >
                <option value="">campo…</option>
                {camposDoForm.map((c) => <option key={c.key} value={c.key}>{c.label || c.key}</option>)}
              </select>
              <select
                value={r.operator}
                aria-label="Operador da regra"
                onChange={(e) => updateRule(i, { operator: e.target.value })}
                className="rounded border border-slate-300 px-1 py-0.5 text-xs"
              >
                {OPERADORES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {!['empty', 'notEmpty'].includes(r.operator) && (
                <input
                  value={r.value}
                  aria-label="Valor da regra"
                  onChange={(e) => updateRule(i, { value: e.target.value })}
                  placeholder="valor"
                  className="w-20 rounded border border-slate-300 px-1 py-0.5 text-xs"
                />
              )}
              <span className="text-[11px] text-slate-500">→</span>
              <button type="button" onClick={() => setPicker({ multi: false, ruleIndex: i })}
                className="max-w-[8rem] truncate rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-50">
                {nomeDoModelo(r.templateId)}
              </button>
              <button type="button" title="Remover regra"
                onClick={() => onChange({ ...value, rules: (value.rules ?? []).filter((_, j) => j !== i) })}
                className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            data-testid="doc-param-add-regra"
            onClick={() => onChange({ ...value, rules: [...(value.rules ?? []), { fieldRef: '', operator: 'eq', value: '', templateId: '' }] })}
            className="inline-flex w-fit items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <Plus size={12} /> Adicionar regra
          </button>
          <p className="text-[11px] text-slate-500">
            A primeira regra atendida define o modelo. Se nenhuma for atendida, nenhum modelo fica disponível.
          </p>
        </div>
      )}

      {picker && (
        <ModeloPicker
          multi={picker.multi}
          selecionados={picker.multi ? (value.templateIds ?? []) : []}
          onClose={() => setPicker(null)}
          onPick={(ids) => {
            if (picker.ruleIndex !== undefined) updateRule(picker.ruleIndex, { templateId: ids[0] ?? '' });
            else if (picker.multi) onChange({ ...value, templateIds: ids });
            else onChange({ ...value, templateId: ids[0] ?? '' });
            setPicker(null);
          }}
        />
      )}
    </div>
  );

  function updateRule(i: number, patch: Partial<DocRegra>) {
    const rules = [...(value.rules ?? [])];
    rules[i] = { ...rules[i], ...patch };
    onChange({ ...value, rules });
  }
}

/** Modal de busca de modelos (:55 fixo / :56 lista). */
function ModeloPicker({
  multi, selecionados, onPick, onClose,
}: {
  multi: boolean;
  selecionados: string[];
  onPick: (ids: string[]) => void;
  onClose: () => void;
}) {
  const modelos = useDocumentTemplates();
  const [sel, setSel] = useState<string[]>(selecionados);
  const [um, setUm] = useState('');

  const ativos = (modelos.data ?? []).filter((m) => m.active);

  return (
    <Dialog
      open
      onClose={onClose}
      width="md"
      title={multi ? 'Escolher modelos disponíveis' : 'Buscar modelo'}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
          <button
            type="button"
            data-testid="modelo-picker-ok"
            onClick={() => onPick(multi ? sel : (um ? [um] : []))}
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Confirmar
          </button>
        </>
      }
    >
      {modelos.isLoading ? (
        <p className="py-6 text-center text-sm text-slate-400">Carregando modelos…</p>
      ) : ativos.length === 0 ? (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
          Nenhum modelo de documento ativo. Cadastre em Admin › Modelos de documentos.
        </p>
      ) : multi ? (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" data-testid="modelo-picker-lista">
          {ativos.map((m) => (
            <li key={m.id}>
              <label className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={sel.includes(m.id)}
                  onChange={(e) => setSel(e.target.checked ? [...sel, m.id] : sel.filter((x) => x !== m.id))}
                />
                <span className="truncate">{m.name}</span>
                <span className="ml-auto text-xs uppercase text-slate-400">{m.outputType}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <Combobox
          value={um}
          options={ativos.map((m) => ({ value: m.id, label: `${m.name} (${m.outputType.toUpperCase()})` }))}
          onChange={setUm}
          placeholder="Selecione o modelo"
        />
      )}
    </Dialog>
  );
}

import { useEffect, useRef, useState } from 'react';
import { LayoutTemplate, RefreshCcw, Regex } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { FormBuilder, type FormBuilderHandle } from '@/components/form/FormBuilder';
import { MasksDialog } from '@/components/form/MasksDialog';
import { extractFields } from '@/lib/form-schema';
import { useFormStore } from '@/stores/form';
import { getEmbeddedFormSchema, setEmbeddedFormSchema } from '@/lib/bpmn-process';

type Props = {
  modeler: any | null;
};

const POLL_MS = 600;

/**
 * View "Formulário" — embute o `FormBuilder` (form-js) e mantém o schema
 * sincronizado em três lugares:
 *  - `formStore` (Zustand) — alimenta `FieldVisibilityEditor`, `TarefasCamposView`,
 *    `GatewayConditionEditor` (seletor de campos).
 *  - `localStorage` (chave dedicada) — sobrevive a F5 mesmo quando o BPMN ainda
 *    não foi salvo.
 *  - `septem:FormSchema` body no `bpmn:Process` — garante round-trip ao exportar/importar.
 *
 * O form-js v1 não dispara um evento de `changed` consistentemente em todas as
 * versões, então fazemos polling do schema (lightweight: 600ms; só persiste se
 * o JSON mudou).
 */
export function FormularioView({ modeler }: Props) {
  const builderRef = useRef<FormBuilderHandle>(null);
  const setFields = useFormStore((s) => s.setFields);
  const [ready, setReady] = useState(false);
  const [masksOpen, setMasksOpen] = useState(false);
  const lastSerialized = useRef<string>('');

  // 1) Carrega o schema persistido (preferindo o XML; cai pra localStorage)
  useEffect(() => {
    if (!builderRef.current) return;
    let cancelled = false;
    (async () => {
      const fromXml = modeler ? getEmbeddedFormSchema(modeler) : null;
      const fromLs = readFormFromLocalStorage();
      const initial = fromXml ?? fromLs;
      if (initial && !cancelled) {
        try {
          await builderRef.current!.importSchema(initial);
        } catch (err) {
          console.warn('Falha ao carregar schema persistido do form:', err);
        }
      }
      if (!cancelled) {
        lastSerialized.current = JSON.stringify(initial ?? {});
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modeler]);

  // 2) Polling: detecta mudanças no schema e propaga
  useEffect(() => {
    if (!ready) return;
    const interval = window.setInterval(() => {
      try {
        const schema = builderRef.current?.saveSchema();
        if (!schema) return;
        const serialized = JSON.stringify(schema);
        if (serialized === lastSerialized.current) return;
        lastSerialized.current = serialized;
        propagate(schema, modeler, setFields);
      } catch (err) {
        // saveSchema lança se o editor não estiver pronto — ignora silenciosamente
        void err;
      }
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [ready, modeler, setFields]);

  async function handleReset() {
    const ok = await confirm({
      title: 'Descartar o formulário?',
      message: 'Todos os campos cadastrados serão removidos. Esta ação não pode ser desfeita.',
      confirmLabel: 'Descartar',
      destructive: true,
    });
    if (!ok) return;
    await builderRef.current?.reset();
    lastSerialized.current = '';
    setFields([]);
    persistFormToLocalStorage(null);
    if (modeler) setEmbeddedFormSchema(modeler, { type: 'default', components: [], schemaVersion: 17 });
    toast.success('Formulário descartado.');
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Formulário do processo</h2>
          <p className="text-xs text-slate-500">
            Os campos cadastrados aqui ficam disponíveis nos painéis das tarefas e na matriz
            "Tarefas × Campos".
          </p>
        </div>
        <div className="flex gap-2">
          <IconButton onClick={() => setMasksOpen(true)}>
            <Regex size={14} />
            Máscaras
          </IconButton>
          <IconButton onClick={handleReset}>
            <RefreshCcw size={14} />
            Limpar formulário
          </IconButton>
          <IconButton variant="primary" onClick={() => builderRef.current?.importSchema(EMPTY_GROUP_TEMPLATE)}>
            <LayoutTemplate size={14} />
            Modelo com agrupamento
          </IconButton>
        </div>
      </header>
      <FormBuilder ref={builderRef} />
      {masksOpen && <MasksDialog onClose={() => setMasksOpen(false)} />}
    </div>
  );
}

// ─── persistência auxiliar ──────────────────────────────────────────────────

const FORM_LS_KEY = 'septem.modelador.form';

function readFormFromLocalStorage(): unknown | null {
  try {
    const raw = window.localStorage.getItem(FORM_LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistFormToLocalStorage(schema: unknown | null) {
  try {
    if (schema == null) window.localStorage.removeItem(FORM_LS_KEY);
    else window.localStorage.setItem(FORM_LS_KEY, JSON.stringify(schema));
  } catch {
    /* storage cheio / safari privado — ignora */
  }
}

function propagate(
  schema: unknown,
  modeler: any | null,
  setFields: (fs: ReturnType<typeof extractFields>) => void,
) {
  const fields = extractFields(schema as any);
  setFields(fields);
  persistFormToLocalStorage(schema);
  if (modeler) setEmbeddedFormSchema(modeler, schema);
}

// Modelo inicial útil: um grupo "Geral" + campo de texto.
const EMPTY_GROUP_TEMPLATE = {
  type: 'default',
  components: [
    {
      type: 'group',
      label: 'Geral',
      components: [
        { type: 'textfield', key: 'nome', label: 'Nome' },
      ],
    },
  ],
  schemaVersion: 17,
};

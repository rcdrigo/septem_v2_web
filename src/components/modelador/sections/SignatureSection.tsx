import { Check, X } from 'lucide-react';
import { Field, PlaceholderBox, RadioGroup, Section } from '@/components/ui/Field';
import { Combobox } from '@/components/ui/Combobox';
import { useExtensionState } from '@/lib/useExtensionState';
import { useFormStore } from '@/stores/form';

type Props = {
  modeler: any;
  element: any;
};

type SignatureConfig = {
  mode: 'none' | 'electronic';
  /** Chaves dos campos de anexo, uma por linha (formato do XML). */
  fields: string;
  required: boolean;
  batch: boolean;
};

const DEFAULTS: SignatureConfig = { mode: 'none', fields: '', required: false, batch: false };

const MODE_OPTIONS = [
  { value: 'none', label: 'Não utilizar assinatura' },
  { value: 'electronic', label: 'Utilizar assinatura eletrônica' },
] as const;

/** Só campos de ANEXO são assináveis (resposta 13): assinar texto não faz sentido. */
const TIPO_ANEXO = 'filepicker';

const paraLista = (texto: string) =>
  texto.split('\n').map((l) => l.trim()).filter(Boolean);
const paraTexto = (lista: string[]) => lista.join('\n');

/**
 * Seção "Assinaturas" da tarefa (Fase 6 do plano 2026-08-03).
 *
 * O que mudou: os campos deixaram de ser digitados à mão e passaram a ser
 * **escolhidos** num seletor pesquisável, restrito aos campos de ANEXO do formulário.
 * Digitar o identificador à mão era a fonte natural de erro — um typo só aparecia
 * quando ninguém conseguia assinar.
 *
 * ⚠️ Compatibilidade: processos antigos gravaram texto livre. Um valor que não casa
 * com nenhum campo do formulário **continua na lista, marcado como não encontrado** —
 * descartar em silêncio apagaria configuração que alguém fez de propósito.
 */
export function SignatureSection({ modeler, element }: Props) {
  const { state, flush } = useExtensionState(
    modeler,
    element,
    'septem:Signature',
    DEFAULTS,
  );

  const campos = useFormStore((s) => s.fields);
  const anexos = campos.filter((f) => f.type === TIPO_ANEXO);
  const selecionados = paraLista(state.fields);

  const opcoes = anexos
    .filter((f) => !selecionados.includes(f.id))
    .map((f) => ({ value: f.id, label: `${f.label || f.id} (${f.id})` }));

  function acrescentar(id: string) {
    if (!id || selecionados.includes(id)) return;
    flush({ fields: paraTexto([...selecionados, id]) });
  }

  function remover(id: string) {
    flush({ fields: paraTexto(selecionados.filter((x) => x !== id)) });
  }

  return (
    <Section title="Assinaturas">
      <RadioGroup<'none' | 'electronic'>
        name="sig-mode"
        value={state.mode}
        onChange={(v) => flush({ mode: v, ...(v === 'none' ? { fields: '', required: false, batch: false } : {}) })}
        options={MODE_OPTIONS as any}
      />

      {state.mode === 'electronic' && (
        <>
          <Field
            label="Campos a serem assinados"
            help="Somente campos de anexo do formulário podem ser assinados."
          >
            {/* Contêiner com identificador próprio: o painel do modelador tem vários
                comboboxes e, sem um alvo estável, teste (e usuário de leitor de tela)
                não distinguem qual é qual. */}
            <div data-testid="sig-seletor-campos">
              <Combobox
                value=""
                options={opcoes}
                onChange={acrescentar}
                placeholder={anexos.length === 0
                  ? 'O formulário não tem campos de anexo'
                  : 'Busque e selecione um campo de anexo'}
              />
            </div>
          </Field>

          {selecionados.length > 0 && (
            <ul data-testid="sig-campos-escolhidos" className="mt-2 space-y-1">
              {selecionados.map((id) => {
                const campo = anexos.find((f) => f.id === id);
                const orfao = !campo;
                return (
                  <li
                    key={id}
                    className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                      orfao ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {orfao ? (
                        <>
                          {id}
                          <span className="ml-1.5 text-xs">— campo não encontrado no formulário</span>
                        </>
                      ) : (
                        <>
                          <Check size={13} className="mr-1 inline text-emerald-600" />
                          {campo.label || id}
                          <span className="ml-1 text-xs text-slate-500">({id})</span>
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remover ${id}`}
                      onClick={() => remover(id)}
                      className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                    >
                      <X size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selecionados.length === 0 && (
            <PlaceholderBox>Informe ao menos um campo para assinar.</PlaceholderBox>
          )}

          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              data-testid="sig-obrigatoria"
              checked={state.required}
              onChange={(e) => flush({ required: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              Assinatura obrigatória
              <span className="block text-xs text-slate-500">
                Bloqueia os botões de conclusão que validam o formulário até que os documentos sejam assinados.
              </span>
            </span>
          </label>

          <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              data-testid="sig-lote"
              checked={state.batch}
              onChange={(e) => flush({ batch: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              Permitir que os documentos sejam assinados em lote
              <span className="block text-xs text-slate-500">
                Acrescenta o botão "Assinar documentos em lote" antes dos demais botões de conclusão.
              </span>
            </span>
          </label>
        </>
      )}
    </Section>
  );
}

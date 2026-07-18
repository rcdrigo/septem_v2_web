import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { RadioGroup, Select, TextInput } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import {
  getGatewayCondition,
  setGatewayButton,
  setGatewayButtonConnector,
  setGatewayConditionMode,
  setGatewayRules,
  OPERATOR_OPTIONS,
  type ComparisonOperator,
  type FormRule,
  type GatewayConditionMode,
  type RuleConnector,
  type RuleLogic,
} from '@/lib/bpmn-gateway-conditions';
import { getAllProcessButtons } from '@/lib/bpmn-action-buttons';
import { useFormStore } from '@/stores/form';
import { useEnsureFormFields } from '@/lib/use-ensure-form-fields';
import { FormFieldSelect } from '@/components/modelador/fields/FormFieldSelect';
import { HelpPopover } from '@/components/ui/HelpPopover';

type Props = {
  modeler: any;
  /** SequenceFlow saindo do gateway (a conexão sendo configurada). */
  connection: any;
};

const MODE_OPTIONS: ReadonlyArray<{ value: GatewayConditionMode; label: string; help?: string }> = [
  {
    value: 'rules',
    label: 'Por botão de ação clicado e/ou valores do formulário',
    help: 'Combine o botão clicado na última tarefa com comparações de campos do formulário.',
  },
  {
    value: 'else',
    label: 'Quando nenhuma das demais regras for atendida',
    help: 'Caminho padrão. Apenas uma conexão pode ser marcada como "else" por gateway.',
  },
];

/**
 * Editor de condições por conexão de saída de gateway condicional. No modo
 * `rules`, combina "último botão de ação clicado" E/OU "valores do formulário"
 * (com operadores `=, <>, >, <, >=, <=`, `contains`/`startsWith` e agrupamento
 * por parênteses). Renderizado num modal por `GatewayLinksSection`.
 */
export function GatewayConditionEditor({ modeler, connection }: Props) {
  const [cond, setCond] = useState(() => getGatewayCondition(connection));

  useEffect(() => {
    setCond(getGatewayCondition(connection));
  }, [connection]);

  const buttonGroups = useMemo(() => getAllProcessButtons(modeler), [modeler, cond.mode]);
  // Popula o formStore a partir do schema embutido no XML — sem isto, abrir o
  // modal direto pela aba Fluxo mostrava input de texto ("id do campo") mesmo
  // com formulário configurado, porque o store só era populado na aba Formulário.
  useEnsureFormFields(modeler);

  function changeMode(next: GatewayConditionMode) {
    setGatewayConditionMode(modeler, connection, next);
    setCond(getGatewayCondition(connection));
  }

  function changeButton(buttonId: string) {
    setGatewayButton(modeler, connection, buttonId);
    setCond((c) => ({ ...c, buttonId, mode: 'rules' }));
  }

  function changeButtonConnector(buttonConnector: RuleConnector) {
    setGatewayButtonConnector(modeler, connection, buttonConnector);
    setCond((c) => ({ ...c, buttonConnector, mode: 'rules' }));
  }

  function changeRules(next: FormRule[]) {
    setGatewayRules(modeler, connection, next);
    setCond((c) => ({ ...c, rules: next, mode: 'rules' }));
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      {/* Seletor de modo — NÃO usar <Field> (que é um <label>): aninhar um
          RadioGroup dentro de um <label> faz o clique borbulhar e sempre voltar
          pra 1ª opção. Renderizamos com <span> + RadioGroup soltos. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Quando este caminho é seguido
        </span>
        <RadioGroup<GatewayConditionMode>
          name={`cond-mode-${connection.id}`}
          value={cond.mode}
          onChange={changeMode}
          options={MODE_OPTIONS as any}
        />
      </div>

      {cond.mode === 'rules' && (
        <>
          <ButtonConditionSection
            groups={buttonGroups}
            buttonId={cond.buttonId}
            connector={cond.buttonConnector}
            showConnector={cond.rules.length > 0}
            onButton={changeButton}
            onConnector={changeButtonConnector}
          />
          <FormRulesEditor rules={cond.rules} logic={cond.logic} onChange={changeRules} />
        </>
      )}

      {cond.mode === 'else' && (
        <p className="text-xs text-slate-500">
          Sem regras — esta conexão é o caminho padrão. Lembre-se de garantir que apenas uma conexão
          do gateway esteja em "else".
        </p>
      )}
    </div>
  );
}

/**
 * Seção "Último botão de ação clicado": combobox com os botões do processo e,
 * quando há regras de formulário, um conector E/OU que liga o botão às regras.
 */
function ButtonConditionSection({
  groups,
  buttonId,
  connector,
  showConnector,
  onButton,
  onConnector,
}: {
  groups: ReturnType<typeof getAllProcessButtons>;
  buttonId: string;
  connector: RuleConnector;
  showConnector: boolean;
  onButton: (v: string) => void;
  onConnector: (v: RuleConnector) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        Último botão de ação clicado
        <HelpPopover html="Seleciona o botão clicado na última tarefa para decidir se esta conexão deve ser seguida." ariaLabel="Ajuda: último botão de ação clicado" />
      </span>
      {groups.length === 0 ? (
        <p className="text-xs text-slate-500">
          Nenhuma tarefa do processo tem botões configurados. Configure os botões em alguma tarefa
          humana para usar esta condição.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Select
              className="w-full min-w-0"
              value={buttonId}
              placeholder="Selecione uma opção…"
              onChange={(e) => onButton(e.target.value)}
              options={groups.flatMap((g) =>
                // Rótulo: NOME DO BOTÃO → tarefa a que pertence.
                g.buttons.map((b) => ({ value: b.id, label: `${b.label} → ${g.ownerLabel}` })),
              )}
            />
          </div>
          {showConnector && (
            <div className="w-16 shrink-0">
              <Select
                aria-label="Conector do botão com as regras"
                className="w-full min-w-0"
                value={connector}
                onChange={(e) => onConnector(e.target.value as RuleConnector)}
                options={[
                  { value: 'and', label: 'E' },
                  { value: 'or', label: 'OU' },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FormRulesEditor({
  rules,
  logic,
  onChange,
}: {
  rules: FormRule[];
  logic: RuleLogic;
  onChange: (next: FormRule[]) => void;
}) {
  // Conector default herdado do formato antigo (logic global all→E | any→OU),
  // usado quando a regra ainda não tem conector explícito. Preserva a semântica
  // de fluxos salvos antes do agrupamento por regra.
  const defaultConnector: RuleConnector = logic === 'any' ? 'or' : 'and';

  function update(idx: number, patch: Partial<FormRule>) {
    onChange(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeAt(idx: number) {
    onChange(rules.filter((_, i) => i !== idx));
  }
  function addRule() {
    onChange([...rules, { fieldRef: '', operator: 'eq', value: '', connector: defaultConnector }]);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        Valores do formulário
        <HelpPopover
          html="Compare campos do formulário com valores esperados. Combine as regras com E/OU e use parênteses para definir a precedência. Sem parênteses, E tem precedência sobre OU. Exemplo de valor: 1000."
          ariaLabel="Ajuda: valores do formulário"
        />
      </span>
      {rules.length === 0 && (
        <p className="text-xs text-slate-500">Nenhuma regra. Adicione comparações com campos do formulário.</p>
      )}
      {/* Linha da regra: no desktop (md+) tudo numa linha; em telas estreitas o grid
          reorganiza em 3 linhas — [conector ( … ) excluir] / [campo] / [operador valor] —
          senão os últimos controles estouram o modal e ficam cortados/inacessíveis.
          A 1ª regra não tem conector E/OU: o grid dela suprime essa coluna (sem vão). */}
      {rules.map((rule, idx) => {
        const first = idx === 0;
        return (
        <div
          key={idx}
          className={
            first
              ? 'grid grid-cols-[4rem_minmax(0,1fr)_4rem_2rem] items-center gap-2 rounded-md border border-slate-200 bg-white p-2 md:grid-cols-[4rem_minmax(0,1.6fr)_8.5rem_minmax(0,1.4fr)_4rem_2rem]'
              : 'grid grid-cols-[4.5rem_4rem_minmax(0,1fr)_4rem_2rem] items-center gap-2 rounded-md border border-slate-200 bg-white p-2 md:grid-cols-[4.5rem_4rem_minmax(0,1.6fr)_8.5rem_minmax(0,1.4fr)_4rem_2rem]'
          }
        >
          {/* Conector com a regra anterior — a 1ª regra não tem a coluna */}
          {!first && (
            <Select
              aria-label="Conector"
              className="col-start-1 row-start-1 w-full min-w-0 md:col-auto md:row-auto"
              value={rule.connector ?? defaultConnector}
              onChange={(e) => update(idx, { connector: e.target.value as RuleConnector })}
              options={[
                { value: 'and', label: 'E' },
                { value: 'or', label: 'OU' },
              ]}
            />
          )}
          {/* Abre grupo "(" */}
          <Select
            aria-label="Abrir grupo"
            className={`${first ? 'col-start-1' : 'col-start-2'} row-start-1 w-full min-w-0 !pl-2 !pr-6 text-center md:col-auto md:row-auto`}
            value={rule.open ? '(' : ''}
            onChange={(e) => update(idx, { open: e.target.value === '(' })}
            options={[
              { value: '', label: '' },
              { value: '(', label: '(' },
            ]}
          />
          <div className="col-span-full row-start-2 min-w-0 md:col-auto md:col-span-1 md:row-auto">
            <FieldRefSelect
              value={rule.fieldRef}
              onChange={(v) => update(idx, { fieldRef: v })}
            />
          </div>
          <Select
            aria-label="Operador"
            className="col-span-2 col-start-1 row-start-3 w-full min-w-0 md:col-span-1 md:col-auto md:row-auto"
            value={rule.operator}
            onChange={(e) => update(idx, { operator: e.target.value as ComparisonOperator })}
            options={OPERATOR_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <TextInput
            aria-label="Valor de comparação"
            className={`${first ? 'col-span-2' : 'col-span-3'} col-start-3 row-start-3 w-full min-w-0 md:col-span-1 md:col-auto md:row-auto`}
            value={rule.value}
            onChange={(e) => update(idx, { value: e.target.value })}
          />
          {/* Fecha grupo ")" */}
          <Select
            aria-label="Fechar grupo"
            className={`${first ? 'col-start-3' : 'col-start-4'} row-start-1 w-full min-w-0 !pl-2 !pr-6 text-center md:col-auto md:row-auto`}
            value={rule.close ? ')' : ''}
            onChange={(e) => update(idx, { close: e.target.value === ')' })}
            options={[
              { value: '', label: '' },
              { value: ')', label: ')' },
            ]}
          />
          <button
            type="button"
            onClick={() => removeAt(idx)}
            aria-label="Remover regra"
            className={`${first ? 'col-start-4' : 'col-start-5'} row-start-1 justify-self-end rounded p-1.5 text-rose-600 hover:bg-rose-50 md:col-auto md:row-auto`}
          >
            <Trash2 size={14} />
          </button>
        </div>
        );
      })}

      <IconButton onClick={addRule} className="self-start">
        <Plus size={14} /> Adicionar regra
      </IconButton>
    </div>
  );
}

function FieldRefSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fields = useFormStore((s) => s.fields);
  // Quando não há formulário ainda, aceitamos texto livre como fallback.
  if (fields.length === 0) {
    return (
      <TextInput
        aria-label="Identificador do campo"
        className="w-full min-w-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  // Combobox pesquisável com os campos do formulário (mesmo seletor das demais telas).
  return <FormFieldSelect value={value} onChange={onChange} placeholder="Selecione o campo…" />;
}

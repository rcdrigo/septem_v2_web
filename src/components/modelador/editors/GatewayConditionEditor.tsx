import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field, RadioGroup, Select, TextInput } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import {
  getGatewayCondition,
  setGatewayButton,
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
import { useFormStore, selectFieldGroups } from '@/stores/form';

type Props = {
  modeler: any;
  /** SequenceFlow saindo do gateway (a conexão sendo configurada). */
  connection: any;
};

const MODE_OPTIONS: ReadonlyArray<{ value: GatewayConditionMode; label: string; hint?: string }> = [
  {
    value: 'button',
    label: 'Botão de conclusão clicado',
    hint: 'O fluxo segue por aqui quando o usuário clicar em um botão específico da última tarefa.',
  },
  {
    value: 'formValues',
    label: 'Valores do formulário',
    hint: 'Avalia campos do formulário com operadores de comparação.',
  },
  {
    value: 'else',
    label: 'Quando nenhuma das demais regras for atendida',
    hint: 'Caminho padrão. Apenas uma conexão pode ser marcada como "else" por gateway.',
  },
];

/**
 * Editor de condições por conexão de saída de gateway condicional, com
 * operadores `=, <>, >, <, >=, <=`, além de `contains`/`startsWith`.
 *
 * Renderizado inline em `GatewayLinksSection` ao expandir uma linha.
 */
export function GatewayConditionEditor({ modeler, connection }: Props) {
  const [cond, setCond] = useState(() => getGatewayCondition(connection));

  useEffect(() => {
    setCond(getGatewayCondition(connection));
  }, [connection]);

  const buttonGroups = useMemo(() => getAllProcessButtons(modeler), [modeler, cond.mode]);
  const fields = useFormStore((s) => s.fields);
  const fieldGroups = useMemo(() => selectFieldGroups(fields), [fields]);

  function changeMode(next: GatewayConditionMode) {
    setGatewayConditionMode(modeler, connection, next);
    setCond(getGatewayCondition(connection));
  }

  function changeButton(buttonId: string) {
    setGatewayButton(modeler, connection, buttonId);
    setCond((c) => ({ ...c, buttonId, mode: 'button' }));
  }

  function changeRules(next: FormRule[]) {
    setGatewayRules(modeler, connection, next);
    setCond((c) => ({ ...c, rules: next, mode: 'formValues' }));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <Field label="Quando este caminho é seguido">
        <RadioGroup<GatewayConditionMode>
          name={`cond-mode-${connection.id}`}
          value={cond.mode}
          onChange={changeMode}
          options={MODE_OPTIONS as any}
        />
      </Field>

      {cond.mode === 'button' && <ButtonChooser groups={buttonGroups} value={cond.buttonId} onChange={changeButton} />}

      {cond.mode === 'formValues' && (
        <FormRulesEditor rules={cond.rules} logic={cond.logic} fieldGroups={fieldGroups} onChange={changeRules} />
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

function ButtonChooser({
  groups,
  value,
  onChange,
}: {
  groups: ReturnType<typeof getAllProcessButtons>;
  value: string;
  onChange: (v: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Nenhuma tarefa do processo tem botões configurados. Configure os botões em alguma tarefa
        humana antes de usar este modo.
      </p>
    );
  }

  return (
    <Field label="Botão clicado">
      <Select
        value={value}
        placeholder="Selecione um botão…"
        onChange={(e) => onChange(e.target.value)}
        options={groups.flatMap((g) =>
          g.buttons.map((b) => ({ value: b.id, label: `${g.ownerLabel} → ${b.label}` })),
        )}
      />
    </Field>
  );
}

function FormRulesEditor({
  rules,
  logic,
  fieldGroups,
  onChange,
}: {
  rules: FormRule[];
  logic: RuleLogic;
  fieldGroups: ReturnType<typeof selectFieldGroups>;
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
      {rules.length === 0 && (
        <p className="text-xs text-slate-500">Nenhuma regra. Adicione comparações com campos do formulário.</p>
      )}
      {rules.length >= 2 && (
        <p className="text-xs text-slate-500">
          Combine as regras com <b>E</b>/<b>OU</b> por linha e agrupe com parênteses <code>(</code> <code>)</code>.
          Sem parênteses, o <b>E</b> tem precedência sobre o <b>OU</b>.
        </p>
      )}

      {rules.map((rule, idx) => (
        <div
          key={idx}
          className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-2"
        >
          {/* Conector com a regra anterior — a 1ª regra não tem conector */}
          <div className="w-16 shrink-0">
            {idx === 0 ? (
              <div className="h-[34px]" aria-hidden />
            ) : (
              <Select
                aria-label="Conector"
                value={rule.connector ?? defaultConnector}
                onChange={(e) => update(idx, { connector: e.target.value as RuleConnector })}
                options={[
                  { value: 'and', label: 'E' },
                  { value: 'or', label: 'OU' },
                ]}
              />
            )}
          </div>
          {/* Abre grupo "(" */}
          <div className="w-14 shrink-0">
            <Select
              aria-label="Abrir grupo"
              value={rule.open ? '(' : ''}
              onChange={(e) => update(idx, { open: e.target.value === '(' })}
              options={[
                { value: '', label: '' },
                { value: '(', label: '(' },
              ]}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <FieldRefSelect
              value={rule.fieldRef}
              onChange={(v) => update(idx, { fieldRef: v })}
              fieldGroups={fieldGroups}
            />
          </div>
          <div className="w-[150px] shrink-0">
            <Select
              aria-label="Operador"
              className="w-full min-w-0"
              value={rule.operator}
              onChange={(e) => update(idx, { operator: e.target.value as ComparisonOperator })}
              options={OPERATOR_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <TextInput
              className="w-full min-w-0"
              value={rule.value}
              onChange={(e) => update(idx, { value: e.target.value })}
              placeholder="ex: 1000"
            />
          </div>
          {/* Fecha grupo ")" */}
          <div className="w-14 shrink-0">
            <Select
              aria-label="Fechar grupo"
              value={rule.close ? ')' : ''}
              onChange={(e) => update(idx, { close: e.target.value === ')' })}
              options={[
                { value: '', label: '' },
                { value: ')', label: ')' },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => removeAt(idx)}
            aria-label="Remover regra"
            className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <IconButton onClick={addRule} className="self-start">
        <Plus size={14} /> Adicionar regra
      </IconButton>
    </div>
  );
}

function FieldRefSelect({
  value,
  onChange,
  fieldGroups,
}: {
  value: string;
  onChange: (v: string) => void;
  fieldGroups: ReturnType<typeof selectFieldGroups>;
}) {
  // Quando não há formulário ainda, aceitamos texto livre como fallback.
  if (fieldGroups.length === 0) {
    return (
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="id do campo"
      />
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
    >
      <option value="">Selecione…</option>
      {fieldGroups.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label || f.id}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

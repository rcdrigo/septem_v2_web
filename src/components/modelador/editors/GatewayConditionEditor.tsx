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
        <FormRulesEditor rules={cond.rules} fieldGroups={fieldGroups} onChange={changeRules} />
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
  fieldGroups,
  onChange,
}: {
  rules: FormRule[];
  fieldGroups: ReturnType<typeof selectFieldGroups>;
  onChange: (next: FormRule[]) => void;
}) {
  function update(idx: number, patch: Partial<FormRule>) {
    onChange(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeAt(idx: number) {
    onChange(rules.filter((_, i) => i !== idx));
  }
  function addRule() {
    onChange([...rules, { fieldRef: '', operator: 'eq', value: '' }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {rules.length === 0 && (
        <p className="text-xs text-slate-500">Nenhuma regra. Adicione comparações com campos do formulário.</p>
      )}

      {rules.map((rule, idx) => (
        <div key={idx} className="grid grid-cols-[1.4fr_1fr_1.4fr_auto] items-end gap-2 rounded-md border border-slate-200 bg-white p-2">
          <Field label="Campo">
            <FieldRefSelect
              value={rule.fieldRef}
              onChange={(v) => update(idx, { fieldRef: v })}
              fieldGroups={fieldGroups}
            />
          </Field>
          <Field label="Operador">
            <Select
              value={rule.operator}
              onChange={(e) => update(idx, { operator: e.target.value as ComparisonOperator })}
              options={OPERATOR_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
          <Field label="Valor">
            <TextInput
              value={rule.value}
              onChange={(e) => update(idx, { value: e.target.value })}
              placeholder="ex: 1000"
            />
          </Field>
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
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
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

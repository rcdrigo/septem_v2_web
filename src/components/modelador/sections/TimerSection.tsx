import { Field, RadioGroup, Section, TextInput } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';

type Props = {
  modeler: any;
  element: any;
};

type TimerKind = 'untilDate' | 'untilDay' | 'forHours' | 'forDays';
type TimerMode = 'fixed' | 'dynamic';

type TimerConfig = {
  kind: TimerKind;
  mode: TimerMode;
  value: string;
  fieldRef: string;
};

const DEFAULTS: TimerConfig = { kind: 'untilDate', mode: 'fixed', value: '', fieldRef: '' };

const KIND_OPTIONS = [
  { value: 'untilDate', label: 'Aguardar até uma data específica' },
  { value: 'untilDay', label: 'Aguardar até um dia específico' },
  { value: 'forHours', label: 'Aguardar um número específico de horas' },
  { value: 'forDays', label: 'Aguardar um número específico de dias' },
] as const;

const MODE_OPTIONS = [
  { value: 'fixed', label: 'Fixa', hint: 'Valor digitado direto.' },
  { value: 'dynamic', label: 'Dinâmica', hint: 'Lê de um campo do formulário.' },
] as const;

/**
 * Configuração de timer, com os 4 tipos de temporização e o modo fixo/dinâmico.
 *
 * O campo `value` muda de máscara conforme o tipo (data DD/MM/AAAA, número de horas etc.).
 * Por ora aceitamos texto livre; máscaras entram no polimento (Fase 7).
 */
export function TimerSection({ modeler, element }: Props) {
  const { state, update, flush, commit } = useExtensionState(
    modeler,
    element,
    'septem:TimerConfig',
    DEFAULTS,
  );

  const valueLabel = labelForKind(state.kind);
  const valuePlaceholder = placeholderForKind(state.kind);

  return (
    <Section title="Configuração do temporizador">
      <Field label="Tipo de temporizador">
        <RadioGroup<TimerKind>
          name="timer-kind"
          value={state.kind}
          onChange={(v) => flush({ kind: v })}
          options={KIND_OPTIONS as any}
        />
      </Field>

      <Field label="Origem do valor">
        <RadioGroup<TimerMode>
          name="timer-mode"
          value={state.mode}
          onChange={(v) =>
            flush(v === 'fixed' ? { mode: 'fixed', fieldRef: '' } : { mode: 'dynamic', value: '' })
          }
          options={MODE_OPTIONS as any}
        />
      </Field>

      {state.mode === 'fixed' ? (
        <Field label={valueLabel}>
          <TextInput
            value={state.value}
            onChange={(e) => update({ value: e.target.value })}
            onBlur={() => commit('value')}
            placeholder={valuePlaceholder}
          />
        </Field>
      ) : (
        <Field label="Campo do formulário" hint="Vira combobox de campos na Fase 4.3.">
          <TextInput
            value={state.fieldRef}
            onChange={(e) => update({ fieldRef: e.target.value })}
            onBlur={() => commit('fieldRef')}
            placeholder="ex: data_prevista"
          />
        </Field>
      )}
    </Section>
  );
}

function labelForKind(kind: TimerKind): string {
  switch (kind) {
    case 'untilDate':
      return 'Data (DD/MM/AAAA)';
    case 'untilDay':
      return 'Dia do mês (1-31)';
    case 'forHours':
      return 'Quantidade de horas';
    case 'forDays':
      return 'Quantidade de dias';
  }
}

function placeholderForKind(kind: TimerKind): string {
  switch (kind) {
    case 'untilDate':
      return '01/01/2026';
    case 'untilDay':
      return '15';
    case 'forHours':
      return '48';
    case 'forDays':
      return '5';
  }
}

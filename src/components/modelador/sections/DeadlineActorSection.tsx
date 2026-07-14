import { Checkbox, Field, RadioGroup, Section, Select, TextInput, type SelectOption } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';
import { useAreas, useAreaPositions } from '@/lib/api/catalog';
import { DataSourceSelect } from '../fields/DataSourceSelect';
import { FormFieldSelect } from '../fields/FormFieldSelect';
import { DeadlineAlertsEditor } from '../editors/DeadlineAlertsEditor';

type Props = {
  modeler: any;
  element: any;
};

type ActorConfig = {
  actorType: 'requester' | 'areaPosition' | 'formField' | 'dataSource';
  areaId: string;
  positionId: string;
  fieldRef: string;
  dataSourceRef: string;
};

type DeadlineConfig = {
  respectWorkHours: boolean;
  sendReceiptMail: boolean;
  sendDeadlineMail: boolean;
  expiresIn: string;
  expiresInFieldRef: string;
};

const ACTOR_DEFAULTS: ActorConfig = {
  actorType: 'requester',
  areaId: '',
  positionId: '',
  fieldRef: '',
  dataSourceRef: '',
};

const DEADLINE_DEFAULTS: DeadlineConfig = {
  respectWorkHours: false,
  sendReceiptMail: false,
  sendDeadlineMail: false,
  expiresIn: '',
  expiresInFieldRef: '',
};

const ACTOR_OPTIONS = [
  { value: 'requester', label: 'Requisitante' },
  { value: 'areaPosition', label: 'Outro — unidade organizacional e posição' },
  { value: 'formField', label: 'Usuário selecionado em campo do formulário' },
  { value: 'dataSource', label: 'Utilizar fonte de dados' },
] as const;

/**
 * Seção "Responsáveis e prazos" — exclusiva de tarefa humana.
 * Define horário de expediente, e-mails de notificação, requisitante e demais responsáveis.
 *
 * O cronograma detalhado de alertas (único / repetido / após X dias / faltando X horas)
 * fica como placeholder até a Fase 4.2.
 */
export function DeadlineActorSection({ modeler, element }: Props) {
  const actor = useExtensionState(modeler, element, 'septem:ActorConfig', ACTOR_DEFAULTS);
  const deadline = useExtensionState(modeler, element, 'septem:DeadlineConfig', DEADLINE_DEFAULTS);

  // Catálogos remotos (B1.5): área = org_unit.key, posição = position.key — é o que
  // o backend resolve para FK no save. Posições dependem da área selecionada.
  const isAreaPosition = actor.state.actorType === 'areaPosition';
  const areas = useAreas();
  const positions = useAreaPositions(isAreaPosition && actor.state.areaId ? actor.state.areaId : null);

  // Mantém valores legados (refs digitados antes do catálogo) visíveis no select.
  const areaOptions = withFallback(
    (areas.data ?? []).map((a) => ({ value: a.key, label: a.name })),
    actor.state.areaId,
  );
  const positionOptions = withFallback(
    (positions.data ?? []).map((p) => ({ value: p.key, label: p.name })),
    actor.state.positionId,
  );

  return (
    <Section title="Responsáveis e prazos">
      <Checkbox
        checked={deadline.state.respectWorkHours}
        onChange={(v) => deadline.flush({ respectWorkHours: v })}
        label="Respeitar horas úteis"
      />
      <Checkbox
        checked={deadline.state.sendReceiptMail}
        onChange={(v) => deadline.flush({ sendReceiptMail: v })}
        label="Enviar mensagem de recebimento"
      />
      <Checkbox
        checked={deadline.state.sendDeadlineMail}
        onChange={(v) => deadline.flush({ sendDeadlineMail: v })}
        label="Enviar mensagem de prazo a expirar"
      />

      {deadline.state.sendDeadlineMail && (
        <div className="rounded-md bg-slate-100 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Cronograma de alertas
          </p>
          <DeadlineAlertsEditor modeler={modeler} element={element} />
        </div>
      )}

      <Field label="Responsável">
        <RadioGroup<ActorConfig['actorType']>
          name="actor-type"
          value={actor.state.actorType}
          onChange={(v) => actor.flush({ actorType: v })}
          options={ACTOR_OPTIONS as any}
        />
      </Field>

      {isAreaPosition && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Unidade organizacional">
            <Select
              value={actor.state.areaId}
              options={areaOptions}
              placeholder={areas.isLoading ? 'Carregando…' : 'Selecione a unidade'}
              disabled={areas.isLoading}
              onChange={(e) => actor.flush({ areaId: e.target.value, positionId: '' })}
            />
          </Field>
          <Field label="Posição">
            <Select
              value={actor.state.positionId}
              options={positionOptions}
              placeholder={
                !actor.state.areaId ? 'Escolha a área primeiro'
                : positions.isLoading ? 'Carregando…'
                : 'Selecione a posição'
              }
              disabled={!actor.state.areaId || positions.isLoading}
              onChange={(e) => actor.flush({ positionId: e.target.value })}
            />
          </Field>
        </div>
      )}

      {actor.state.actorType === 'formField' && (
        <Field label="Campo do formulário">
          <FormFieldSelect value={actor.state.fieldRef} onChange={(v) => actor.flush({ fieldRef: v })} />
        </Field>
      )}

      {actor.state.actorType === 'dataSource' && (
        <Field label="Fonte de dados">
          <DataSourceSelect value={actor.state.dataSourceRef} onChange={(v) => actor.flush({ dataSourceRef: v })} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
        <Field label="Prazo (horas)">
          <TextInput
            type="number"
            min={0}
            step="0.5"
            value={deadline.state.expiresIn}
            onChange={(e) => deadline.update({ expiresIn: e.target.value })}
            onBlur={() => deadline.commit('expiresIn')}
            placeholder="ex: 48"
          />
        </Field>
        <Field label="…ou campo do formulário">
          <FormFieldSelect value={deadline.state.expiresInFieldRef} onChange={(v) => deadline.flush({ expiresInFieldRef: v })} placeholder="Campo (nº de dias)" />
        </Field>
      </div>
    </Section>
  );
}

/** Garante que um valor já gravado (ref legado/fora do catálogo) continue selecionável. */
function withFallback(options: SelectOption[], value: string): SelectOption[] {
  if (value && !options.some((o) => o.value === value))
    return [{ value, label: value }, ...options];
  return options;
}

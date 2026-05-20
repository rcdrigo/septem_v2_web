import { Checkbox, Field, RadioGroup, Section, TextInput } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';
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
  { value: 'areaPosition', label: 'Outro — área e posição' },
  { value: 'formField', label: 'Usuário selecionado em campo do formulário' },
  { value: 'dataSource', label: 'Utilizar fonte de dados' },
] as const;

/**
 * Seção "Responsáveis e prazos" — exclusiva de tarefa humana.
 * Espelha o bloco `ConfigTaskGeneral` (`inpStBusinessHour`, mails, `inpStRequester` etc.).
 *
 * O cronograma detalhado de alertas (único / repetido / após X dias / faltando X horas)
 * fica como placeholder até a Fase 4.2.
 */
export function DeadlineActorSection({ modeler, element }: Props) {
  const actor = useExtensionState(modeler, element, 'septem:ActorConfig', ACTOR_DEFAULTS);
  const deadline = useExtensionState(modeler, element, 'septem:DeadlineConfig', DEADLINE_DEFAULTS);

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

      {actor.state.actorType === 'areaPosition' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Área">
            <TextInput
              value={actor.state.areaId}
              onChange={(e) => actor.update({ areaId: e.target.value })}
              onBlur={() => actor.commit('areaId')}
              placeholder="ID da área"
            />
          </Field>
          <Field label="Posição">
            <TextInput
              value={actor.state.positionId}
              onChange={(e) => actor.update({ positionId: e.target.value })}
              onBlur={() => actor.commit('positionId')}
              placeholder="ID da posição"
            />
          </Field>
        </div>
      )}

      {actor.state.actorType === 'formField' && (
        <Field label="Campo do formulário" hint="Vira combobox de campos na Fase 4.3.">
          <TextInput
            value={actor.state.fieldRef}
            onChange={(e) => actor.update({ fieldRef: e.target.value })}
            onBlur={() => actor.commit('fieldRef')}
            placeholder="ex: usuario_responsavel"
          />
        </Field>
      )}

      {actor.state.actorType === 'dataSource' && (
        <Field label="Fonte de dados">
          <TextInput
            value={actor.state.dataSourceRef}
            onChange={(e) => actor.update({ dataSourceRef: e.target.value })}
            onBlur={() => actor.commit('dataSourceRef')}
            placeholder="Identificador da fonte de dados"
          />
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
          <TextInput
            value={deadline.state.expiresInFieldRef}
            onChange={(e) => deadline.update({ expiresInFieldRef: e.target.value })}
            onBlur={() => deadline.commit('expiresInFieldRef')}
            placeholder="ex: prazo_dias"
          />
        </Field>
      </div>
    </Section>
  );
}

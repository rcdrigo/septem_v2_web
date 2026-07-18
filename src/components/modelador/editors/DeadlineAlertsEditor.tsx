import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field, RadioGroup, Select, TextInput } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { uid } from '@/lib/uid';
import {
  getDeadlineAlerts,
  setDeadlineAlerts,
  type AlertKind,
  type AlertTrigger,
  type DeadlineAlert,
} from '@/lib/bpmn-deadline-alerts';

type Props = {
  modeler: any;
  element: any;
};

const KIND_OPTIONS: ReadonlyArray<{ value: AlertKind; label: string; help?: string }> = [
  { value: 'once', label: 'Único', help: 'Dispara uma única vez.' },
  { value: 'recurring', label: 'Repetido', help: 'Repete em um intervalo.' },
];

const TRIGGER_OPTIONS: ReadonlyArray<{ value: AlertTrigger; label: string }> = [
  { value: 'afterHours', label: 'depois de N horas (desde o início)' },
  { value: 'afterDays', label: 'depois de N dias (desde o início)' },
  { value: 'beforeHours', label: 'faltando N horas (para o prazo)' },
  { value: 'beforeDays', label: 'faltando N dias (para o prazo)' },
];

/**
 * Editor inline do cronograma de alertas de prazo. Substitui o placeholder
 * exibido em `DeadlineActorSection` quando "Enviar mensagem de prazo a expirar"
 * está ligado. A spec descreve "abrir um novo menu para configuração de como
 * os alertas devem ser disparados (único, de forma repetida, depois de x dias,
 * depois de x horas, faltando x dias, faltando x horas, etc)".
 *
 * Persistência: `septem:DeadlineAlerts > septem:DeadlineAlert[]` na tarefa.
 */
export function DeadlineAlertsEditor({ modeler, element }: Props) {
  const [alerts, setAlerts] = useState<DeadlineAlert[]>([]);

  useEffect(() => {
    setAlerts(getDeadlineAlerts(element));
  }, [element]);

  function persist(next: DeadlineAlert[]) {
    setAlerts(next);
    setDeadlineAlerts(modeler, element, next);
  }

  function update(idx: number, patch: Partial<DeadlineAlert>) {
    persist(alerts.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function removeAt(idx: number) {
    persist(alerts.filter((_, i) => i !== idx));
  }

  function addNew() {
    persist([
      ...alerts,
      {
        id: uid('alert'),
        kind: 'once',
        trigger: 'beforeHours',
        value: 24,
      },
    ]);
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white p-3">
        <p className="mb-2 text-xs text-slate-500">
          Nenhum alerta configurado. Adicione um disparo único ou repetido.
        </p>
        <IconButton onClick={addNew} variant="primary">
          <Plus size={14} /> Adicionar alerta
        </IconButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert, idx) => (
        <AlertRow
          key={alert.id}
          alert={alert}
          index={idx}
          onChange={(patch) => update(idx, patch)}
          onRemove={() => removeAt(idx)}
        />
      ))}
      <IconButton onClick={addNew} className="self-start">
        <Plus size={14} /> Adicionar alerta
      </IconButton>
    </div>
  );
}

function AlertRow({
  alert,
  index,
  onChange,
  onRemove,
}: {
  alert: DeadlineAlert;
  index: number;
  onChange: (patch: Partial<DeadlineAlert>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <header className="-mx-3 -mt-3 mb-3 flex items-center justify-between border-b border-slate-200 px-3 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Alerta #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover alerta"
          className="rounded p-1 text-rose-600 hover:bg-rose-50"
        >
          <Trash2 size={14} />
        </button>
      </header>

      <div className="flex flex-col gap-3">
        <Field label="Tipo">
          <RadioGroup<AlertKind>
            name={`alert-kind-${alert.id}`}
            value={alert.kind}
            onChange={(v) => onChange({ kind: v })}
            options={KIND_OPTIONS as any}
            direction="horizontal"
          />
        </Field>

        <Field label="Disparo">
          <Select
            value={alert.trigger}
            onChange={(e) => onChange({ trigger: e.target.value as AlertTrigger })}
            options={TRIGGER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Quantidade (N)" help="Valor usado para calcular o momento do disparo. Exemplo: 24.">
            <TextInput
              type="number"
              min={0}
              value={String(alert.value)}
              onChange={(e) => onChange({ value: parseNumber(e.target.value) })}
            />
          </Field>

          {alert.kind === 'recurring' && (
            <Field label="Intervalo (horas)" help="Intervalo entre alertas repetidos, em horas. Exemplo: 12.">
              <TextInput
                type="number"
                min={1}
                value={String(alert.intervalHours ?? '')}
                onChange={(e) => onChange({ intervalHours: parseNumber(e.target.value) })}
              />
            </Field>
          )}
        </div>
      </div>
    </div>
  );
}

function parseNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

import { getExtensionCollection, setExtensionCollection, type CollectionSchema } from './bpmn-arrays';

export type AlertKind = 'once' | 'recurring';
export type AlertTrigger = 'afterDays' | 'afterHours' | 'beforeDays' | 'beforeHours';

export type DeadlineAlert = {
  id: string;
  kind: AlertKind;
  trigger: AlertTrigger;
  /** Número associado ao trigger: dias ou horas. */
  value: number;
  /** Intervalo (em horas) entre disparos. Só usado quando `kind === 'recurring'`. */
  intervalHours?: number;
};

const SCHEMA: CollectionSchema = {
  containerType: 'septem:DeadlineAlerts',
  itemsProp: 'alerts',
  itemType: 'septem:DeadlineAlert',
};

export function getDeadlineAlerts(element: any): DeadlineAlert[] {
  return getExtensionCollection(element, SCHEMA, (raw) => ({
    id: raw.id ?? '',
    kind: (raw.kind as AlertKind) ?? 'once',
    trigger: (raw.trigger as AlertTrigger) ?? 'beforeHours',
    value: Number.isFinite(raw.value) ? Number(raw.value) : 0,
    intervalHours: Number.isFinite(raw.intervalHours) ? Number(raw.intervalHours) : undefined,
  }));
}

export function setDeadlineAlerts(modeler: any, element: any, alerts: DeadlineAlert[]) {
  // limpa intervalHours se kind=once para manter o XML enxuto
  const normalized = alerts.map((a) => (a.kind === 'once' ? { ...a, intervalHours: undefined } : a));
  setExtensionCollection(modeler, element, SCHEMA, normalized);
}

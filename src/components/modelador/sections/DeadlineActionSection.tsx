import { Field, RadioGroup, Select } from '@/components/ui/Field';
import { useAreas, useAreaPositions } from '@/lib/api/catalog';
import { useExtensionState } from '@/lib/useExtensionState';
import { attachedTimers, DEADLINE_DEFAULTS, deadlineErrors } from '@/lib/bpmn-deadline';
import type { PanelProps } from '../panels/types';

export function DeadlineActionSection({ modeler, element }: PanelProps) {
  const { state, flush } = useExtensionState(modeler, element, 'septem:DeadlineConfig', DEADLINE_DEFAULTS);
  const timers = attachedTimers(modeler.get('elementRegistry').getAll(), element.id);
  const areas = useAreas();
  const positions = useAreaPositions(state.overdueAction === 'reassign' && state.overdueAreaId ? state.overdueAreaId : null);
  const errors = deadlineErrors(element, timers);
  const timerOptions = timers.map((timer) => ({ value: timer.id, label: timer.businessObject.name || timer.id }));
  if (state.overdueTimerRef && !timers.some((timer) => timer.id === state.overdueTimerRef)) {
    timerOptions.unshift({ value: state.overdueTimerRef, label: `${state.overdueTimerRef} (não encontrado)` });
  }

  return <div className="flex min-w-0 flex-col gap-3 border-t border-slate-200 pt-3">
    <Field label="Ação no vencimento">
      <Select aria-label="Ação no vencimento" value={state.overdueAction} options={[
        { value: 'record', label: 'Apenas registrar o atraso' },
        { value: 'timer', label: 'Seguir o caminho de um timer' },
        { value: 'notify', label: 'Notificar responsável ou supervisor' },
        { value: 'reassign', label: 'Reatribuir a tarefa' },
      ]} onChange={(event) => {
        const action = event.target.value;
        if (action === 'record' || action === 'timer' || action === 'notify' || action === 'reassign') flush({ overdueAction: action });
      }} />
    </Field>

    {state.overdueAction === 'timer' && <>
      <Field label="Timer no vencimento">
        <Select aria-label="Timer no vencimento" value={state.overdueTimerRef} placeholder="Selecione o timer anexado" options={timerOptions} onChange={(event) => flush({ overdueTimerRef: event.target.value })} />
      </Field>
      {timers.length === 0 && <p className="text-xs leading-relaxed text-slate-600">Anexe um evento de timer à borda desta tarefa e conecte sua saída ao caminho de vencimento.</p>}
      {timers.some((timer) => timer.id === state.overdueTimerRef) && <button type="button" className="self-start text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => modeler.get('selection').select(modeler.get('elementRegistry').get(state.overdueTimerRef))}>Configurar timer selecionado</button>}
    </>}

    {state.overdueAction === 'notify' && <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-xs font-medium text-slate-600">Quem notificar</legend>
      <RadioGroup name={`overdue-notify-${element.id}`} value={state.overdueNotifyTarget} onChange={(overdueNotifyTarget) => flush({ overdueNotifyTarget })} options={[
        { value: 'assignee', label: 'Responsável pela tarefa' },
        { value: 'supervisor', label: 'Supervisor do responsável' },
      ]} />
    </fieldset>}

    {state.overdueAction === 'reassign' && <>
      <Field label="Unidade no vencimento">
        <Select aria-label="Unidade no vencimento" value={state.overdueAreaId} placeholder={areas.isLoading ? 'Carregando…' : 'Selecione a unidade'} disabled={areas.isLoading} options={withFallback((areas.data ?? []).map((area) => ({ value: area.key, label: area.name })), state.overdueAreaId)} onChange={(event) => flush({ overdueAreaId: event.target.value, overduePositionId: '' })} />
      </Field>
      <Field label="Posição no vencimento">
        <Select aria-label="Posição no vencimento" value={state.overduePositionId} placeholder={positions.isLoading ? 'Carregando…' : 'Selecione a posição'} disabled={!state.overdueAreaId || positions.isLoading} options={withFallback((positions.data ?? []).map((position) => ({ value: position.key, label: position.name })), state.overduePositionId)} onChange={(event) => flush({ overduePositionId: event.target.value })} />
      </Field>
    </>}
    {errors.length > 0 && <div role="status" className="space-y-1 text-xs leading-relaxed text-amber-800">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    <p className="text-xs leading-relaxed text-slate-600">A configuração de vencimento é salva no processo. O disparo automático dessas ações ainda não está disponível.</p>
  </div>;
}

function withFallback(options: { value: string; label: string }[], value: string) {
  return value && !options.some((option) => option.value === value) ? [{ value, label: `${value} (fora do catálogo)` }, ...options] : options;
}

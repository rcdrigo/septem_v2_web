import { RadioGroup, Section, Switch } from '@/components/ui/Field';
import { getExtensionConfig } from '@/lib/bpmn-helpers';
import { BOUNDARY_TIMER_DEFAULTS, DEADLINE_DEFAULTS, deadlineSummary } from '@/lib/bpmn-deadline';
import { useExtensionState } from '@/lib/useExtensionState';
import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import { TimerSection } from '../sections/TimerSection';
import type { PanelProps } from './types';

export function BoundaryTimerPanel({ modeler, element }: PanelProps) {
  const { state, flush } = useExtensionState(modeler, element, 'septem:BoundaryTimerConfig', BOUNDARY_TIMER_DEFAULTS);
  const task = modeler.get('elementRegistry').get(element.businessObject.attachedToRef?.id);
  const deadline = getExtensionConfig(task, 'septem:DeadlineConfig', DEADLINE_DEFAULTS);
  const linked = deadline.overdueAction === 'timer' && deadline.overdueTimerRef === element.id;

  return <>
    <GeneralInfoSection modeler={modeler} element={element} />
    <Section title="Timer anexado" description={task ? `Tarefa: ${task.businessObject.name || task.id}` : 'Anexe este timer a uma tarefa.'}>
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-xs font-medium text-slate-600">Quando disparar</legend>
        <RadioGroup name={`boundary-source-${element.id}`} value={state.deadlineSource} onChange={(deadlineSource) => flush({ deadlineSource })} options={[
          { value: 'task', label: 'No vencimento da tarefa' },
          { value: 'custom', label: 'Usar prazo próprio' },
        ]} />
      </fieldset>
      {state.deadlineSource === 'task' && <div className="space-y-2 text-xs leading-relaxed text-slate-600">
        <p>{deadlineSummary(deadline)}</p>
        <p>{linked ? 'Este timer está selecionado na ação de vencimento da tarefa.' : 'Na tarefa, escolha “Seguir o caminho de um timer” e selecione este evento.'}</p>
      </div>}
      <Switch checked={element.businessObject.cancelActivity !== false} label="Interromper a tarefa ao disparar" onChange={(cancelActivity) => modeler.get('modeling').updateProperties(element, { cancelActivity })} />
      <p className="text-xs leading-relaxed text-slate-600">{element.businessObject.cancelActivity !== false ? 'Ao disparar, encerra a tarefa pendente e segue somente a saída do timer.' : 'Ao disparar, abre um caminho paralelo e mantém a tarefa disponível para conclusão.'}</p>
      {task && <button type="button" className="self-start text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => modeler.get('selection').select(task)}>Configurar prazo e ação da tarefa</button>}
      <p className="text-xs leading-relaxed text-slate-600">Conecte a saída do timer à próxima etapa. O disparo automático de timers anexados ainda não está disponível.</p>
    </Section>
    {state.deadlineSource === 'custom' && <TimerSection modeler={modeler} element={element} />}
  </>;
}

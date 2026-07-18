import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Field, Section, TextArea, TextInput } from '@/components/ui/Field';
import { Combobox } from '@/components/ui/Combobox';
import {
  getAlias,
  getDocumentation,
  getName,
  getProcessLanes,
  getSetor,
  setAlias,
  setDocumentation,
  setName,
  setSetor,
} from '@/lib/bpmn-helpers';

type Props = {
  modeler: any;
  element: any;
};

/**
 * Seção "Informações gerais" — reutilizada por praticamente todos os tipos
 * de elemento (Início, Tarefa humana, Serviço, Subprocesso, Eventos, Marco, Gateways).
 *
 * Estratégia de save: aplica no blur do input (ou no Enter) — o auto-save
 * global do BpmnModeler propaga para localStorage + Zustand.
 */
export function GeneralInfoSection({ modeler, element }: Props) {
  const [name, setNameLocal] = useState('');
  const [description, setDescriptionLocal] = useState('');
  const [alias, setAliasLocal] = useState('');
  const [setor, setSetorLocal] = useState('');
  // "Tick" para forçar a releitura das raias sem recarregar a página — o usuário pode
  // criar uma raia nova no canvas e este componente não re-renderiza sozinho.
  const [lanesTick, setLanesTick] = useState(0);

  // Setor (raia) para tarefas humanas e atividade de início.
  const elementType = element?.businessObject?.$type;
  const isTask = elementType === 'bpmn:UserTask' || elementType === 'bpmn:StartEvent';
  const lanes = useMemo(
    () => (isTask ? getProcessLanes(modeler) : []),
    [isTask, modeler, element, lanesTick],
  );

  // Sincroniza estado local quando o elemento selecionado muda
  useEffect(() => {
    setNameLocal(getName(element));
    setDescriptionLocal(getDocumentation(element));
    setAliasLocal(getAlias(element));
    setSetorLocal(getSetor(element));
  }, [element]);

  function commitName() {
    if (name !== getName(element)) setName(modeler, element, name);
  }
  function commitDescription() {
    if (description !== getDocumentation(element)) setDocumentation(modeler, element, description);
  }
  function commitAlias() {
    if (alias !== getAlias(element)) setAlias(modeler, element, alias);
  }
  function commitSetor(v: string) {
    setSetorLocal(v);
    if (v !== getSetor(element)) setSetor(modeler, element, v);
  }

  return (
    <Section title="Informações gerais">
      {/* Ordem pedida (Fase 5b): Sigla → Nome → Setor. */}
      <Field label="Sigla" help="Identificador curto usado em integrações e relatórios. Exemplo: aprovacao_gerente.">
        <TextInput
          value={alias}
          onChange={(e) => setAliasLocal(e.target.value)}
          onBlur={commitAlias}
        />
      </Field>
      <Field label="Nome" help="Nome exibido para identificar o elemento no processo.">
        <TextInput
          value={name}
          onChange={(e) => setNameLocal(e.target.value)}
          onBlur={commitName}
        />
      </Field>
      {isTask && (
        <Field label="Setor" help="Raia do processo responsável por esta tarefa.">
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <Combobox
                value={setor}
                options={lanes.map((l) => ({ value: l, label: l }))}
                onChange={commitSetor}
                placeholder={lanes.length ? 'Selecione o setor…' : 'Nenhuma raia no processo ainda'}
                clearLabel="— sem setor —"
              />
            </div>
            <button
              type="button"
              onClick={() => setLanesTick((t) => t + 1)}
              title="Atualizar a lista de raias do processo"
              aria-label="Atualizar raias"
              className="shrink-0 rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </Field>
      )}
      <Field label="Descrição" help="Descrição opcional do elemento.">
        <TextArea
          value={description}
          onChange={(e) => setDescriptionLocal(e.target.value)}
          onBlur={commitDescription}
        />
      </Field>
    </Section>
  );
}

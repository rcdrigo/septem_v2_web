import { useEffect, useState } from 'react';
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

  // Setor (raia) só para tarefas humanas; o dropdown lista as raias do processo.
  const isTask = element?.businessObject?.$type === 'bpmn:UserTask';
  const lanes = isTask ? getProcessLanes(modeler) : [];

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
      <Field label="Sigla" hint="Identificador curto usado em integrações e relatórios">
        <TextInput
          value={alias}
          onChange={(e) => setAliasLocal(e.target.value)}
          onBlur={commitAlias}
          placeholder="ex: aprovacao_gerente"
        />
      </Field>
      <Field label="Nome">
        <TextInput
          value={name}
          onChange={(e) => setNameLocal(e.target.value)}
          onBlur={commitName}
          placeholder="Nome do elemento"
        />
      </Field>
      {isTask && (
        <Field label="Setor" hint="Raia do processo responsável por esta tarefa.">
          <Combobox
            value={setor}
            options={lanes.map((l) => ({ value: l, label: l }))}
            onChange={commitSetor}
            placeholder={lanes.length ? 'Selecione o setor…' : 'Nenhuma raia no processo ainda'}
            clearLabel="— sem setor —"
          />
        </Field>
      )}
      <Field label="Descrição">
        <TextArea
          value={description}
          onChange={(e) => setDescriptionLocal(e.target.value)}
          onBlur={commitDescription}
          placeholder="Descrição opcional"
        />
      </Field>
    </Section>
  );
}

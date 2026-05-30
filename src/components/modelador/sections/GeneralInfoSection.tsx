import { useEffect, useState } from 'react';
import { Field, Section, TextArea, TextInput } from '@/components/ui/Field';
import {
  getAlias,
  getDocumentation,
  getName,
  setAlias,
  setDocumentation,
  setName,
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

  // Sincroniza estado local quando o elemento selecionado muda
  useEffect(() => {
    setNameLocal(getName(element));
    setDescriptionLocal(getDocumentation(element));
    setAliasLocal(getAlias(element));
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

  return (
    <Section title="Informações gerais">
      <Field label="Nome">
        <TextInput
          value={name}
          onChange={(e) => setNameLocal(e.target.value)}
          onBlur={commitName}
          placeholder="Nome do elemento"
        />
      </Field>
      <Field label="Descrição">
        <TextArea
          value={description}
          onChange={(e) => setDescriptionLocal(e.target.value)}
          onBlur={commitDescription}
          placeholder="Descrição opcional"
        />
      </Field>
      <Field label="Apelido" hint="Identificador curto usado em integrações e relatórios">
        <TextInput
          value={alias}
          onChange={(e) => setAliasLocal(e.target.value)}
          onBlur={commitAlias}
          placeholder="ex: aprovacao_gerente"
        />
      </Field>
    </Section>
  );
}

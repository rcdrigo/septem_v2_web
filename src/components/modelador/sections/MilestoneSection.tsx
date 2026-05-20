import { useEffect, useMemo, useState } from 'react';
import { Field, Section, Select, TextInput } from '@/components/ui/Field';
import { useExtensionState } from '@/lib/useExtensionState';
import { getExtensionConfig } from '@/lib/bpmn-helpers';

type Props = {
  modeler: any;
  element: any;
};

type MilestoneAction = 'open' | 'openClose' | 'close';

type MilestoneConfig = {
  action: MilestoneAction;
  name: string;
};

const DEFAULTS: MilestoneConfig = { action: 'open', name: '' };

const ACTION_OPTIONS = [
  { value: 'open', label: 'Abrir' },
  { value: 'openClose', label: 'Abrir e fechar' },
  { value: 'close', label: 'Fechar' },
];

const OTHER = '__OTHER__';

/**
 * Configuração de marco. Espelha `ConfigEventMilestone.aspx` (ação + nome).
 *
 * "Nome" deve ser um combobox listando marcos já usados no processo
 * (com a opção "Outro" abrindo input para um novo). Para descobrir os marcos
 * percorremos o registry buscando eventos com `septem:MilestoneConfig`.
 */
export function MilestoneSection({ modeler, element }: Props) {
  const { state, flush, update, commit } = useExtensionState(
    modeler,
    element,
    'septem:MilestoneConfig',
    DEFAULTS,
  );

  const knownNames = useKnownMilestoneNames(modeler, element);
  const isCustom = state.name !== '' && !knownNames.includes(state.name);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    setShowCustom(isCustom);
  }, [isCustom]);

  const selectValue = showCustom ? OTHER : state.name;

  return (
    <Section title="Configuração do marco">
      <Field label="Ação">
        <Select
          value={state.action}
          onChange={(e) => flush({ action: e.target.value as MilestoneAction })}
          options={ACTION_OPTIONS}
        />
      </Field>

      <Field label="Nome do marco">
        <Select
          value={selectValue}
          placeholder="Selecione…"
          options={[
            ...knownNames.map((n) => ({ value: n, label: n })),
            { value: OTHER, label: 'Outro…' },
          ]}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER) {
              setShowCustom(true);
              flush({ name: '' });
            } else {
              setShowCustom(false);
              flush({ name: v });
            }
          }}
        />
      </Field>

      {showCustom && (
        <Field label="Novo nome">
          <TextInput
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
            onBlur={() => commit('name')}
            placeholder="ex: Recebido pelo protocolo"
          />
        </Field>
      )}
    </Section>
  );
}

function useKnownMilestoneNames(modeler: any, currentElement: any): string[] {
  return useMemo(() => {
    if (!modeler) return [];
    const registry: any = modeler.get('elementRegistry');
    const names = new Set<string>();
    registry.forEach((el: any) => {
      if (el === currentElement) return;
      const cfg = getExtensionConfig(el, 'septem:MilestoneConfig', { name: '', action: 'open' });
      if (cfg.name) names.add(cfg.name);
    });
    return Array.from(names).sort();
  }, [modeler, currentElement]);
}

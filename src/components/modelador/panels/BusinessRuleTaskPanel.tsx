import { useEffect, useRef, useState } from 'react';
import { Field, RadioGroup, Section, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Combobox } from '@/components/ui/Combobox';
import { useExtensionState } from '@/lib/useExtensionState';
import { BUSINESS_RULE_DEFAULTS, BUSINESS_RULE_OPERATIONS, businessRuleErrors } from '@/lib/bpmn-business-rule';
import { useFormStore } from '@/stores/form';
import { DataSourceSelect } from '../fields/DataSourceSelect';
import { FormFieldSelect } from '../fields/FormFieldSelect';
import { GeneralInfoSection } from '../sections/GeneralInfoSection';
import type { PanelProps } from './types';

function displayValue(json: string): string {
  try {
    const value: unknown = JSON.parse(json);
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map((item: unknown) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'url' in item && typeof item.url === 'string') return item.url;
      return JSON.stringify(item);
    }).join('\n');
    return value === null ? '' : JSON.stringify(value);
  } catch {
    return json;
  }
}

function FixedValueInput({ kind, valueJson, onChange }: { kind: 'number' | 'list' | 'files' | 'text' | 'textarea'; valueJson: string; onChange: (json: string) => void }) {
  const [draft, setDraft] = useState(() => displayValue(valueJson));
  const written = useRef(valueJson);
  useEffect(() => {
    if (valueJson !== written.current) setDraft(displayValue(valueJson));
    written.current = valueJson;
  }, [valueJson]);

  function change(value: string) {
    setDraft(value);
    let json: string;
    if (kind === 'number') json = value.trim() !== '' && Number.isFinite(Number(value)) ? JSON.stringify(Number(value)) : '';
    else if (kind === 'list' || kind === 'files') {
      const entries = value.split('\n').map((item) => item.trim()).filter(Boolean);
      const values = kind === 'files' ? entries.map((url) => ({ name: url.split(/[?#]/)[0].split('/').pop() || 'Arquivo', url, size: 0 })) : entries;
      json = JSON.stringify(values);
    } else json = JSON.stringify(value);
    written.current = json;
    onChange(json);
  }

  return kind === 'list' || kind === 'files' || kind === 'textarea'
    ? <TextArea aria-label="Valor fixo" value={draft} onChange={(event) => change(event.target.value)} />
    : <TextInput aria-label="Valor fixo" inputMode={kind === 'number' ? 'decimal' : undefined} value={draft} onChange={(event) => change(event.target.value)} />;
}

export function BusinessRuleTaskPanel({ modeler, element }: PanelProps) {
  const { state, flush } = useExtensionState(modeler, element, 'septem:BusinessRule', BUSINESS_RULE_DEFAULTS);
  const fields = useFormStore((store) => store.fields);
  const field = fields.find((candidate) => candidate.id === state.fieldRef || candidate.path === state.fieldRef);
  const fileValue = field?.type === 'filepicker';
  const listValue = field?.type === 'checklist' || field?.type === 'taglist';
  const numericValue = field?.type === 'number';
  const fieldOptions = fields.filter((candidate) => !candidate.tableKey).map((candidate) => ({ value: candidate.id, label: `${candidate.label || candidate.id} (${candidate.path || candidate.id})` }));
  if (state.fieldRef && !fieldOptions.some((option) => option.value === state.fieldRef)) fieldOptions.unshift({ value: state.fieldRef, label: state.fieldRef });
  const errors = businessRuleErrors(state);

  function changeOperation(operation: string) {
    flush({ ...BUSINESS_RULE_DEFAULTS, operation, target: operation === 'setStatus' ? 'field' : 'current' });
  }

  return <>
    <GeneralInfoSection modeler={modeler} element={element} />
    <Section title="Informações da tarefa de regra de negócio">
      <Field label="Tipo de operação">
        <Select aria-label="Tipo de operação" value={state.operation} placeholder="Selecione a operação" options={[...BUSINESS_RULE_OPERATIONS]} onChange={(event) => changeOperation(event.target.value)} />
      </Field>

      {state.operation && state.operation !== 'setField' && <>
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600">Requisições afetadas</legend>
          <RadioGroup name={`business-rule-target-${element.id}`} value={state.target} onChange={(target) => flush({ target, instanceFieldRef: '', dataSourceRef: '' })} options={[
            ...(state.operation !== 'setStatus' ? [{ value: 'current', label: 'Própria requisição' }] : []),
            { value: 'field', label: 'Outras requisições, por campo do formulário' },
            { value: 'dataSource', label: 'Outras requisições, por fonte de dados' },
          ]} />
        </fieldset>
        {state.target === 'field' && <Field label="Campo com os números das requisições" hint="O campo da requisição atual pode conter um número ou uma lista de números.">
          <FormFieldSelect value={state.instanceFieldRef} onChange={(instanceFieldRef) => flush({ instanceFieldRef })} />
        </Field>}
        {state.target === 'dataSource' && <Field label="Fonte dos números das requisições" hint="A primeira coluna deve retornar o número exibido da requisição, um por linha, no mesmo ambiente.">
          <DataSourceSelect value={state.dataSourceRef} onChange={(dataSourceRef) => flush({ dataSourceRef })} />
        </Field>}
      </>}

      {state.operation === 'setStatus' && <Field label="Novo status" hint="Texto livre para requisições já encerradas. A alteração não reabre o processo.">
        <TextInput aria-label="Novo status" value={state.statusText} maxLength={240} onChange={(event) => flush({ statusText: event.target.value })} placeholder="Ex.: Deferido" />
      </Field>}

      {state.operation === 'setField' && <>
        <p className="text-xs leading-relaxed text-slate-600">Altera somente o formulário da própria requisição, com um valor fixo.</p>
        <Field label="Campo a alterar" hint="Campos de agrupamentos padrão. Colunas de tabela não fazem parte desta operação.">
          <Combobox value={state.fieldRef} options={fieldOptions} onChange={(fieldRef) => flush({ fieldRef, valueJson: '' })} placeholder="Selecione o campo do formulário" clearLabel="Nenhum campo" />
        </Field>
        {state.fieldRef && <Field label="Valor fixo" hint={fileValue ? 'Informe o endereço de cada arquivo, um por linha.' : listValue ? 'Informe um valor por linha.' : numericValue ? 'Informe um número.' : undefined}>
          {field?.type === 'checkbox' ? <Select aria-label="Valor fixo" value={state.valueJson} placeholder="Selecione o valor" options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]} onChange={(event) => flush({ valueJson: event.target.value })} />
            : <FixedValueInput key={`${element.id}:${state.fieldRef}`} kind={numericValue ? 'number' : fileValue ? 'files' : listValue ? 'list' : field?.type === 'textarea' ? 'textarea' : 'text'} valueJson={state.valueJson} onChange={(valueJson) => flush({ valueJson })} />}
        </Field>}
      </>}

      {(state.operation === 'freeze' || state.operation === 'unfreeze') && <p className="text-xs leading-relaxed text-slate-600">{state.operation === 'freeze' ? 'Suspende tarefas, prazos, alertas e automações. As tarefas ficam ocultas e seu acesso é bloqueado até o descongelamento.' : 'Retoma as tarefas e automações do ponto em que pararam, preservando o tempo restante dos prazos.'}</p>}
      {errors.length > 0 && <div role="status" className="space-y-1 text-xs text-amber-800">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    </Section>
  </>;
}

import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { BpmnModdle } from 'bpmn-moddle';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'business-rule-fields-'));
try {
  await build({ entryPoints: ['src/lib/bpmn-business-rule.ts', 'src/lib/form-schema.ts', 'src/lib/bpmn-helpers.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, tsconfig: 'tsconfig.app.json' });
  const { businessRuleFieldOptions, resolveBusinessRuleField, BUSINESS_RULE_DEFAULTS } = await import(pathToFileURL(join(dir, 'bpmn-business-rule.mjs')));
  const { extractFields } = await import(pathToFileURL(join(dir, 'form-schema.mjs')));
  const { setExtensionConfig, getExtensionConfig } = await import(pathToFileURL(join(dir, 'bpmn-helpers.mjs')));
  const schema = { format: 'septem-native', schemaVersion: 1, id: 'form', tabs: [{ id: 'tab', label: 'Dados', groups: [{ id: 'group', label: 'Geral', type: 'group', fields: [
    { id: 'nome-campo', kind: 'field', type: 'textfield', key: 'nome', label: 'Nome' },
    { id: 'nome', kind: 'field', type: 'textfield', key: 'motivo', label: 'Motivo' },
  ] }, { id: 'table', label: 'Itens', type: 'table', key: 'itens', fields: [
    { id: 'coluna', kind: 'field', type: 'textfield', key: 'descricao', label: 'Descrição' },
  ] }] }] };
  const fields = extractFields(schema);
  const options = businessRuleFieldOptions(fields);
  assert.deepEqual(options, [
    { value: 'field:nome-campo', label: 'Dados › Geral › Nome (nome)' },
    { value: 'field:nome', label: 'Dados › Geral › Motivo (motivo)' },
  ]);
  assert.equal(resolveBusinessRuleField(fields, 'nome').fieldId, 'nome-campo', 'Uma referência antiga por chave mantém o campo escolhido');
  assert.equal(resolveBusinessRuleField(fields, 'field:nome').fieldId, 'nome', 'O identificador explícito nunca é interpretado como chave');
  assert.ok(options.every(option => resolveBusinessRuleField(fields, option.value)?.tableKey === undefined));
  assert.ok(!options.some(option => option.value.includes('coluna')));
  assert.equal(resolveBusinessRuleField(fields, 'field:removido'), undefined);
  assert.ok(!options.some(option => option.value === 'field:removido'), 'Campos ausentes não são oferecidos como opções');

  const moddle = new BpmnModdle({ septem: JSON.parse(await readFile('src/components/bpmn/septem-moddle.json', 'utf8')) });
  const process = moddle.create('bpmn:Process', { id: 'Process_1' });
  const task = moddle.create('bpmn:BusinessRuleTask', { id: 'Rule_1' });
  process.flowElements = [task]; task.$parent = process;
  const element = { businessObject: task };
  const modeler = { get: key => ({ moddle, modeling: { updateProperties: (el, props) => Object.assign(el.businessObject, props) } })[key] };
  for (const option of options) {
    setExtensionConfig(modeler, element, 'septem:BusinessRule', { operation: 'setField', target: 'current', fieldRef: option.value, valueJson: '"indeferido"' });
    const definitions = moddle.create('bpmn:Definitions', { targetNamespace: 'http://septem.test', rootElements: [process] }); process.$parent = definitions;
    const { xml } = await moddle.toXML(definitions);
    const { rootElement } = await moddle.fromXML(xml);
    const config = getExtensionConfig({ businessObject: rootElement.rootElements[0].flowElements[0] }, 'septem:BusinessRule', BUSINESS_RULE_DEFAULTS);
    assert.equal(config.fieldRef, option.value);
    assert.equal(resolveBusinessRuleField(fields, config.fieldRef).fieldId, option.value.slice('field:'.length));
  }
  schema.tabs[0].groups[0].fields[0].key = 'nome_atualizado';
  assert.equal(resolveBusinessRuleField(extractFields(schema), options[0].value).id, 'nome_atualizado', 'Renomear a chave não rompe a configuração');
  console.log('PASS: campos reais do formulário, chaves/IDs coincidentes, caminho completo, exclusão de tabelas, XML e renomeação.');
} finally {
  await rm(dir, { recursive: true, force: true });
}

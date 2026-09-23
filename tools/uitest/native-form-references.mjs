import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'native-refs-'));
try {
  await build({ stdin: {contents: "export * from './src/lib/native-form-references';export * from './src/lib/form-automation/validation';", resolveDir:resolve('.')},bundle:true,platform:'node',format:'esm',outfile:join(dir,'test.mjs') });
  const { nativeReferences, invalidNativeReferences, automationReferences } = await import(pathToFileURL(join(dir,'test.mjs')));
  const definition = JSON.parse(await readFile('tools/uitest/fixtures/native-form-v1.json','utf8'));
  const field = definition.tabs[0].groups[0].fields.find(f=>f.kind==='field');
  const rule = {$type:'septem:FormRule',fieldRef:field.key};
  const modeler = {get:()=>({getAll:()=>[{businessObject:{id:'Flow_1',name:'Decisão',extensionElements:{values:[{$type:'septem:GatewayCondition',rules:[rule]}]}}}]})};
  const refs = nativeReferences(modeler,definition);
  assert.equal(refs.length,1);assert.equal(invalidNativeReferences(definition,refs).length,0);
  field.key='alterada';assert.equal(invalidNativeReferences(definition,refs).length,1);
  rule.fieldRef='alterada';assert.equal(invalidNativeReferences(definition,nativeReferences(modeler,definition)).length,0);
  // Repeated registry entries and duplicate extension entries produce one warning per owner/use.
  const duplicate = {$type:'septem:FormFieldEntry', fieldRef:'missing'};
  const bo = {id:'StartEvent_1',name:'Início',extensionElements:{values:[{$type:'septem:FormFields',entries:[duplicate,{...duplicate}]}]}};
  const repeated = {get:()=>({getAll:()=>[{businessObject:bo},{businessObject:bo}]})};
  assert.equal(invalidNativeReferences(definition,nativeReferences(repeated,definition)).length,1);
  bo.extensionElements.values[0].entries.push({$type:'septem:FormRule',fieldRef:'missing'});
  assert.equal(invalidNativeReferences(definition,nativeReferences(repeated,definition)).length,2,'different uses stay distinct');
  assert.deepEqual(automationReferences("if(form.has('optional')) form.set('optional',1);form.cell('itens',0,'produto');form.get(variable); // form.get('comment')"),['optional','itens','produto']);
  console.log('PASSOU: usos, referências inválidas/corrigidas e análise de chamadas literais sem interpretar comentários.');
} finally {await rm(dir,{recursive:true,force:true});}
const runtimeDir = await mkdtemp(join(tmpdir(), 'native-state-'));
try {
  await build({entryPoints:['src/lib/native-form-runtime.ts'],bundle:true,platform:'node',format:'esm',outfile:join(runtimeDir,'runtime.mjs')});
  const {nativeRuntimeComponents,nativeSubmissionState} = await import(pathToFileURL(join(runtimeDir,'runtime.mjs')));
  const definition=JSON.parse(await readFile('tools/uitest/fixtures/native-form-v1.json','utf8'));
  const table=definition.tabs.flatMap(t=>t.groups).find(g=>g.type==='table');
  const field=table.fields[0];
  const rows=[{}, {[field.key]:'A'}, {[field.key]:'B'}];
  const state=nativeSubmissionState(definition,nativeRuntimeComponents(definition),{[table.key]:rows},{[`${table.key}.1.${field.key}`]:{disabled:true},[`${table.key}.2.${field.key}`]:{required:true}});
  assert.equal(state[`${table.key}.0.${field.key}`].disabled,true,'realinha estado após descarte de linha vazia');
  assert.equal(state[`${table.key}.1.${field.key}`].required,true);
  const components=nativeRuntimeComponents(definition);components[0].automationHidden=true;
  const first=definition.tabs[0].groups[0].fields.find(f=>f.kind==='field');
  assert.equal(nativeSubmissionState(definition,components,{}, {[first.key]:{hidden:false}})[first.key].hidden,true,'campo não reexibe aba oculta');
  console.log('PASSOU: estado transitório remapeia células após descarte e conserva ocultação herdada.');
} finally {await rm(runtimeDir,{recursive:true,force:true});}

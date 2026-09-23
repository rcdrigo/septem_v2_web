import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { BpmnModdle } from 'bpmn-moddle';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'task-field-identity-'));
try {
  await build({entryPoints:['src/lib/bpmn-process.ts','src/lib/bpmn-form-fields.ts'],outdir:dir,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
  const { setEmbeddedNativeForm } = await import(pathToFileURL(join(dir,'bpmn-process.mjs')));
  const { getFormFieldEntries, setFormFieldEntries } = await import(pathToFileURL(join(dir,'bpmn-form-fields.mjs')));
  const moddle = new BpmnModdle({septem:JSON.parse(await readFile('src/components/bpmn/septem-moddle.json','utf8'))});
  const schema = JSON.parse(await readFile('tools/uitest/fixtures/native-form-v1.json','utf8'));
  const process=moddle.create('bpmn:Process',{id:'Process_1'});
  const task=moddle.create('bpmn:UserTask',{id:'Task_1'});
  process.flowElements=[task]; task.$parent=process;
  const root={businessObject:process}, element={businessObject:task};
  const modeler={get:k=>({moddle,canvas:{getRootElement:()=>root},elementRegistry:{getAll:()=>[root,element]},modeling:{updateProperties:(el,props)=>Object.assign(el.businessObject,props)}}[k])};
  setEmbeddedNativeForm(modeler,schema);
  // Existing key-only task configuration gains an ID before its field is renamed.
  setFormFieldEntries(modeler,element,[{fieldRef:'nome',visibility:'hidden',dataSourceRef:'source-1'},{fieldRef:'produto',visibility:'editable'}]);
  schema.tabs[0].groups[0].fields[0].key='novo_nome';
  schema.tabs[1].groups.find(g=>g.type==='table').fields[0].key='novo_produto';
  setEmbeddedNativeForm(modeler,schema);
  assert.deepEqual(getFormFieldEntries(element),[
    {fieldRef:'novo_nome',fieldId:'field-name',visibility:'hidden',dataSourceRef:'source-1'},
    {fieldRef:'novo_produto',fieldId:'column-product',visibility:'editable',dataSourceRef:undefined},
  ]);
  const definitions=moddle.create('bpmn:Definitions',{targetNamespace:'http://septem.test',rootElements:[process]});process.$parent=definitions;
  const {xml}=await moddle.toXML(definitions);
  const {rootElement}=await moddle.fromXML(xml);
  assert.deepEqual(getFormFieldEntries({businessObject:rootElement.rootElements[0].flowElements[0]}),getFormFieldEntries(element),'XML preserves stable field IDs and execution keys');
  // Reusing the old key on another field must not steal visibility/source settings.
  schema.tabs[0].groups[0].fields[0].key='nome';
  schema.tabs[0].groups[0].fields[0].id='replacement-field';
  setEmbeddedNativeForm(modeler,schema);
  assert.equal(getFormFieldEntries(element)[0].fieldId,'field-name');
  assert.equal(getFormFieldEntries(element)[0].fieldRef,'novo_nome');
  console.log('PASSOU: migração por ID, renomeação de campos/colunas, fonte preservada e round-trip XML real.');
} finally { await rm(dir,{recursive:true,force:true}); }

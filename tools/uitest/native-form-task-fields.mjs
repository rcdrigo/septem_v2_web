import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'native-task-fields-'));
const fixture = JSON.parse(await readFile(join(root, 'tools/uitest/fixtures/native-form-v1.json'), 'utf8'));
let browser;
try {
  await build({ stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {TarefasCamposView} from './src/components/modelador/views/TarefasCamposView';
import {extractFields} from './src/lib/form-schema';
import {selectFieldGroups,useFormStore} from './src/stores/form';
import {useModeladorStore} from './src/stores/modelador';
import {getFormFieldEntries} from './src/lib/bpmn-form-fields';
const events={};const emit=e=>(events[e]??[]).slice().forEach(fn=>fn());
const process={businessObject:{}};
const task={businessObject:{$type:'bpmn:UserTask',id:'Task_1',name:'Analisar'}};
const modeler={get:k=>({
 canvas:{getRootElement:()=>process},
 eventBus:{on:(e,fn)=>{(events[e]??=[]).push(fn)},off:(e,fn)=>{events[e]=(events[e]??[]).filter(f=>f!==fn)}},
 elementRegistry:{forEach:fn=>fn(task)},
 moddle:{create:(type,props)=>({$type:type,...props})},
 modeling:{updateProperties:(el,props)=>{Object.assign(el.businessObject,props);emit('commandStack.changed');}}
}[k])};
window.extract=extractFields;window.groups=selectFieldGroups;
window.fields=()=>useFormStore.getState().fields;
window.entries=()=>getFormFieldEntries(task);
window.load=schema=>{emit('import.parse.start');process.businessObject.extensionElements={values:schema?[{$type:'septem:FormSchema',json:JSON.stringify(schema)}]:[]};emit('import.done');};
const app=createRoot(document.getElementById('root'));
window.mount=schema=>{
 // Simulate an unsaved editor draft on opening the matrix.
 useModeladorStore.getState().setFlushForm(async()=>{window.load(schema);});
 app.render(<TarefasCamposView modeler={modeler}/>);
};
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'test.js'), format: 'iife', platform: 'browser', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' } });
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ path: join(dir, 'test.js') });
  const fields = await page.evaluate(s => window.extract(s), fixture);
  assert.deepEqual(fields.map(f => f.id), ['nome', 'observacao', 'produto', 'quantidade', 'ativo']);
  assert.equal(fields[2].fieldId, 'column-product');
  assert.equal(fields[2].path, 'itens[].produto');
  assert.equal(fields[2].tableKey, 'itens');
  const groups = await page.evaluate(f => window.groups(f), fields);
  assert.equal(groups.length, 3);
  assert.notEqual(groups[0].id, groups[1].id, 'grupos homônimos têm identidades distintas');
  const renamed = structuredClone(fixture);
  renamed.tabs[0].groups[0].label = 'Novo nome';
  renamed.tabs[0].groups[0].fields[0].key = 'nome_atualizado';
  const nextGroups = await page.evaluate(s => window.groups(window.extract(s)), renamed);
  assert.equal(nextGroups[0].id, groups[0].id, 'renomear preserva identidade');
  const sameNames = structuredClone(fixture);
  sameNames.tabs[1].label = sameNames.tabs[0].label;
  assert.equal((await page.evaluate(s => window.groups(window.extract(s)), sameNames)).length, 3);
  assert.deepEqual(await page.evaluate(() => window.extract({components:[{type:'group',label:'Antigo',components:[{key:'legado',type:'textfield',label:'Campo'}]}]})), [{id:'legado',label:'Campo',type:'textfield',group:'Antigo'}]);
  await page.evaluate(s => window.mount(s), fixture);
  await page.getByRole('rowheader', { name: 'Produto' }).waitFor();
  assert.equal(await page.getByText('Principal / Dados', {exact:true}).count(), 1);
  assert.equal(await page.getByText('Complemento / Dados', {exact:true}).count(), 1);
  assert.equal(await page.getByText('Complemento / Itens (Tabela)', {exact:true}).count(), 1);
  const groupRow = page.getByRole('row').filter({has:page.getByText('Principal / Dados',{exact:true})});
  await groupRow.getByRole('button',{name:'Oculto — todos',exact:true}).click();
  assert.deepEqual(await page.evaluate(() => window.entries()), [{fieldRef:'nome',fieldId:fixture.tabs[0].groups[0].fields[0].id,visibility:'hidden',dataSourceRef:undefined}], 'ação em grupo não afeta homônimo');
  await page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Produto'})}).getByRole('button',{name:'Editável',exact:true}).click();
  assert.equal((await page.evaluate(() => window.entries())).find(e=>e.fieldRef==='produto').visibility,'editable');
  await page.evaluate(s => window.load(s), renamed);
  await page.getByText('Principal / Novo nome',{exact:true}).waitFor();
  const renamedRow=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:/^Nome/})});
  assert.equal(await renamedRow.getByRole('button',{name:'Oculto',exact:true}).getAttribute('aria-pressed'),'true','renomear chave mantém visibilidade pelo ID');
  await renamedRow.getByRole('button',{name:'Editável',exact:true}).click();
  const updated=await page.evaluate(()=>window.entries());
  assert.equal(updated.filter(e=>e.fieldId==='field-name').length,1);
  assert.equal(updated.find(e=>e.fieldId==='field-name').fieldRef,'nome_atualizado');
  await page.evaluate(() => window.load(null));
  await page.getByText(/Sem campos no formulário/).waitFor();
  assert.deepEqual(await page.evaluate(() => window.fields()), []);
  await page.evaluate(() => window.load({format:'septem-native',schemaVersion:1,id:'invalid',tabs:[]}));
  assert.deepEqual(await page.evaluate(() => window.fields()), []);
  assert.deepEqual(errors, []);
  console.log('PASSOU: descoberta nativa, identidade/contexto, grupos homônimos, matriz por ID, flush do rascunho e limpeza ao trocar processo. BPMN simulado; sem API.');
} finally { await browser?.close(); await rm(dir, {recursive:true,force:true}); }

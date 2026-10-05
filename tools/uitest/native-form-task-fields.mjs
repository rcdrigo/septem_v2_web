import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'native-task-fields-'));
const outDir = process.env.OUT_DIR ?? join(tmpdir(), 'septem-task-fields-review');
const fixture = JSON.parse(await readFile(join(root, 'tools/uitest/fixtures/native-form-v1.json'), 'utf8'));
let browser;
try {
  await build({ stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {TarefasCamposView} from './src/components/modelador/views/TarefasCamposView';
import {GeneralInfoSection} from './src/components/modelador/sections/GeneralInfoSection';
import {getAlias} from './src/lib/bpmn-helpers';
import {extractFields} from './src/lib/form-schema';
import {selectFieldGroups,useFormStore} from './src/stores/form';
import {useModeladorStore} from './src/stores/modelador';
import {getFormFieldEntries} from './src/lib/bpmn-form-fields';
const events={};const emit=e=>(events[e]??[]).slice().forEach(fn=>fn());
const process={businessObject:{}};
const task={businessObject:{$type:'bpmn:UserTask',id:'Task_1',name:'Analisar'}};
let elements=[task];
const modeler={get:k=>({
 canvas:{getRootElement:()=>process},
 eventBus:{on:(e,fn)=>{(events[e]??=[]).push(fn)},off:(e,fn)=>{events[e]=(events[e]??[]).filter(f=>f!==fn)}},
 elementRegistry:{forEach:fn=>elements.forEach(fn)},
 moddle:{create:(type,props)=>({$type:type,...props})},
 modeling:{updateProperties:(el,props)=>{Object.assign(el.businessObject,props);emit('commandStack.changed');}}
}[k])};
window.extract=extractFields;window.groups=selectFieldGroups;
window.fields=()=>useFormStore.getState().fields;
window.entries=()=>getFormFieldEntries(task);
window.setTasks=definitions=>{
 elements=definitions.map(d=>({businessObject:{$type:d.type??'bpmn:UserTask',id:d.id,name:d.name,extensionElements:{values:[{$type:'septem:Alias',value:d.sequential??''}]}}}));
 elements.push({type:'label',labelTarget:elements[0],businessObject:elements[0].businessObject});
 emit('elements.changed');
};
window.updateTask=(id,props)=>modeler.get('modeling').updateProperties(elements.find(el=>el.businessObject.id===id),props);
window.taskEntries=id=>getFormFieldEntries(elements.find(el=>el.businessObject.id===id));
window.alias=()=>getAlias(task);
window.load=schema=>{emit('import.parse.start');process.businessObject.extensionElements={values:schema?[{$type:'septem:FormSchema',json:JSON.stringify(schema)}]:[]};emit('import.done');};
const app=createRoot(document.getElementById('root'));
window.showGeneral=()=>app.render(<div className="w-full max-w-sm p-4"><GeneralInfoSection modeler={modeler} element={task}/></div>);
window.mount=schema=>{
 // Simulate an unsaved editor draft on opening the matrix.
 useModeladorStore.getState().setFlushForm(async()=>{window.load(schema);});
 app.render(<TarefasCamposView modeler={modeler}/>);
};
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'test.js'), format: 'iife', platform: 'browser', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' } });
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<div id="root" style="height:100vh;display:flex;flex-direction:column"></div>');
    for (const file of await readdir(join(root, 'dist/assets'))) if (file.endsWith('.css')) await page.addStyleTag({ content: await readFile(join(root, 'dist/assets', file), 'utf8') });
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
    await page.evaluate(() => window.setTasks([
      {id:'Task_A',name:'Zelar',sequential:'015'},
      {id:'Start_Z',name:'Protocolar',sequential:'010',type:'bpmn:StartEvent'},
      {id:'Task_Z',name:'Análise documental',sequential:'005'},
      {id:'Task_B',name:'Validar',sequential:'005'},
      {id:'Task_C',name:'Concluir',sequential:'T03'},
      {id:'Task_D',name:'Revisar',sequential:'T01'},
      {id:'Task_E',name:'Decidir',sequential:'T02'},
      {id:'Task_F',name:'Sem sequencial'},
      {id:'Task_G',sequential:'020'},
    ]));
    const labels=page.locator('thead th > div > span:first-child');
    const expected=['Sem sequencial','005 — Análise documental','005 — Validar','010 — Protocolar','015 — Zelar','020 — Task_G','T01 — Revisar','T02 — Decidir','T03 — Concluir'];
    await page.waitForFunction(()=>document.querySelectorAll('thead th').length===10);
    assert.deepEqual(await labels.allTextContents(), expected, 'ordena sequencial e nome, sem priorizar tipo/ID nem duplicar labels');
    await mkdir(outDir,{recursive:true});
    for(const viewport of [{width:1280,height:900},{width:375,height:812}]) {
      await page.setViewportSize(viewport);
      assert.deepEqual(await labels.allTextContents(), expected);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'matriz mantém rolagem dentro do painel');
      const row=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Produto'})});
      await row.locator('td').nth(1).getByRole('button',{name:'Editável',exact:true}).click();
      assert.equal((await page.evaluate(()=>window.taskEntries('Task_Z'))).find(e=>e.fieldRef==='produto').visibility,'editable','coluna ordenada grava na tarefa correta');
      assert.deepEqual(await page.evaluate(()=>window.taskEntries('Task_B')),[],'não altera a tarefa vizinha');
      await page.waitForFunction(()=>document.querySelectorAll('tbody tr')[5].querySelectorAll('td')[1].querySelector('[aria-label="Editável"]').getAttribute('aria-pressed')==='true');
      await page.locator('table').evaluate(table=>{table.parentElement.scrollLeft=0;});
      await page.mouse.move(0,0);
      await page.screenshot({path:join(outDir,`matrix-${viewport.width}.png`)});
    }
    await page.evaluate(()=>window.updateTask('Task_A',{name:'Aprovar',extensionElements:{values:[{$type:'septem:Alias',value:'001'}]}}));
    await page.waitForFunction(()=>document.querySelector('thead th:nth-child(3)').textContent.includes('001 — Aprovar'));
    assert.equal((await labels.allTextContents())[1],'001 — Aprovar','atualiza ordem após edição');
  await page.evaluate(() => window.load(null));
  await page.getByText(/Sem campos no formulário/).waitFor();
    assert.deepEqual(await page.evaluate(() => window.fields()), []);
    await page.evaluate(()=>window.showGeneral());
    const sequential=page.getByLabel('Sequencial',{exact:true});
    await sequential.fill('010');
    await sequential.blur();
    assert.equal(await page.evaluate(()=>window.alias()),'010','Sequencial preserva a gravação no atributo BPMN existente');
    for(const viewport of [{width:1280,height:900},{width:375,height:812}]) {
      await page.setViewportSize(viewport);
      await page.getByRole('button',{name:'Ajuda: Sequencial',exact:true}).focus();
      const tooltip=page.getByRole('tooltip');
      await tooltip.waitFor({state:'visible'});
      assert.match(await tooltip.innerText(),/sequência lógica.*005, 010, 015 ou T01, T02, T03/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:join(outDir,`sequential-${viewport.width}.png`)});
      await page.keyboard.press('Escape');
    }
  await page.evaluate(() => window.load({format:'septem-native',schemaVersion:1,id:'invalid',tabs:[]}));
  assert.deepEqual(await page.evaluate(() => window.fields()), []);
  assert.deepEqual(errors, []);
    console.log('PASSOU: descoberta nativa, identidade/contexto, grupos homônimos, matriz por ID, ordenação e atualização por sequencial/nome, ajuda e edição do sequencial em desktop/mobile, flush do rascunho e limpeza ao trocar processo. BPMN simulado; sem API. Capturas: '+outDir);
} finally { await browser?.close(); await rm(dir, {recursive:true,force:true}); }

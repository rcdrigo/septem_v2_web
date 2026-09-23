import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'), dir = await mkdtemp(join(tmpdir(), 'native-runtime-'));
await build({ stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {ReactForm} from './src/components/form/ReactForm';
const root=createRoot(document.getElementById('root')),ref=React.createRef(),client=new QueryClient({defaultOptions:{queries:{retry:false}}});let id=0;
window.mount=(schema,data={},readOnly=false,scripts=[])=>flushSync(()=>root.render(<QueryClientProvider client={client}><ReactForm key={++id} ref={ref} schema={schema} data={data} readOnly={readOnly} automationScripts={scripts}/></QueryClientProvider>));
window.submit=()=>ref.current.submit();window.data=()=>ref.current.getData();window.serverErrors=errors=>ref.current.setServerErrors(errors);
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'bundle.js'), format: 'iife', platform: 'browser', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' } });
const field=(key,type='textfield',config={})=>({id:`f-${key}`,kind:'field',key,label:key,type,config});
const group=(id,fields,config={})=>({id:id.replaceAll(' ','-'),label:id,type:'group',fields,config});
const table=(fields,config={})=>({id:'table',label:'Participantes',type:'table',key:'pessoas',fields,config});
const tab=(id,groups,config={})=>({id:id.normalize('NFD').replace(/[\u0300-\u036f]/g,''),label:id,groups,config});
const schema=(tabs)=>({format:'septem-native',schemaVersion:1,id:'form',tabs});
const required={validate:{required:true}};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  await page.route('http://localhost/**',route=>route.fulfill({contentType:route.request().url().includes('/api/')?'application/json':'text/html',body:route.request().url().includes('/api/')?'{"options":[{"value":"a","label":"Fonte A"}]}':'<html><body><main id="root" style="padding:16px;max-width:1100px;margin:auto"></main></body></html>'}));
  await page.goto('http://localhost');
  for(const file of await readdir(join(root,'dist/assets')))if(file.endsWith('.css'))await page.addStyleTag({content:await readFile(join(root,'dist/assets',file),'utf8')});
  await page.addScriptTag({path:join(dir,'bundle.js')});
  const mount=async(s,d={},readOnly=false,scripts=[])=>{await page.evaluate(([s,d,ro,scripts])=>window.mount(s,d,ro,scripts),[s,d,readOnly,scripts]);await page.waitForTimeout(40);};
  const submit=()=>page.evaluate(()=>window.submit());const data=()=>page.evaluate(()=>window.data());
  await mount(schema([tab('Grid',[group('Campos',[field('primeiro','textfield',{layout:{columns:8}}),field('segundo','textfield',{layout:{columns:8}}),field('terceiro')])])]));
  const boxes=await page.locator('[data-form-id="f-primeiro"], [data-form-id="f-segundo"], [data-form-id="f-terceiro"]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,bottom:r.bottom};}));
  if(width>640) { assert.equal(boxes[0].y,boxes[1].y,'campos 8+8 devem ocupar a mesma linha'); assert.ok(boxes[1].x>boxes[0].x); }
  else assert.ok(boxes[1].y>boxes[0].y,'campos empilham no celular');
  const blankHelp=await page.getByRole('textbox',{name:'primeiro',exact:true}).evaluate(n=>n.parentElement.lastElementChild===n);
  assert.equal(blankHelp,true,'campo sem ajuda não reserva uma linha vazia');
  const fixture=schema([tab('Cadastro',[group('Dados pessoais',[field('nome','textfield',required)])],{icon:'Mail'}),tab('Documentos',[table([field('cpf','textfield',{...required,properties:{septemDocKind:'cpf'}}),field('quantidade','number',{validate:{min:0}})])])]);
  await mount(fixture,{pessoas:[{},{},{}]});
  assert.equal(await page.getByRole('tab').count(),2);
  assert.equal(await page.getByRole('tab',{name:/Cadastro/}).locator('svg').count(),1);
  await page.getByRole('tab',{name:'Documentos, 3 pendências'}).click();
  await page.getByRole('textbox',{name:'cpf',exact:true}).first().fill('52998224725');
  await page.getByRole('tab',{name:'Documentos, 2 pendências'}).waitFor();
  let result=await submit();assert.equal(Object.keys(result.errors).length,3);
  await page.getByRole('tab',{name:/Cadastro/,selected:true}).waitFor();
  await page.getByRole('textbox',{name:'nome',exact:true}).fill('Ana');
  await page.getByRole('tab',{name:/Documentos/}).click();
  for(const input of await page.getByRole('textbox',{name:'cpf',exact:true}).all())await input.fill('52998224725');
  await page.getByRole('spinbutton',{name:'quantidade',exact:true}).first().fill('-1');
  await page.getByRole('tab',{name:'Documentos, 1 pendências, com erros'}).waitFor();
  await page.getByRole('spinbutton',{name:'quantidade',exact:true}).first().fill('0');
  assert.deepEqual((await submit()).errors,{});await page.getByRole('tab',{name:'Documentos, 0 pendências'}).waitFor();
  await mkdir(join(root,'.impeccable/review'),{recursive:true});await page.screenshot({path:join(root,`.impeccable/review/native-e4-${width===390?'mobile':'desktop'}.png`),fullPage:true});
  await page.getByRole('button',{name:'Remover linha 2',exact:true}).click();assert.equal((await data()).pessoas.length,2);
  await page.getByRole('button',{name:'Remover linha 1',exact:true}).click();
  await page.getByRole('button',{name:'Limpar valores da última linha'}).click();assert.equal(await page.locator('[data-native-row]').count(),1);
  assert.equal((await submit()).errors['pessoas.0.cpf'],'Campo obrigatório.');
  await mount(schema([tab('Única',[group('Dados',[field('nome')]),table([field('valor','number'),field('ativo','checkbox')])])]));
  assert.equal(await page.getByRole('tablist').count(),0);assert.equal(await page.locator('[data-native-row]').count(),1);assert.deepEqual((await submit()).data,{pessoas:[]});
  const addRow=page.getByRole('button',{name:'Adicionar linha',exact:true});
  assert.equal(await addRow.evaluate(n=>n.closest('footer')!==null),true);
  const removeRow=page.getByRole('button',{name:'Limpar valores da última linha'});
  assert.equal(await removeRow.innerText(),'');
  assert.equal(await removeRow.evaluate(n=>getComputedStyle(n.closest('td')).verticalAlign),'bottom');
  await addRow.click();assert.equal(await page.locator('[data-native-row]').count(),2);await page.getByRole('button',{name:'Remover linha 2',exact:true}).click();
  await page.getByRole('spinbutton',{name:'valor',exact:true}).fill('0');assert.deepEqual((await submit()).data,{pessoas:[{valor:0}]});
  await page.getByRole('checkbox',{name:'ativo',exact:true}).check();await page.getByRole('checkbox',{name:'ativo',exact:true}).uncheck();
  await page.getByRole('spinbutton',{name:'valor',exact:true}).fill('');assert.equal((await submit()).data.pessoas[0].ativo,false);
  const saved=await data();await mount(schema([tab('Única',[table([field('valor','number'),field('ativo','checkbox')])])]),saved);assert.equal(await page.locator('[data-native-row]').count(),1);
  // Effective per-cell hidden/disabled state comes from existing field events.
  const control=field('controle','textfield',{properties:{septemEvents:JSON.stringify([{type:'change',action:"if(value==='ocultar')hide('cpf');else if(value==='bloquear')setDisabled('cpf',true);else {show('cpf');setDisabled('cpf',false);}"}])}});
  await mount(schema([tab('Tabela',[table([control,field('cpf','textfield',required)])]),tab('Outro',[group('Grupo',[field('outro')])])]),{pessoas:[{},{},{}]});
  await page.getByRole('textbox',{name:'controle',exact:true}).nth(0).fill('ocultar');await page.getByRole('textbox',{name:'controle',exact:true}).nth(1).fill('bloquear');
  await page.getByRole('tab',{name:'Tabela, 1 pendências'}).waitFor();assert.deepEqual(Object.keys((await submit()).errors),['pessoas.2.cpf']);
  await page.getByRole('textbox',{name:'cpf',exact:true}).fill('preservado');
  await page.getByRole('textbox',{name:'controle',exact:true}).nth(2).fill('ocultar');assert.equal((await data()).pessoas[2].cpf,'preservado');
  await page.getByRole('textbox',{name:'controle',exact:true}).nth(2).fill('mostrar');assert.equal(await page.getByRole('textbox',{name:'cpf',exact:true}).inputValue(),'preservado');
  // Dynamic disappearance of the active tab falls back to remaining content.
  const self=field('sumir','textfield',{properties:{septemEvents:JSON.stringify([{type:'change',action:"hide('sumir')"}])}});
  await mount(schema([tab('Primeira',[group('G1',[field('nome')])]),tab('Segunda',[group('G2',[self])])]));
  await page.getByRole('tab',{name:/Segunda/}).click();await page.getByRole('textbox',{name:'sumir',exact:true}).fill('mantido');
  assert.equal(await page.getByRole('tablist').count(),0);assert.equal(await page.getByRole('textbox',{name:'nome',exact:true}).count(),1);assert.equal((await data()).sumir,'mantido');
  await mount(schema([tab('Vazia',[group('Sem campos',[])]),tab('Oculta',[group('Oculto',[field('nome')])],{visible:false})]));
  assert.equal(await page.getByRole('tablist').count(),0);await page.getByRole('status').waitFor();
  await mount(schema([tab('Datas',[group('G-data',[field('data','datetime',{subtype:'date'})])]),tab('Outra',[group('G-outra',[field('observacao')])])]));
  await page.locator('[data-date-picker-input]').fill('12');await page.getByRole('tab',{name:'Datas, 1 pendências'}).waitFor();
  await page.getByRole('tab',{name:/Outra/}).click();assert.equal((await submit()).errors.data,'Preencha a data e a hora completas.');
  await page.getByRole('tab',{name:/Datas/,selected:true}).waitFor();assert.equal(await page.locator('[data-date-picker-input]').inputValue(),'12');
  await page.locator('[data-date-picker-input]').fill('20092026');assert.deepEqual((await submit()).errors,{});
  await mount(fixture,{},true);assert.deepEqual((await submit()).errors,{});
  const source=field('escolha','select',{properties:{septemDataSourceId:'id-fonte'}});
  await mount(schema([tab('Fonte',[table([source])])]));await page.getByRole('combobox',{name:'escolha',exact:true}).selectOption('a');assert.equal((await submit()).data.pessoas[0].escolha,'a');
  await mount(fixture,{nome:'Ana',pessoas:[{cpf:'123'}]},false,[{taskId:'common',code:"form.beforeSubmit(()=>{form.hide('cpf');form.setRequired('nome',false);})"}]);
  assert.deepEqual((await submit()).errors,{});assert.equal((await data()).pessoas[0].cpf,'123');
  // E6: adaptive scripts work against two definitions; runtime-only fields never persist.
  const adaptive = [{taskId:'',code:`
    if (form.has('nome')) { form.setDisabled('nome', false); form.set('nome', 'Editável'); }
    form.add({id:'ephemeral',key:'sobrenome',label:'Sobrenome',type:'textfield'}, 'Dados');
    form.set('sobrenome','Temporário');
    form.set('pessoas',[{cpf:'A'},{cpf:'B'}]);
    form.cell('pessoas',0,'cpf').setDisabled(false);
    form.cell('pessoas',1,'cpf').setDisabled(true);
  `}];
  for (const includeName of [true,false]) {
    const definition=schema([tab('Cadastro',[group('Dados',includeName?[field('nome','textfield',{disabled:true})]:[]),table([field('cpf','textfield',{disabled:true})])])]);
    await mount(definition,{},false,adaptive);
    assert.deepEqual((await submit()).errors,{});
    const cells=page.locator('[data-native-table] input');
    assert.equal(await cells.nth(0).isEnabled(),true);assert.equal(await cells.count(),1);
    assert.match(await page.locator('[data-native-row="1"] [data-form-key="pessoas.1.cpf"]').innerText(),/B/);
    await cells.nth(0).fill('Alterado');
    const persisted=(await submit()).data;
    assert.equal('sobrenome' in persisted,false);assert.deepEqual(persisted.pessoas,[{cpf:'Alterado'},{cpf:'B'}]);
    if(includeName)assert.equal(persisted.nome,'Editável');
    await mount(definition,persisted);
    assert.deepEqual((await data()).pessoas,persisted.pessoas);
  }
  // State set during beforeSubmit must affect this same submission, including false overrides.
  await mount(fixture,{nome:'Ana',pessoas:[{},{}]},false,[{taskId:'',code:`
    form.cell('pessoas',0,'cpf').setRequired(false);
    form.beforeSubmit(()=>{form.cell('pessoas',1,'cpf').hide();});
  `}]);
  assert.deepEqual((await submit()).errors,{});
  await page.getByRole('tab',{name:'Documentos, 0 pendências'}).waitFor();
  await mount(fixture,{nome:'Ana',pessoas:[{cpf:'preservado'}]},false,[{taskId:'',code:`
    form.beforeSubmit(()=>{form.cell('pessoas',0,'cpf').hide();});
  `}]);
  assert.equal((await submit()).data.pessoas[0].cpf,'preservado');
  assert.deepEqual(errors,[]);await page.close();console.log(`PASSOU: CA10–CA14, fontes, células, navegação e persistência serializada (${width}px).`);
 }
} finally {await browser.close();await rm(dir,{recursive:true,force:true});}

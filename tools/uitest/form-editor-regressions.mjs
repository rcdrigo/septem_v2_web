import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'septem-editor-regressions-')),root=resolve(import.meta.dirname,'../..');
await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {MemoryRouter} from 'react-router-dom';import {FormularioView} from './src/components/modelador/views/FormularioView';import {useModeladorStore} from './src/stores/modelador';
import {FormEditor} from '@bpmn-io/form-js';
const originalImport=FormEditor.prototype.importSchema;FormEditor.prototype.importSchema=function(...args){window.formEditor=this;return originalImport.apply(this,args);};
window.selectField=id=>window.formEditor.get('selection').set(window.formEditor.get('formFieldRegistry').get(id));
const events={};const bo={};const shape={businessObject:bo};
const modeler={get:(key)=>({canvas:{getRootElement:()=>shape},eventBus:{on:(e,fn)=>{(events[e]??=[]).push(fn)},off:(e,fn)=>{events[e]=(events[e]??[]).filter(f=>f!==fn)}},moddle:{create:(type,props)=>({$type:type,...props})},modeling:{updateProperties:(_,props)=>Object.assign(bo,props)}}[key])};
window.readSchema=()=>JSON.parse(bo.extensionElements?.values?.find(v=>v.$type==='septem:FormSchema')?.json??'null');
window.loadXml=(schema)=>{(events['import.parse.start']??[]).forEach(f=>f());bo.extensionElements={values:schema?[{$type:'septem:FormSchema',json:typeof schema==='string'?schema:JSON.stringify(schema)}]:[]};(events['import.done']??[]).forEach(f=>f());};
window.flush=()=>useModeladorStore.getState().flushForm();
localStorage.setItem('septem.modelador.form',JSON.stringify({type:'default',id:'form_a',schemaVersion:17,components:[{type:'textfield',id:'field_a',key:'a',label:'Campo A'}]}));
const app=createRoot(document.getElementById('root')),client=new QueryClient({defaultOptions:{queries:{retry:false}}});
window.render=(ready)=>flushSync(()=>app.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/flows/edit?key=B']}><FormularioView modeler={modeler} processReady={ready}/></MemoryRouter></QueryClientProvider>));window.render(false);
`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'editor.js'),format:'iife',platform:'browser',tsconfig:join(root,'tsconfig.app.json'),define:{'import.meta.env':'{}'}});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let resolveSlow, slowRequested;const requested=new Promise(r=>{slowRequested=r});const slow=new Promise(r=>{resolveSlow=r});
 await page.route('http://audit.local/**',async r=>{
   const url=r.request().url();
   if(url.includes('/field-options')) {if(r.request().postDataJSON().dataSourceId==='slow'){slowRequested();await slow;}return r.fulfill({contentType:'application/json',body:'{"options":[{"value":"1","label":"Um"}]}'});}
   return r.fulfill({contentType:url.includes('/api/')?'application/json':'text/html',body:url.includes('/api/')?(url.includes('process-definitions')?'{"key":"B","hasInstances":false}':'[]'):'<div id="root"></div>'});
 });
 await page.goto('http://audit.local');await page.addScriptTag({path:join(dir,'editor.js')});
 const ready=()=>page.waitForFunction(()=>!document.querySelector('.septem-cockpit').inert);
 assert.equal(await page.evaluate(()=>window.flush().then(()=>false,()=>true)),true,'bloqueia antes do XML');
 await page.evaluate(()=>window.render(true));await ready();
 assert.equal(await page.getByText('Campo A',{exact:true}).count(),0,'não herda cache global');
 const schema=(key,props={})=>({type:'default',id:'form_'+key,schemaVersion:17,components:[{type:'datetime',id:'field_'+key,key,label:key,subtype:'datetime',properties:props}]});
 await page.evaluate(s=>window.loadXml(s),schema('B'));await ready();
 await page.locator('[data-septem-date-preview]').click();await page.getByRole('button',{name:'Aparência',exact:true}).click();
 for(const mode of ['date','time','datetime']) {
   await page.locator('aside select').first().selectOption(mode);
   assert.equal(await page.locator('[data-septem-date-preview]').getAttribute('data-septem-date-preview'),mode);
   await page.evaluate(()=>window.flush());assert.equal((await page.evaluate(()=>window.readSchema())).components[0].subtype,mode,'flush inclui mudança imediata');
 }
 await page.getByRole('button',{name:'Validação',exact:true}).click();await page.locator('aside select').selectOption('noPast');await page.evaluate(()=>window.flush());assert.equal((await page.evaluate(()=>window.readSchema())).components[0].properties.septemDateLimit,'noPast');
 await page.evaluate(s=>window.loadXml(s),schema('lento',{septemDataSourceId:'slow'}));await requested;
 await page.evaluate(s=>window.loadXml(s),schema('recente'));await ready();resolveSlow();
 await page.evaluate(()=>window.flush());assert.equal((await page.evaluate(()=>window.readSchema())).components[0].key,'recente','carga antiga não vence a nova');
 assert.equal(await page.locator('[data-septem-date-preview]').innerText(),'recente');

 // Campos criados pela paleta têm chave aleatória: renomear deve convertê-la.
 await page.getByRole('button',{name:'Texto',exact:true}).click();
 const nameInput=page.locator('aside input').first();
 const keyInput=page.locator('aside input').nth(1);
 const rename=async name=>{await nameInput.fill(name);await nameInput.blur();await page.evaluate(()=>window.flush());};
 await rename('Número do Contrato');
 assert.equal(await keyInput.inputValue(),'numero_do_contrato');
 await rename('Tipo de Contratação');
 assert.equal(await keyInput.inputValue(),'tipo_de_contratacao');
 // Blur sem alteração na chave não desliga a sincronização.
 await keyInput.focus();await keyInput.blur();await rename('Órgão Solicitante');
 assert.equal(await keyInput.inputValue(),'orgao_solicitante');
 await keyInput.fill('Código Externo');await keyInput.blur();await rename('Novo Nome');
 assert.equal(await keyInput.inputValue(),'codigo_externo','preserva chave personalizada');
 await page.getByRole('button',{name:'Data / Hora',exact:true}).click();
 await rename('Data de Assinatura');assert.equal(await keyInput.inputValue(),'data_de_assinatura');
 let stored=await page.evaluate(()=>window.readSchema());
 assert.equal(stored.components.at(-1).dateLabel,'Data de Assinatura');
 assert.equal(stored.components.at(-1).timeLabel,'Data de Assinatura');
 // Chave duplicada mantém a chave real e o painel coerentes.
 await keyInput.fill('codigo_externo');await keyInput.blur();
 assert.equal(await keyInput.inputValue(),'data_de_assinatura');
 // Reimportar conserva a opção manual e o comportamento automático.
 await page.evaluate(s=>window.loadXml(s),stored);await ready();
 await page.locator('[data-septem-date-preview]').last().click();
 await rename('Data de Publicação');assert.equal(await keyInput.inputValue(),'data_de_publicacao');
 // Formulários antigos também tinham chaves aleatórias sem a marca auto.
 await page.evaluate(s=>window.loadXml({...s,components:s.components.map(c=>({...c,label:'Data',dateLabel:'Data',timeLabel:'Data'}))}),schema('datetime_abc123'));await ready();
 await page.locator('[data-septem-date-preview]').click();
 await rename('Data do Contrato');assert.equal(await keyInput.inputValue(),'data_do_contrato');

 // Todos os tipos de entrada: paleta, esquema antigo, persistência e chave manual.
 for(const [type,label] of [['radio','Opções (radio)'],['textfield','Texto'],['textarea','Área de texto'],['number','Número'],['datetime','Data / Hora'],['filepicker','Upload de arquivo'],['select','Lista (dropdown)'],['checkbox','Caixa de seleção'],['checklist','Múltipla escolha'],['taglist','Tags']]){
   await page.getByRole('button',{name:label,exact:true}).click();
   await rename('Nome '+type);assert.equal(await keyInput.inputValue(),'nome_'+type,'paleta '+type);
   const fresh=await page.evaluate(()=>window.readSchema());
   const field={...fresh.components.at(-1),key:'campo_antigo_'+type,label:'Rótulo anterior',properties:{}};
   if(type==='datetime'){field.dateLabel='Rótulo anterior';field.timeLabel='Rótulo anterior';}
   const legacy={type:'default',id:'form_legacy_'+type,schemaVersion:17,components:[field]};
   await page.evaluate(s=>window.loadXml(s),legacy);await ready();await page.evaluate(id=>window.selectField(id),field.id);
   await rename('Opção de Contratação '+type);assert.equal(await keyInput.inputValue(),'opcao_de_contratacao_'+type,'legado '+type);
   const persisted=await page.evaluate(()=>window.readSchema());assert.equal(persisted.components[0].key,'opcao_de_contratacao_'+type);
   await page.evaluate(s=>window.loadXml(s),persisted);await ready();await page.evaluate(id=>window.selectField(id),field.id);
   await rename('Nome Atualizado '+type);assert.equal(await keyInput.inputValue(),'nome_atualizado_'+type,'reabertura '+type);
   await keyInput.fill('Chave Manual '+type);await keyInput.blur();await rename('Outro Nome '+type);
   assert.equal(await keyInput.inputValue(),'chave_manual_'+type,'manual '+type);
   console.log('PASSOU: chave automática e manual — '+type);
 }
 await page.evaluate(()=>window.loadXml('{invalido'));await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.flush().then(()=>false,()=>true)),true,'erro impede salvar schema anterior');
 assert.deepEqual(errors,[]);console.log('PASSOU: cache isolado, prontidão, três modos, flush imediato, restrição, carga concorrente e falha de importação, snake_case, datas, persistência e colisão de chaves.');
} finally {await browser.close();}

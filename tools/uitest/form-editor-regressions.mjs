import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'septem-editor-regressions-')),root=resolve(import.meta.dirname,'../..');
await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {MemoryRouter} from 'react-router-dom';import {FormularioView} from './src/components/modelador/views/FormularioView';import {useModeladorStore} from './src/stores/modelador';
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
 await page.evaluate(()=>window.loadXml('{invalido'));await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.flush().then(()=>false,()=>true)),true,'erro impede salvar schema anterior');
 assert.deepEqual(errors,[]);console.log('PASSOU: cache isolado, prontidão, três modos, flush imediato, restrição, carga concorrente e falha de importação.');
} finally {await browser.close();}

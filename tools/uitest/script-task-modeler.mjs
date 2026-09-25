// Exercita a página e o bpmn-js reais; somente a API é simulada.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-modelador-startup-'));
const xml = await readFile(join(root, 'src/assets/empty-diagram.bpmn'), 'utf8');
await build({ stdin: { contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ModeladorPage} from './src/pages/modelador/ModeladorPage';
import {useSessionStore} from './src/stores/session';
import {useModeladorStore} from './src/stores/modelador';
import Modeler from 'bpmn-js/lib/Modeler';
const original=Modeler.prototype.importXML;
Modeler.prototype.importXML=function(...args){window.modeler=this;return original.apply(this,args);};
useSessionStore.setState({accessToken:'test-token',status:'authenticated',user:{id:'test',name:'Teste',email:'teste@local',isInternal:true,perms:['*'],accessProfiles:[]}});
window.rename=name=>useModeladorStore.getState().setProcessName(name);
const router=createMemoryRouter([{path:'/flows/edit',element:<ModeladorPage/>}],{initialEntries:[window.location.pathname+window.location.search]});
const tree=<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RouterProvider router={router}/></QueryClientProvider>;
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('strict')?<React.StrictMode>{tree}</React.StrictMode>:tree);
`, resolveDir: root, loader: 'tsx' }, plugins: [{ name: 'raw-bpmn', setup(b) {
 b.onResolve({ filter: /\?raw$/ }, args => ({path:resolve(args.path.startsWith('@/')?join(root,'src'):args.resolveDir,args.path.replace(/^@\//,'').replace(/\?raw$/,'')),namespace:'raw'}));
 b.onLoad({filter:/.*/,namespace:'raw'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text',resolveDir:dirname(args.path)}));
} }], bundle:true, outfile:join(dir,'app.js'), platform:'browser', format:'iife', tsconfig:join(root,'tsconfig.app.json'), define:{'import.meta.env':'{}'} });
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const query of ['', '?strict=1']) {
  const page=await browser.newPage({viewport:{width:1280,height:900}}); const errors=[]; page.setDefaultTimeout(15000); let receiveSave; const saved=new Promise(r=>{receiveSave=r});
  page.on('pageerror', e=>errors.push(e.stack??e.message));
  await page.route('http://startup.local/**', async r=>{
    const url=r.request().url();
    if(!url.includes('/api/')) return r.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
    if(['POST','PUT'].includes(r.request().method()) && url.includes('/process-definitions/')) receiveSave({method:r.request().method(),body:r.request().postDataJSON()});
    if(url.includes('/data-sources'))return r.fulfill({json:[{id:'11111111-1111-1111-1111-111111111111',name:'Fonte da tarefa'}]});
    const body=url.includes('/process-definitions/')?{key:'existente',name:'Processo existente',version:1,status:'draft',bpmnXml:xml.replace('id="Process_1" isExecutable','id="Process_1" name="Processo existente" isExecutable'),hasInstances:false}:[];
    return r.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('http://startup.local/flows/edit'+query);await page.addScriptTag({path:join(dir,'app.js')});
  await page.waitForFunction(()=>document.body.innerText.includes('Unexpected Application Error')||!!document.querySelector('.septem-cockpit:not([inert])'),null,{timeout:15000});
  const body=await page.locator('body').innerText();
  assert.ok(!body.includes('Unexpected Application Error'),body);
  assert.deepEqual(errors,[]);
  if(query.includes('key=')) assert.equal(await page.evaluate(()=>window.modeler.get('canvas').getRootElement().businessObject.name),'Processo existente');

  assert.equal(await page.locator('[data-action="create.script-task"]').count(),1);
  await page.evaluate(()=>{
    const m=window.modeler,root=m.get('canvas').getRootElement();
    const shape=m.get('modeling').createShape(m.get('elementFactory').createShape({type:'bpmn:ScriptTask'}),{x:400,y:200},root);
    window.scriptId=shape.id;m.get('modeling').updateProperties(shape,{name:'Atualizar status da cessão'});m.get('selection').select(shape);
  });
  await page.getByText('Fonte de dados a ser executada',{exact:true}).waitFor();
  assert.equal(await page.getByText('Código JavaScript',{exact:true}).count(),0);
  await page.locator('button').filter({hasText:/^Selecione a fonte de dados$/}).click();
  await page.getByTestId('combobox-popover').getByRole('button',{name:'Fonte da tarefa',exact:true}).click();
  const before=await page.evaluate(async()=> (await window.modeler.saveXML({format:true})).xml);
  assert.ok(before.includes('bpmn:scriptTask'));assert.ok(before.includes('dataSourceRef="11111111-1111-1111-1111-111111111111"'));
  await page.evaluate(async xml=>{await window.modeler.importXML(xml);window.modeler.get('selection').select(window.modeler.get('elementRegistry').get(window.scriptId));},before);
  await page.locator('button').filter({hasText:/^Fonte da tarefa$/}).waitFor();
  await page.evaluate(()=>window.rename('Nome alterado'));
  await page.waitForFunction(()=>window.modeler.get('canvas').getRootElement().businessObject.name==='Nome alterado');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  const request=await saved;assert.equal(request.method,query.includes('key=')?'PUT':'POST');assert.ok(request.body.bpmnXml.includes('name="Nome alterado"'));assert.ok(request.body.bpmnXml.includes('bpmn:scriptTask'));assert.ok(request.body.bpmnXml.includes('dataSourceRef="11111111-1111-1111-1111-111111111111"'));
  assert.deepEqual(errors,[]);console.log(`PASSOU: criar scriptTask, configurar fonte, reimportar e salvar ${query||'novo'}`);await page.close();
 }
} finally {await browser.close();}

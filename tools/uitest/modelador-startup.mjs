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
useSessionStore.setState({accessToken:'test-token',status:'idle',user:null});
window.rename=name=>useModeladorStore.getState().setProcessName(name);
const router=createMemoryRouter([{path:'/flows/edit',element:<ModeladorPage/>}],{initialEntries:[window.location.pathname+window.location.search]});
const tree=<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RouterProvider router={router}/></QueryClientProvider>;
  const root=createRoot(document.getElementById('root'));
  window.unmount=()=>root.unmount();
  root.render(new URLSearchParams(location.search).has('strict')?<React.StrictMode>{tree}</React.StrictMode>:tree);
`, resolveDir: root, loader: 'tsx' }, plugins: [{ name: 'raw-bpmn', setup(b) {
 b.onResolve({ filter: /\?raw$/ }, args => ({path:resolve(args.path.startsWith('@/')?join(root,'src'):args.resolveDir,args.path.replace(/^@\//,'').replace(/\?raw$/,'')),namespace:'raw'}));
 b.onLoad({filter:/.*/,namespace:'raw'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text',resolveDir:dirname(args.path)}));
} }], bundle:true, outfile:join(dir,'app.js'), platform:'browser', format:'iife', tsconfig:join(root,'tsconfig.app.json'), define:{'import.meta.env':'{}'} });
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const query of ['', '?key=existente', '?strict=1', '?key=existente&strict=1']) {
    const page=await browser.newPage({viewport:{width:1280,height:900}}); const errors=[]; let receiveSave; const saved=new Promise(r=>{receiveSave=r});
    const writes=[]; let holdSave=null; let failSave=false;
  page.on('pageerror', e=>errors.push(e.stack??e.message));
  await page.route('http://localhost/**', async r=>{
    const url=r.request().url();
    if(!url.includes('/api/')) return r.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
      if(['POST','PUT'].includes(r.request().method()) && url.includes('/process-definitions/')) {
        const write={method:r.request().method(),body:r.request().postDataJSON()};
        writes.push(write); receiveSave(write);
        if(holdSave) await holdSave;
        if(failSave) return r.fulfill({status:500,json:{message:'Falha simulada'}});
      }
    const body=url.includes('/api/v1/me')?{id:'test',name:'Admin',email:'admin@local',isInternal:true,perms:['*'],accessProfiles:[]}:url.includes('/api/tenant/config')?{tenantId:'test'}:url.includes('/process-definitions/')?{key:'existente',name:'Processo existente',version:1,status:'draft',bpmnXml:xml.replace('id="Process_1" isExecutable','id="Process_1" name="Processo existente" isExecutable'),hasInstances:false}:[];
    return r.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
    await page.goto('http://localhost/flows/edit'+query);
    await page.clock.install();
    await page.addScriptTag({path:join(dir,'app.js')});
  await page.waitForFunction(()=>document.body.innerText.includes('Unexpected Application Error')||[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Importar JSON'&&!b.disabled),null,{timeout:15000});
  const body=await page.locator('body').innerText();
  assert.ok(!body.includes('Unexpected Application Error'),body);
  assert.equal(await page.locator('[data-native-editor]').count(),0,'Abrir/salvar o fluxo não exige montar o editor de formulário');
  await page.getByRole('button',{name:'Importar JSON',exact:true,includeHidden:true}).waitFor({state:'attached'});
  assert.deepEqual(errors,[]);
  if(query.includes('key=')) assert.equal(await page.evaluate(()=>window.modeler.get('canvas').getRootElement().businessObject.name),'Processo existente');
  await page.evaluate(()=>window.rename('Nome alterado'));
  await page.waitForFunction(()=>window.modeler.get('canvas').getRootElement().businessObject.name==='Nome alterado');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  const request=await saved;assert.equal(request.method,query.includes('key=')?'PUT':'POST');assert.ok(request.body.bpmnXml.includes('name="Nome alterado"'));assert.ok(request.body.bpmnXml.includes('septem-native'),'persiste definição nativa pelo BPMN real');
    await page.waitForFunction(()=>!document.querySelector('button[aria-busy="true"]'));
    await page.clock.pauseAt(new Date(Date.now()+1000));
    assert.equal(await page.getByText('Alterações pendentes',{exact:true}).count(),0);
    console.log(`PASSOU: criar/abrir, renomear e salvar ${query||'novo'}`);

    await page.evaluate(()=>window.rename('Primeira edição automática'));
    await page.waitForFunction(()=>window.modeler.get('canvas').getRootElement().businessObject.name==='Primeira edição automática');
    await page.clock.fastForward(4*60*1000);
    assert.equal(writes.length,1,'Não deve salvar antes dos 5 minutos');
    await page.evaluate(()=>window.rename('Última edição automática'));
    await page.waitForFunction(()=>window.modeler.get('canvas').getRootElement().businessObject.name==='Última edição automática');
    await page.clock.fastForward(60*1000);
    await page.waitForFunction(()=>!document.querySelector('button[aria-busy="true"]')&&!document.body.innerText.includes('Alterações pendentes'));
    assert.equal(writes.length,2,'Edições contínuas não devem reiniciar o intervalo');
    assert.equal(writes[1].method,'PUT','Depois do primeiro save deve usar a chave atual');
    assert.ok(writes[1].body.bpmnXml.includes('name="Última edição automática"'));
    assert.ok(writes[1].body.bpmnXml.includes('septem-native'));
    await page.clock.fastForward(5*60*1000);
    assert.equal(writes.length,2,'Sem alterações não deve gravar novamente');

    let releaseSave; holdSave=new Promise(resolve=>{releaseSave=resolve});
    await page.evaluate(()=>window.rename('Gravação em andamento'));
    await page.clock.fastForward(5*60*1000);
    await page.getByRole('button',{name:'Salvando…',exact:true}).waitFor();
    await page.evaluate(()=>window.rename('Edição durante o salvamento'));
    await page.clock.fastForward(5*60*1000);
    assert.equal(writes.length,3,'Não deve sobrepor uma gravação em andamento');
    holdSave=null; releaseSave();
    await page.waitForFunction(()=>!document.querySelector('button[aria-busy="true"]'));
    assert.equal(await page.getByText('Alterações pendentes',{exact:true}).count(),1,'Edições durante o save continuam pendentes');
    await page.clock.fastForward(5*60*1000);
    await page.waitForFunction(()=>!document.querySelector('button[aria-busy="true"]')&&!document.body.innerText.includes('Alterações pendentes'));
    assert.equal(writes.length,4);
    assert.ok(writes[3].body.bpmnXml.includes('name="Edição durante o salvamento"'));

    failSave=true;
    await page.evaluate(()=>window.rename('Edição para tentar novamente'));
    await page.clock.fastForward(5*60*1000);
    await page.waitForFunction(()=>!document.querySelector('button[aria-busy="true"]'));
    assert.equal(writes.length,5);
    assert.equal(await page.getByText('Alterações pendentes',{exact:true}).count(),1,'Falha deve manter as alterações pendentes');
    failSave=false;
    await page.clock.fastForward(5*60*1000);
    await page.waitForFunction(()=>!document.querySelector('button[aria-busy="true"]')&&!document.body.innerText.includes('Alterações pendentes'));
    assert.equal(writes.length,6,'Deve tentar novamente no próximo intervalo');

    await page.evaluate(()=>{window.rename('Edição ao sair');window.unmount();});
    await page.clock.fastForward(5*60*1000);
    assert.equal(writes.length,6,'Sair da página deve cancelar o salvamento automático');
    assert.deepEqual(errors,[]);
    console.log(`PASSOU: autosave a cada 5 minutos, estado atual, concorrência, falha e saída ${query||'novo'}`);
    await page.close();
 }
} finally {await browser.close();}

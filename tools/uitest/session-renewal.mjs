// Cliente HTTP e sessão reais, servidor simulado com refresh de uso único.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..'),dir=await mkdtemp(join(tmpdir(),'septem-session-'));
await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {DataSourceSelect} from './src/components/modelador/fields/DataSourceSelect';
import {api} from './src/lib/api';import {useSessionStore} from './src/stores/session';
useSessionStore.setState({status:'authenticated',user:{id:'admin',perms:['*']}});
window.call=path=>api.get(path??'/api/v1/data-sources').then(()=>({ok:true}),e=>({ok:false,status:e.status}));
window.callFormat=async(kind,path='/api/formats/'+kind)=>{
 try {
  let value;
  if(kind==='getBlob')value=await api.getBlob(path);
  else if(kind==='postBlob')value=await api.postBlob(path,{filter:'ação'});
  else if(kind==='postForm'){
   const form=new FormData();form.append('description','ação');form.append('file',new Blob([new Uint8Array([0,255,42])],{type:'application/octet-stream'}),'fixture.bin');
   value=await api.postForm(path,form);
  } else value=await api.get(path);
  return {ok:true,value:value instanceof Blob?Array.from(new Uint8Array(await value.arrayBuffer())):value};
 } catch(e){return {ok:false,status:e.status,detail:e.detail};}
};
window.snapshot=()=>({status:useSessionStore.getState().status,access:useSessionStore.getState().accessToken,stored:localStorage.getItem('septem.accessToken')});
window.logout=()=>useSessionStore.getState().logout();window.bootstrap=()=>useSessionStore.getState().bootstrap();
window.mount=()=>{const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(['catalog','data-sources'],[]);createRoot(document.querySelector('div')).render(<QueryClientProvider client={client}><DataSourceSelect value="" onChange={()=>{}}/></QueryClientProvider>);};
window.ready=true;
`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),platform:'browser',format:'iife',tsconfig:join(root,'tsconfig.app.json'),define:{'import.meta.env':'{}'}});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const scenarios=process.argv.slice(2);
async function scenario(name,run){if(scenarios.length&&!scenarios.includes(name))return;const context=await browser.newContext();let refreshCount=0,validRefresh='refresh-old',mode='ok',release,entered;const requests=[];
 const requested=new Promise(r=>entered=r),held=new Promise(r=>release=r);
 await context.addInitScript(()=>{if(!localStorage.getItem('seeded')){localStorage.setItem('seeded','1');localStorage.setItem('septem.accessToken','access-old');localStorage.setItem('septem.refreshToken','refresh-old');}});
 await context.route('https://session.local/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path.startsWith('/api/formats/'))requests.push({path,method:request.method(),headers:request.headers(),body:request.postDataBuffer()});
  if(!path.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<div></div>'});
  if(path.endsWith('/refresh')){
   refreshCount++;if(mode==='network')return route.abort('failed');
   if(mode==='unavailable')return route.fulfill({status:503,json:{detail:'Temporariamente indisponível'}});
   if(mode==='denied'||request.postDataJSON().refreshToken!==validRefresh)return route.fulfill({status:401,json:{error:'invalid_refresh'}});
   validRefresh='refresh-new';entered();if(mode==='held')await held;
   return route.fulfill({json:{accessToken:'access-new',refreshToken:'refresh-new'}});
  }
  if(path.endsWith('/logout'))return route.fulfill({status:204});
  if(path.endsWith('/forbidden'))return route.fulfill({status:403,json:{detail:'Sem permissão'}});
  if(path.endsWith('/config'))return route.fulfill({json:{tenantId:'test',clienteNome:'Teste',ambienteNome:'Teste',modulos:[]}});
  if(mode==='bootstrap-error'&&path.endsWith('/me'))return route.fulfill({status:503,json:{detail:'Indisponível'}});
  if(request.headers().authorization==='Bearer access-new'){
   if(mode==='retry-denied')return route.fulfill({status:401,json:{detail:'Ainda inválido'}});
   if(mode==='retry-error')return route.fulfill({status:503,json:{detail:'Falha após renovação'}});
   if(path.endsWith('/getBlob')||path.endsWith('/postBlob'))return route.fulfill({contentType:'application/octet-stream',body:Buffer.from([0,255,42])});
   if(path.endsWith('/postForm'))return route.fulfill({json:{uploaded:true}});
   return route.fulfill({json:[]});
  }
  return route.fulfill({status:401,json:{error:'expired'}});
 });
 const open=async()=>{const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto('https://session.local/');await page.addScriptTag({path:join(dir,'app.js')});return page;};
 try{await run({open,count:()=>refreshCount,setMode:m=>mode=m,requested,release,requests});console.log('PASSOU: '+name);}finally{release();await context.close();}}
try{
 for(const kind of ['getBlob','postBlob','postForm']) {
  await scenario('format-'+kind,async({open,count,requests})=>{
   const p=await open();const result=await p.evaluate(k=>window.callFormat(k),kind);
   assert.deepEqual(result,{ok:true,value:kind==='postForm'?{uploaded:true}:[0,255,42]});assert.equal(count(),1);assert.equal(requests.length,2);
   for(const request of requests){
    assert.equal(request.headers['x-tenant'],'session');assert.equal(request.method,kind==='getBlob'?'GET':'POST');
    if(kind==='postBlob'){assert.equal(request.headers['content-type'],'application/json');assert.deepEqual(JSON.parse(request.body.toString()),{filter:'ação'});}
    if(kind==='postForm'){
     assert.match(request.headers['content-type'],/^multipart\/form-data; boundary=/);
     const form=await new Response(request.body,{headers:{'Content-Type':request.headers['content-type']}}).formData();
     assert.equal(form.get('description'),'ação');assert.equal(form.get('file').name,'fixture.bin');assert.deepEqual(Array.from(new Uint8Array(await form.get('file').arrayBuffer())),[0,255,42]);
    }
   }
   assert.equal(requests[0].headers.authorization,'Bearer access-old');assert.equal(requests[1].headers.authorization,'Bearer access-new');
  });
  for(const mode of ['unavailable','network','denied','retry-denied','retry-error'])await scenario(kind+'-'+mode,async({open,count,setMode,requests})=>{
   const p=await open();setMode(mode);const result=await p.evaluate(k=>window.callFormat(k),kind);assert.equal(result.ok,false);assert.equal(count(),1);
   const state=await p.evaluate(()=>window.snapshot());assert.equal(state.status,mode==='denied'?'unauthenticated':'authenticated');
   assert.equal(requests.length,mode.startsWith('retry-')?2:1);
   if(mode==='retry-error')assert.equal(result.detail,'Falha após renovação');
   if(mode==='unavailable'||mode==='network'){setMode('ok');assert.equal((await p.evaluate(k=>window.callFormat(k),kind)).ok,true);}
  });
 }
 await scenario('mixed-formats',async({open,count})=>{
  const a=await open(),b=await open();const results=await Promise.all([a.evaluate(()=>Promise.all(['get','getBlob','postForm'].map(k=>window.callFormat(k)))),b.evaluate(()=>window.callFormat('postBlob'))]);
  assert.ok(results.flat().every(r=>r.ok));assert.equal(count(),1);
 });
 await scenario('simultaneas',async({open,count})=>{const p=await open();const results=await p.evaluate(()=>Promise.all(Array.from({length:4},()=>window.call())));assert.ok(results.every(r=>r.ok),JSON.stringify(results));assert.equal(count(),1);assert.equal((await p.evaluate(()=>window.snapshot())).status,'authenticated');});
 await scenario('duas-abas',async({open,count})=>{const a=await open(),b=await open();const results=await Promise.all([a.evaluate(()=>window.call()),b.evaluate(()=>window.call())]);assert.ok(results.every(r=>r.ok),JSON.stringify(results));assert.equal(count(),1);for(const p of [a,b])assert.equal((await p.evaluate(()=>window.snapshot())).access,'access-new');});
 await scenario('aba-antiga',async({open,count})=>{const a=await open(),b=await open();assert.equal((await a.evaluate(()=>window.call())).ok,true);assert.equal((await b.evaluate(()=>window.call())).ok,true);assert.equal(count(),1);});
 await scenario('botao-fontes',async({open,count})=>{const p=await open();await p.evaluate(()=>window.mount());const button=p.getByRole('button',{name:'Atualizar fontes de dados',exact:true});await button.waitFor();await p.waitForFunction(()=>!document.querySelector('[aria-label="Atualizar fontes de dados"]').disabled);await button.click();await p.waitForFunction(()=>!document.querySelector('[aria-label="Atualizar fontes de dados"]').disabled);assert.equal(count(),1);assert.equal((await p.evaluate(()=>window.snapshot())).status,'authenticated');});
 await scenario('sem-refresh',async({open,count})=>{const p=await open();await p.evaluate(()=>localStorage.removeItem('septem.refreshToken'));assert.equal((await p.evaluate(()=>window.call())).status,401);assert.equal(count(),0);assert.equal((await p.evaluate(()=>window.snapshot())).status,'unauthenticated');});
 for(const mode of ['unavailable','network'])await scenario(mode,async({open,setMode})=>{const p=await open();setMode(mode);assert.equal((await p.evaluate(()=>window.call())).ok,false);assert.equal((await p.evaluate(()=>window.snapshot())).status,'authenticated');assert.equal((await p.evaluate(()=>window.snapshot())).stored,'access-old');setMode('ok');assert.equal((await p.evaluate(()=>window.call())).ok,true);});
 await scenario('sem-permissao',async({open,count})=>{const p=await open();assert.equal((await p.evaluate(()=>window.call('/api/forbidden'))).status,403);assert.equal(count(),0);assert.equal((await p.evaluate(()=>window.snapshot())).status,'authenticated');});
 await scenario('revogada',async({open,setMode})=>{const p=await open();setMode('denied');assert.equal((await p.evaluate(()=>window.call())).status,401);assert.equal((await p.evaluate(()=>window.snapshot())).status,'unauthenticated');assert.equal((await p.evaluate(()=>window.snapshot())).stored,null);});
 await scenario('logout-durante-refresh',async({open,setMode,requested,release})=>{const p=await open();setMode('held');const calling=p.evaluate(()=>window.call());await requested;await p.evaluate(()=>window.logout());release();await calling;assert.equal((await p.evaluate(()=>window.snapshot())).status,'unauthenticated');assert.equal((await p.evaluate(()=>window.snapshot())).stored,null);});
 await scenario('bootstrap-error',async({open,setMode})=>{const p=await open();setMode('bootstrap-error');await p.evaluate(()=>window.bootstrap());assert.equal((await p.evaluate(()=>window.snapshot())).status,'error');assert.equal((await p.evaluate(()=>window.snapshot())).stored,'access-old');});
}finally{await browser.close();}

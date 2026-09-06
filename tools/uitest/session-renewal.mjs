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
window.snapshot=()=>({status:useSessionStore.getState().status,access:useSessionStore.getState().accessToken,stored:localStorage.getItem('septem.accessToken')});
window.logout=()=>useSessionStore.getState().logout();window.bootstrap=()=>useSessionStore.getState().bootstrap();
window.mount=()=>{const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(['catalog','data-sources'],[]);createRoot(document.querySelector('div')).render(<QueryClientProvider client={client}><DataSourceSelect value="" onChange={()=>{}}/></QueryClientProvider>);};
window.ready=true;
`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),platform:'browser',format:'iife',tsconfig:join(root,'tsconfig.app.json'),define:{'import.meta.env':'{}'}});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const scenarios=process.argv.slice(2);
async function scenario(name,run){if(scenarios.length&&!scenarios.includes(name))return;const context=await browser.newContext();let refreshCount=0,validRefresh='refresh-old',mode='ok',release,entered;
 const requested=new Promise(r=>entered=r),held=new Promise(r=>release=r);
 await context.addInitScript(()=>{if(!localStorage.getItem('seeded')){localStorage.setItem('seeded','1');localStorage.setItem('septem.accessToken','access-old');localStorage.setItem('septem.refreshToken','refresh-old');}});
 await context.route('https://session.local/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
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
  if(request.headers().authorization==='Bearer access-new')return route.fulfill({json:[]});
  return route.fulfill({status:401,json:{error:'expired'}});
 });
 const open=async()=>{const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto('https://session.local/');await page.addScriptTag({path:join(dir,'app.js')});return page;};
 try{await run({open,count:()=>refreshCount,setMode:m=>mode=m,requested,release});console.log('PASSOU: '+name);}finally{release();await context.close();}}
try{
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

// Real components/session state against controlled API responses; backend tests prove enforcement.
import assert from 'node:assert/strict';
import {build} from '../../node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright-core';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),dir=await mkdtemp(join(tmpdir(),'septem-access-policy-'));
let browser;
const schema={format:'septem-native',schemaVersion:1,id:'form',tabs:[{id:'tab',label:'Requisição',groups:[{id:'group',label:'Dados',type:'group',fields:[{id:'details',kind:'field',type:'textfield',key:'details',label:'Detalhes',config:{}}]}]}]};
try {
 await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {ServicoPublicoPage} from './src/pages/ServicoPublicoPage';import {ServicoFormPage} from './src/pages/ServicoFormPage';import {useSessionStore} from './src/stores/session';import {applyTenantMeta} from './src/lib/tenant-meta';
 const tenant={tenantId:'acme',ambienteNome:'Sistema Exemplo',clienteNome:'NOME PRIVADO CENTRAL',calendarReady:false,primaryColor:'#0f172a',turnstileSiteKey:'test-key',modulos:[]};
 applyTenantMeta(tenant);useSessionStore.setState({tenant,status:window.internal?'authenticated':'unauthenticated',user:window.internal?{id:'admin',isInternal:true,perms:['*']}:null,accessToken:window.internal?'session-token':null});
 window.snapshot=()=>({status:useSessionStore.getState().status,device:localStorage.getItem('septem.deviceToken')});window.publishCalendar=()=>useSessionStore.setState({tenant:{...tenant,calendarReady:true}});
 window.turnstile={render:(node,opts)=>{queueMicrotask(()=>opts.callback('captcha-ok'));return 'captcha';},reset:()=>{}};
 createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[window.internal?'/internal/sample':'/public/sample']}><Routes><Route path='/public/:processKey' element={<ServicoPublicoPage/>}/><Route path='/internal/:processKey' element={<ServicoFormPage/>}/></Routes></MemoryRouter></QueryClientProvider>);`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),format:'iife',platform:'browser',tsconfig:join(root,'tsconfig.app.json'),define:{'import.meta.env':JSON.stringify({VITE_API_URL:'https://access.local'})}});
 const css=(await Promise.all((await readdir(join(root,'dist/assets'))).filter(x=>x.endsWith('.css')).map(x=>readFile(join(root,'dist/assets',x),'utf8')))).join('\n');
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const width of [1280,375])for(const flow of ['login','signup','internal']) {
  const context=await browser.newContext({viewport:{width,height:width===375?812:900}}),page=await context.newPage(),writes=[],errors=[];
  let mfaFails=true;
  await context.route('https://access.local/**',route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'});
   if(request.method()!=='GET') {
    const body=request.postDataJSON();writes.push({path,body});
    if(path.endsWith('/auth/login'))return route.fulfill({json:{twoFactorRequired:true,maskedEmail:'a***@example.test'}});
    if(path.endsWith('/auth/2fa'))return mfaFails?route.fulfill({status:400,json:{detail:'Código inválido ou expirado.'}}):route.fulfill({json:{accessToken:'session-token',refreshToken:'refresh-token',deviceToken:'month-device'}});
    if(path.endsWith('/public/signup'))return route.fulfill({json:{jaExiste:false,detail:'Código enviado'}});
    if(path.endsWith('/signup/confirm'))return route.fulfill({json:{accessToken:'ignored-confirmation-token'}});
    if(path.endsWith('/instances'))return route.fulfill({json:{executionId:'execution',nextTaskForMe:null}});
    return route.fulfill({json:{number:101}});
   }
   if(path.endsWith('/me'))return route.fulfill({json:{id:'citizen',name:'Ana',email:'ana@example.test',isInternal:false,perms:[]}});
   if(path.endsWith('/public/services/sample'))return route.fulfill({json:{key:'sample',name:'Solicitação',requiresLogin:true,description:null,formSchema:JSON.stringify(schema)}});
   if(path.endsWith('/sample/form'))return route.fulfill({json:{processName:'Solicitação',startTaskName:'Iniciar solicitação',formSchema:schema,buttons:[{id:'start',label:'Abrir processo',validateForm:false}]}});
   if(path.endsWith('/sample'))return route.fulfill({json:{key:'sample',name:'Solicitação'}});
   return route.fulfill({json:{items:[]}});
  });
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  await page.goto('https://access.local/');await page.evaluate(internal=>window.internal=internal,flow==='internal');await page.addStyleTag({content:css});await page.addScriptTag({path:join(dir,'app.js')});
  await page.getByRole('textbox',{name:'Detalhes',exact:true}).fill('Rascunho preservado');const initialUrl=page.url();
  async function layout(name){const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,clipped:[...document.querySelectorAll('input:not([type=hidden]),select,textarea,button')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.left< -1||r.right>innerWidth+1)}).map(x=>x.outerHTML.slice(0,100))}));assert.deepEqual(result,{overflow:false,clipped:[]});await page.screenshot({path:join(tmpdir(),`septem-access-${name}-${width}.png`),fullPage:true});}
  await page.getByTestId('calendar-not-configured').waitFor();assert.ok((await page.title()).includes('Sistema Exemplo'));assert.ok(!(await page.title()).includes('NOME PRIVADO CENTRAL'));assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'),'Sistema Exemplo');
  if(flow==='internal') {
   await page.getByTestId('iniciar-como-teste').check();if(width===375)await page.getByRole('button',{name:'Botões de conclusão',exact:true}).click();const action=page.getByRole('button',{name:'Abrir processo',exact:true});assert.equal(await action.isDisabled(),true);assert.equal(writes.length,0);await layout('internal-calendar');
   await page.evaluate(()=>window.publishCalendar());assert.equal(await action.isEnabled(),true);await Promise.all([page.waitForResponse(response=>response.url().endsWith('/instances')),action.click()]);assert.equal(writes.at(-1).path,'/api/v1/workflow/instances');assert.equal(writes.at(-1).body.data.details,'Rascunho preservado');assert.equal(writes.at(-1).body.isTest,true);
  } else {
   await page.getByTestId(flow==='login'?'servico-entrar':'servico-criar-conta').click();
   await page.getByTestId('conta-email').fill('ana@example.test');await page.getByTestId('conta-senha').fill('password123');
   if(flow==='signup') {
    await page.getByTestId('conta-nome').fill('Ana');await page.getByTestId('conta-cpf').fill('52998224725');await page.getByTestId('conta-telefone').fill('81999999999');await page.getByTestId('conta-criar').click();await page.getByTestId('conta-codigo-campo').fill('123456');await page.getByTestId('conta-confirmar').click();
   } else await page.getByTestId('conta-entrar').click();
   await page.getByTestId('conta-2fa').waitFor();assert.equal(page.url(),initialUrl);assert.equal(await page.locator('[data-form-id="details"] input').inputValue(),'Rascunho preservado');assert.equal((await page.evaluate(()=>window.snapshot())).status,'unauthenticated');assert.equal(await page.getByTestId('conta-mfa-confirmar').isDisabled(),true);await layout(flow+'-mfa');
   await page.getByTestId('conta-mfa-codigo').fill('111111');await page.getByTestId('conta-mfa-confirmar').click();await page.getByTestId('conta-erro').filter({hasText:'Código inválido'}).waitFor();assert.equal(await page.getByTestId('conta-2fa').count(),1);mfaFails=false;
   await page.getByTestId('conta-mfa-codigo').fill('123456');await page.getByLabel('Confiar neste dispositivo por 1 mês').check();await page.getByTestId('conta-mfa-confirmar').click();await page.getByTestId('servico-logado').waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(page.url(),initialUrl);assert.equal(await page.locator('[data-form-id="details"] input').inputValue(),'Rascunho preservado');assert.deepEqual(await page.evaluate(()=>window.snapshot()),{status:'authenticated',device:'month-device'});assert.equal(writes.filter(x=>x.path.endsWith('/auth/2fa')).at(-1).body.trustDevice,true);
   assert.equal(await page.getByTestId('servico-enviar').isDisabled(),true);assert.equal(writes.filter(x=>x.path.endsWith('/submit')).length,0);await layout(flow+'-calendar');await page.evaluate(()=>window.publishCalendar());await page.getByTestId('servico-enviar').click();await page.getByTestId('servico-protocolo').waitFor();assert.equal(writes.at(-1).body.data.details,'Rascunho preservado');
  }
  assert.deepEqual(errors,[]);console.log(`PASS ${width} ${flow}: in-page MFA, draft continuity, system identity and calendar gating.`);await context.close();
 }
}finally{await browser?.close();await rm(dir,{recursive:true,force:true});}

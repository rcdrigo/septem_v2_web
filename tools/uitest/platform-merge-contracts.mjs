// Isolated integration regression: production components and HTTP clients, no real tenant writes.
import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-platform-contracts-'));
let browser;
try {
  await build({
    stdin: { contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {MemoryRouter, Routes, Route} from 'react-router-dom';
      import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
      import {PlatformEnvironmentAdministration} from './src/pages/platform/PlatformEnvironmentAdministration';
      import {PlatformSuperAdminsPage} from './src/pages/platform/PlatformSuperAdminsPage';
      import {PlatformLayout} from './src/pages/platform/PlatformLayout';
      import {Dialog} from './src/components/ui/Dialog';
      import {usePlatformSession} from './src/stores/platform-session';
      import {useVerifyDomain} from './src/lib/api/platform-clients';
      import {useApplyTransfer} from './src/lib/api/client-transfers';
      import {useSessionStore} from './src/stores/session';
      const mode = new URLSearchParams(location.search).get('mode');
      const roles = mode === 'triage' ? ['support_triage'] : ['super_admin'];
      usePlatformSession.setState({status:'authenticated',identity:{id:'actor',name:'Teste',email:'test@example.test',roles,globalAccess:true},accessToken:'central-token'});
      useSessionStore.setState({status:'authenticated',accessToken:'tenant-token',user:{id:'tenant-user',perms:['*']}});
      function Commands() {
        const verify=useVerifyDomain('tenant');const apply=useApplyTransfer();
        const [result,setResult]=useState('');
        return <><button onClick={()=>verify.mutateAsync('domain').then(()=>setResult('verified'))}>Verificar domínio</button>
          <button onClick={()=>apply.mutateAsync({planId:'plan',confirmOverwriteConflicts:false,expectedPlanVersion:3}).then(()=>setResult('applied')).catch(()=>setResult('rejected'))}>Aplicar transferência</button>
          <output>{result}</output></>;
      }
      function Modal() {
        const [open,setOpen]=useState(false);
        return <><button onClick={()=>setOpen(true)}>Abrir</button>{open&&<Dialog open title="Confirmação" dismissible={false} onClose={()=>setOpen(false)}><button onClick={()=>setOpen(false)}>Concluir</button></Dialog>}</>;
      }
      const component = mode==='settings' ? <PlatformEnvironmentAdministration tenantId="tenant"/> : mode==='admins' ? <PlatformSuperAdminsPage/> : mode==='commands' ? <Commands/> : mode==='dialog' ? <Modal/> : <PlatformLayout/>;
      const path=mode==='triage'?'/platform/support/triage':'/platform/clients';
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={component}/></Routes></MemoryRouter></QueryClientProvider>);
    `, resolveDir: root, loader: 'tsx' },
    bundle: true, outfile: join(dir,'app.js'), format:'iife', platform:'browser',
    tsconfig:join(root,'tsconfig.app.json'), define:{'import.meta.env':'{}'},
  });
  const css=(await Promise.all((await readdir(join(root,'dist/assets'))).filter(f=>f.endsWith('.css')).map(f=>readFile(join(root,'dist/assets',f),'utf8')))).join('\n');
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  for (const width of [1280,375]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    const writes=[],errors=[];
    let settingsVersion=17,environmentVersion=31,adminVersion=47,conflict=false,transferOk=true;
    await context.route('https://platform.test/**',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
      if(!path.startsWith('/api/')) return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'});
      if(method==='PUT'||method==='POST') {
        writes.push({path,body:request.postDataJSON(),headers:request.headers()});
        if(conflict)return route.fulfill({status:409,json:{error:'concurrency_conflict'}});
      }
      if(path.endsWith('/settings/policies')) {environmentVersion++;return route.fulfill({json:{policies:request.postDataJSON().policies}});}
      if(path.endsWith('/settings/')) {
        if(method==='PUT')settingsVersion++;
        return route.fulfill({json:{expectedVersion:settingsVersion,logoUrl:null,heroImageUrl:null,systemDescription:'Original',businessHourStart:8,businessHourEnd:18,businessDays:'1,2,3,4,5',twoFactorMode:'off',maxLoginAttempts:5,lockoutMinutes:15,maxUploadMb:20,smtpHost:'smtp.test',smtpPort:587,smtpUseSsl:true,smtpAuthMode:'login',smtpUser:'user',smtpFromAddress:'sender@example.test',smtpFromName:'Sistema',policies:{general:{visible:true,editable:true}}}});
      }
      if(path.endsWith('/environments/tenant'))return route.fulfill({json:{tenantId:'tenant',displayName:'Teste',version:environmentVersion}});
      if(path.endsWith('/super-admins'))return route.fulfill({json:{items:[{id:'admin',version:adminVersion,name:'Admin original',email:'admin@example.test',status:'active',globalAccess:true,clients:[],environments:[]}]}});
      if(path.endsWith('/super-admins/admin')){adminVersion++;return route.fulfill({json:{created:false}});}
      if(path.includes('/super-admins/'))return route.fulfill({json:{created:true,invitationSent:true}});
      if(path.endsWith('/verify'))return route.fulfill({status:202,json:{operationId:'domain-job',status:'queued',statusUrl:'/api/v1/platform/operations/domain-job'}});
      if(path.endsWith('/operations/domain-job'))return route.fulfill({json:{status:'completed'}});
      if(path.endsWith('/apply'))return route.fulfill({status:202,json:{operationId:'transfer-job',status:'queued',statusUrl:'/api/v1/client/transfers/operations/transfer-job'}});
      if(path.endsWith('/operations/transfer-job'))return route.fulfill({json:{status:'completed',result:{ok:transferOk,activated:[],details:[],error:transferOk?null:'Destino mudou'}}});
      return route.fulfill({json:{items:[],unread:0}});
    });
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
    async function open(mode) {await page.goto('https://platform.test/?mode='+mode);await page.addStyleTag({content:css});await page.addScriptTag({path:join(dir,'app.js')});}
    await open('settings');
    await page.getByRole('checkbox',{name:'Servidor de e-mail',exact:true}).check();
    await page.getByRole('button',{name:'Salvar permissões',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Permissões dos parâmetros salvas.'}).waitFor();
    assert.deepEqual(writes.at(-1).body,{policies:{email:{visible:true,editable:true},storage:{visible:false,editable:false},openRouter:{visible:false,editable:false}},expectedVersion:31},'policy writes use master environment version, not tenant settings version');
    await page.getByLabel('Descrição do sistema',{exact:true}).fill('Alterado');
    await page.getByRole('button',{name:'Salvar parâmetros',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Parâmetros salvos neste ambiente.'}).waitFor();
    assert.equal(writes.at(-1).body.expectedVersion,17);
    await page.getByLabel('Descrição do sistema',{exact:true}).fill('Conflito');
    conflict=true;
    await page.getByRole('button',{name:'Salvar parâmetros',exact:true}).click();
    await page.getByRole('status').filter({hasText:'alterados por outra pessoa'}).waitFor();
    assert.equal(writes.at(-1).body.expectedVersion,18,'second settings write uses refreshed tenant version');
    assert.equal(await page.getByLabel('Descrição do sistema',{exact:true}).inputValue(),'Conflito','conflict preserves draft');
    conflict=false;
    await open('admins');
    await page.getByRole('button',{name:'Editar',exact:true}).click();
    await page.getByLabel('Nome',{exact:true}).fill('Admin alterado');
    await page.getByRole('button',{name:'Salvar acesso',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Acesso atualizado.'}).waitFor();
    assert.equal(writes.at(-1).body.expectedVersion,47);
    assert.equal('version' in writes.at(-1).body,false);
    await page.getByLabel('Nome',{exact:true}).fill('Novo admin');
    await page.getByLabel('E-mail',{exact:true}).fill('new@example.test');
    await page.getByLabel('Acesso global à plataforma').check();
    await page.getByRole('button',{name:'Adicionar e enviar código'}).click();
    await page.getByRole('status').filter({hasText:'Acesso criado.'}).waitFor();
    assert.equal('expectedVersion' in writes.at(-1).body,false,'creation does not send a fake version');
    await open('navigation');
    assert.equal(await page.getByRole('link',{name:'Usuários',exact:true}).count(),1);
    assert.equal(await page.getByTestId('platform-nav-triagem').count(),1);
    assert.equal(await page.getByTestId('platform-nav-fila').count(),1);
    assert.equal(await page.getByTestId('platform-nav-suporte').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await open('triage');
    assert.equal(await page.getByRole('link',{name:'Usuários',exact:true}).count(),0);
    assert.equal(await page.getByRole('link',{name:'Clientes',exact:true}).count(),0);
    assert.equal(await page.getByTestId('platform-nav-triagem').count(),1);
    await open('commands');
    await page.getByRole('button',{name:'Verificar domínio'}).click();
    await page.locator('output').filter({hasText:'verified'}).waitFor();
    await page.getByRole('button',{name:'Aplicar transferência'}).click();
    await page.locator('output').filter({hasText:'applied'}).waitFor();
    transferOk=false;
    await page.getByRole('button',{name:'Aplicar transferência'}).click();
    await page.locator('output').filter({hasText:'rejected'}).waitFor();
    const centralWrites=writes.filter(w=>w.path.startsWith('/api/v1/platform'));
    assert.ok(centralWrites.every(w=>w.headers.authorization==='Bearer central-token'&&!w.headers['x-tenant']),'central identity stays separate from tenant identity');
    await open('dialog');
    await page.getByRole('button',{name:'Abrir',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByRole('button',{name:'Fechar',exact:true}).count(),0);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(),1,'non-dismissible local workflow survives remote dialog changes');
    await page.getByRole('button',{name:'Concluir',exact:true}).click();
    await page.waitForFunction(()=>document.activeElement?.textContent==='Abrir');
    assert.deepEqual(errors,[]);
    console.log('PASS '+width+': settings/admin versions, conflict draft, central/support navigation, job polling, identity separation and dialog focus.');
    await context.close();
  }
} finally {await browser?.close();await rm(dir,{recursive:true,force:true});}

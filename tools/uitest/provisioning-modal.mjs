import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-provisioning-modal-'));
let browser;
try {
  await build({
    stdin: { contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {MemoryRouter, Routes, Route, useLocation} from 'react-router-dom';
      import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
      import {PlatformClientePage} from './src/pages/platform/PlatformClientePage';
      import {configurePlatformApi} from './src/lib/platform-api';
      configurePlatformApi({getAccessToken:()=> 'test-central',refresh:async()=>null,logout:async()=>{}});
      const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
      window.refresh=()=>qc.invalidateQueries(); window.queryClient=qc;
      function Detail(){window.navigationState=useLocation().state;return <PlatformClientePage/>;}
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[{pathname:'/platform/clients/client',state:window.created?{provisioningOperationIds:['production','staging']}:null}]}><Routes><Route path='/platform/clients/:id' element={<Detail/>}/></Routes></MemoryRouter></QueryClientProvider>);
    `, resolveDir: root, loader: 'tsx' },
    bundle: true, outfile: join(dir, 'app.js'), format: 'iife', platform: 'browser',
    tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' },
  });
  const css = (await Promise.all((await readdir(join(root,'dist/assets')))
    .filter(file=>file.endsWith('.css')).map(file=>readFile(join(root,'dist/assets',file),'utf8')))).join('\n');
  browser = await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  for (const width of [1280,375]) {
    const context = await browser.newContext({viewport:{width,height:width===375?812:900}});
    let statuses = {production:'running',staging:'running'}, retries = 0, reserved = false, created = false;
    const errors=[];
    function environment(purpose) {
      return {tenantId:purpose==='production'?'teste':'hml-teste',displayName:'Sistema de Governança Institucional',
        host:purpose==='production'?'teste.example.test':'hml-teste.example.test',purpose,operatingMode:'active',
        provisioningState:statuses[purpose]==='completed'?'ready':statuses[purpose],operationId:purpose,
        clientCanEditCredentials:false};
    }
    await context.route('https://platform.test/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(!path.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'});
      if(path.endsWith('/retry')) {retries++;statuses.staging='running';return route.fulfill({json:{status:'queued'}});}
      if(path.endsWith('/clients/client'))return route.fulfill({json:{id:'client',name:'Cliente de teste',status:'active',canManageClient:true,environments:reserved?[environment('production'),environment('staging')]:[],pendingOperations:reserved?[]:['production','staging'].map(purpose=>({operationId:purpose,target:'custom-'+purpose,purpose,host:environment(purpose).host,status:statuses[purpose]}))}});
      if(path.includes('/operations/')) {
        const purpose=path.split('/').at(-1),status=statuses[purpose];
        return route.fulfill({json:{operationId:purpose,type:'environment.provision',target:environment(purpose).tenantId,status,
          safeError:status==='failed'?'Verificação pendente.':null,steps:[{name:'binding-iis',status:status==='completed'?'completed':status,startedAt:null,completedAt:null,safeError:null}]}});
      }
      return route.fulfill({json:{items:[],internalUsers:1,externalUsers:0,productionEnvironments:1}});
    });
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
    async function open(){await page.goto('https://platform.test/');await page.evaluate(value=>window.created=value,created);await page.addStyleTag({content:css});await page.addScriptTag({path:join(dir,'app.js')});await page.getByTestId('platform-cliente-nome').waitFor();}
    async function inspect(name) {
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.equal(await page.getByRole('dialog').evaluate(element=>element.getBoundingClientRect().right<=innerWidth),true);
      if(!process.env.SKIP_SCREENSHOTS)await page.screenshot({path:join(tmpdir(),`septem-provisioning-${name}-${width}.png`),fullPage:true});
    }
    await open();
    const dialog=page.getByRole('dialog');await dialog.waitFor();await inspect('running');
    await dialog.getByText('Ambiente de produção',{exact:true}).waitFor();
    await dialog.getByText('Ambiente de homologação',{exact:true}).waitFor();
    assert.equal(await dialog.getByText('Sistema de Governança Institucional',{exact:true}).count(),0);
    assert.equal(await dialog.getByRole('button',{name:'Fechar',exact:true}).count(),0);
    await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);
    reserved=true;await page.evaluate(()=>window.refresh());assert.equal(await dialog.getByTestId('operacao-status').count(),2,'reservation preserves the same operation cards');
    statuses.production='completed';await page.evaluate(()=>window.refresh());
    const production=dialog.getByTestId('operacao-production');await production.getByText('Concluído',{exact:true}).waitFor();
    const productionLink=production.getByRole('link',{name:/Abrir ambiente/});
    assert.equal(await productionLink.getAttribute('href'),'https://teste.example.test');
    assert.equal(await productionLink.getAttribute('target'),'_blank');
    assert.match(await productionLink.getAttribute('rel'),/noopener/);
    assert.equal(await dialog.getByRole('button',{name:'Fechar',exact:true}).count(),0);
    statuses.staging='completed';await page.evaluate(()=>window.refresh());
    await dialog.getByTestId('operacao-staging').getByText('Concluído',{exact:true}).waitFor();
    assert.equal(await dialog.getByTestId('operacao-status').count(),2);
    assert.equal(await dialog.getByRole('link',{name:/Abrir ambiente/}).count(),2);
    await inspect('completed');await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
    await dialog.waitFor({state:'hidden'});await page.evaluate(()=>window.refresh());assert.equal(await dialog.count(),0);
    await open();await page.waitForFunction(()=>window.queryClient.getQueryState(['platform','operations','staging'])?.status==='success');
    assert.equal(await page.getByRole('dialog').count(),0,'completed client does not reopen a dismissed workflow on reload');
    created=true;await open();await dialog.waitFor();assert.equal(await dialog.getByRole('link',{name:/Abrir ambiente/}).count(),2,'fast completion still shows both new environments');
    await dialog.getByRole('button',{name:'Fechar',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.navigationState),null);created=false;
    statuses.staging='failed';await open();await dialog.waitFor();
    await dialog.getByTestId('operacao-staging').getByText('Falhou',{exact:true}).waitFor();
    await dialog.getByTestId('operacao-production').getByText('Concluído',{exact:true}).waitFor();
    await inspect('failed');await dialog.getByTestId('operacao-staging').getByRole('button',{name:'Retomar de onde parou'}).click();
    await dialog.getByTestId('operacao-staging').getByText('Provisionando…',{exact:true}).waitFor();
    assert.equal(retries,1);assert.equal(await dialog.getByRole('button',{name:'Fechar',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}: environment titles, retained completion, new-tab links, explicit dismissal, failure/retry and layout.`);
    await context.close();
  }
} finally {await browser?.close();await rm(dir,{recursive:true,force:true});}

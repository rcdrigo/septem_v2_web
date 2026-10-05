import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const root=resolve(import.meta.dirname,'../..');
const require=createRequire(root+'/package.json');
const {build}=require('esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const dir=await mkdtemp(join(tmpdir(),'septem-removal-ui-'));
const output=dir;
let browser;
try {
 await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client';
 import {MemoryRouter,Routes,Route} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
 import {PlatformClientePage} from './src/pages/platform/PlatformClientePage';import {PlatformClientesPage} from './src/pages/platform/PlatformClientesPage';import {configurePlatformApi} from './src/lib/platform-api';
 configurePlatformApi({getAccessToken:()=> 'test',refresh:async()=>null,logout:async()=>{}});
 const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});window.refresh=()=>qc.invalidateQueries();
 createRoot(document.getElementById('root')).render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={['/platform/clients/client']}><Routes><Route path='/platform/clients/:id' element={<PlatformClientePage/>}/><Route path='/platform/clients' element={<PlatformClientesPage/>}/></Routes></MemoryRouter></QueryClientProvider>);`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),format:'iife',platform:'browser',tsconfig:root+'/tsconfig.app.json',define:{'import.meta.env':'{}'}});
 const css=(await Promise.all((await readdir(root+'/dist/assets')).filter(f=>f.endsWith('.css')).map(f=>readFile(root+'/dist/assets/'+f,'utf8')))).join('\n');
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for (const width of [1280,375]) {
  const context=await browser.newContext({viewport:{width,height:width===375?812:900}});
  let status='active',opStatus='running',requests=0,retries=0,previewFailed=false,scoped=false;
  const environments=[{tenantId:'prefeitura',host:'prefeitura.example.test',databaseName:'prefeitura',displayName:'Sistema',purpose:'production',operatingMode:'active',provisioningState:'ready',clientCanEditCredentials:false},
   {tenantId:'hml-prefeitura',host:'hml-prefeitura.example.test',databaseName:'prefeitura_hml',displayName:'Sistema',purpose:'staging',operatingMode:'active',provisioningState:'ready',clientCanEditCredentials:false}];
  const name='Prefeitura Municipal de Jaboatão dos Guararapes';
  await context.route('https://platform.test/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(!path.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="padding:20px"><div id="root"></div></body></html>'});
   if(path.endsWith('/removal-preview'))return previewFailed?route.fulfill({status:503,json:{detail:'Falha de consulta'}}):route.fulfill({json:{clientName:name,confirmationToken:'reviewed',warning:'A remoção é definitiva: apaga os bancos de todos os ambientes, processos, usuários, documentos e arquivos do cliente; remove os recursos exclusivos na AWS, DNS e IIS e revoga os acessos. Não há desfazer. Faça e valide os backups antes de continuar. Uma falha pode deixar a limpeza parcial; retome a mesma operação até concluir.',environments}});
   if(path.endsWith('/remove')) {
    requests++;assert.deepEqual(req.postDataJSON(),{confirmName:name,risksAcknowledged:true,confirmationToken:'reviewed'});
    status='removing';return route.fulfill({status:202,json:{operationId:'remove-operation',status:'queued'}});
   }
   if(path.endsWith('/remove-operation/retry')) {retries++;opStatus='running';return route.fulfill({status:202,json:{operationId:'remove-operation',status:'queued'}});}
   if(path.includes('/operations/'))return route.fulfill({json:{operationId:'remove-operation',type:'client.remove',status:opStatus,safeError:opStatus==='failed'?'Não foi possível remover o DNS. Confira a zona e retome.':null,steps:[{name:'inventariar-recursos',status:'completed'},{name:'iis-42',status:'completed'},{name:'dns-42',status:opStatus==='failed'?'failed':opStatus==='completed'?'completed':'running'}]}});
   if(path.endsWith('/clients/'))return route.fulfill({json:{items:status==='removed'?[]:[{id:'client',name,status,createdAt:'2026-10-05',environments:2}],total:status==='removed'?0:1}});
   if(path.endsWith('/clients/client'))return status==='removed'?route.fulfill({status:404,json:{}}):route.fulfill({json:{id:'client',name,status,canManageClient:!scoped,environments,pendingOperations:[],removalOperationId:status==='removing'?'remove-operation':null}});
   return route.fulfill({json:{items:[],internalUsers:1,externalUsers:0,productionEnvironments:1}});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function open(){await page.goto('https://platform.test/');await page.addStyleTag({content:css});await page.addScriptTag({path:join(dir,'app.js')});}
  await open();await page.getByTestId('remover-cliente').click();
  const confirm=page.getByTestId('confirmar-remocao-cliente');await confirm.waitFor();
  assert.equal(await confirm.isDisabled(),true);
  await page.getByTestId('nome-confirmacao-remocao').fill('outro cliente');await page.getByTestId('aceitar-riscos-remocao').check();assert.equal(await confirm.isDisabled(),true);
  await page.getByTestId('nome-confirmacao-remocao').fill(name);assert.equal(await confirm.isEnabled(),true);
  await page.getByTestId('aceitar-riscos-remocao').uncheck();assert.equal(await confirm.isDisabled(),true);
  await page.screenshot({path:output+`/client-removal-confirmation-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(requests,0);
  await page.getByTestId('remover-cliente').click();assert.equal(await page.getByTestId('nome-confirmacao-remocao').inputValue(),'');
  await page.getByTestId('nome-confirmacao-remocao').fill(name);await page.getByTestId('aceitar-riscos-remocao').check();await confirm.click();
  await page.getByRole('heading',{name:'Removendo cliente',exact:true}).waitFor();assert.equal(requests,1);
  opStatus='failed';await page.evaluate(()=>window.refresh());await page.getByRole('heading',{name:'Remoção interrompida'}).waitFor();
  await page.screenshot({path:output+`/client-removal-failure-${width}.png`,fullPage:true});
  await page.getByTestId('retomar-remocao-cliente').click();await page.getByRole('heading',{name:'Removendo cliente',exact:true}).waitFor();assert.equal(retries,1);assert.equal(requests,1);
  await open();await page.getByTestId('progresso-remocao-cliente').waitFor();assert.equal(await page.getByTestId('remover-cliente').count(),0);
  await page.getByRole('link',{name:'Voltar à lista de clientes'}).click();await page.getByText('Removendo',{exact:true}).waitFor();
  opStatus='completed';status='removed';await page.getByTestId('platform-clientes-vazio').waitFor();await open();await page.evaluate(()=>window.refresh());await page.getByRole('heading',{name:'Cliente removido',exact:true}).waitFor();assert.equal(await page.getByTestId('platform-cliente-404').count(),0);
  await page.getByRole('link',{name:'Voltar à lista de clientes'}).click();await page.getByRole('heading',{name:'Clientes',exact:true}).waitFor();
  await page.evaluate(()=>sessionStorage.clear());status='active';scoped=true;await open();await page.getByTestId('platform-cliente-nome').waitFor();assert.equal(await page.getByTestId('remover-cliente').count(),0);
  scoped=false;previewFailed=true;await open();await page.getByTestId('remover-cliente').click();await page.getByText('Não foi possível conferir os ambientes para remoção.').waitFor();assert.equal(await confirm.isDisabled(),true);
  previewFailed=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.getByTestId('nome-confirmacao-remocao').waitFor();
  assert.deepEqual(errors,[]);console.log(`UI ${width}px: confirmação, cancelamento, falha, retomada, atualização, conclusão e escopo aprovados`);
  await context.close();
 }
} finally {await browser?.close();await rm(dir,{recursive:true,force:true});}

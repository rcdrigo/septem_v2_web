import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const out=await mkdtemp(join(tmpdir(),'septem-standby-ui-'));
const css=(await readdir(join(root,'dist/assets'))).find(name=>name.endsWith('.css'));
await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {InstanceReport,InstanciasPage} from './src/pages/InstanciasPage';import {TaskView} from './src/pages/TarefasPage';
import {useSessionStore} from './src/stores/session';
useSessionStore.setState({status:'authenticated',accessToken:'fixture',accessMode:'interno',user:{id:'actor',name:'Ana',email:'ana@example.test',isInternal:true,perms:['*'],accessProfiles:[]}});
const root=createRoot(document.getElementById('root'));let revision=0;
window.mount=kind=>root.render(<QueryClientProvider key={++revision} client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter>{kind==='task'?<TaskView taskId="blocked-task" onClose={()=>{}}/>:kind==='list'?<InstanciasPage/>:<InstanceReport id="instance"/>}</MemoryRouter></QueryClientProvider>);
`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(out,'app.js'),platform:'browser',format:'iife',tsconfig:join(root,'tsconfig.app.json'),loader:{'.css':'empty'},define:{'import.meta.env':'{}'}});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const base={id:'instance',number:184,process:'Análise de licença',requester:'Maria',status:'em_andamento',startedAt:'2026-10-20T12:00:00Z',endedAt:null,data:{assunto:'Licença de funcionamento'},formSchema:{components:[{type:'textfield',key:'assunto',label:'Assunto'}]},activeTask:{name:'Analisar documentação',assignee:'Ana',startedAt:'2026-10-20T12:00:00Z',dueAt:'2026-11-10T12:00:00Z'},tasks:[],tags:[],actions:[],canFreeze:true,canUnfreeze:false,canCancel:false,canEdit:false,messages:{count:0,canPost:false}};
try {
 for(const width of [1280,375]) {
  const page=await browser.newPage({viewport:{width,height:950}});page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let detail=structuredClone(base);const calls=[];
  await page.route('http://standby.local/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(!path.startsWith('/api/')) return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><div id="root"></div>'});
   if(path==='/api/v1/workflow/instances/instance/freeze'||path==='/api/v1/workflow/instances/instance/unfreeze') {
    calls.push({path,body:req.postDataJSON()});const frozen=path.endsWith('/freeze');
    detail={...detail,isFrozen:frozen,frozenAt:frozen?'2026-10-30T12:00:00Z':null,canFreeze:!frozen,canUnfreeze:frozen};
    return route.fulfill({json:{}});
   }
   if(path==='/api/v1/workflow/instances/instance') return route.fulfill({json:detail});
   if(path.includes('/tasks/blocked-task')) return route.fulfill({status:409,json:{error:'execution_frozen',detail:'A requisição está congelada.'}});
   if(path==='/api/v1/workflow/tasks') return route.fulfill({json:{items:[],total:0,processes:[]}});
   if(path==='/api/v1/workflow/instances') return route.fulfill({json:{items:[{...detail,pendingTasks:0}],total:1,page:1,pageSize:20}});
   if(path.endsWith('/tags')) return route.fulfill({json:{items:[],tags:[]}});
   return route.fulfill({json:[]});
  });
  await page.goto('http://standby.local/');
  await page.addStyleTag({content:await readFile(join(root,'dist/assets',css),'utf8')});
  await page.addScriptTag({path:join(out,'app.js')});
  await page.evaluate(()=>window.mount('report'));
  await page.getByRole('heading',{name:'Requisição nº 184',exact:true}).waitFor();
  await page.getByRole('button',{name:'Ações',exact:true}).click();
  await page.getByTestId('acao-freeze').click();
  await page.getByTestId('acao-confirmar').click();
  assert.equal(calls.length,0,'Sem justificativa não deve enviar operação');
  await page.getByText('Informe a justificativa.',{exact:true}).waitFor();
  await page.getByTestId('acao-justificativa').fill('Aguardar documentação complementar.');
  await page.getByTestId('acao-confirmar').click();
  await page.getByText('Congelada',{exact:true}).waitFor();
  assert.equal(calls[0].body.justification,'Aguardar documentação complementar.');
  await page.getByRole('heading',{name:'Processo congelado',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Abrir tarefa',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Relatório ${width}: overflow`);
  await page.screenshot({path:join(out,`report-frozen-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Ações',exact:true}).click();
  assert.equal(await page.getByTestId('acao-freeze').count(),0);
  await page.getByTestId('acao-unfreeze').click();
  await page.getByTestId('acao-justificativa').fill('Documentação recebida.');
  await page.getByTestId('acao-confirmar').click();
  await page.getByText('Em andamento',{exact:true}).waitFor();
  assert.ok(calls[1].path.endsWith('/unfreeze'));

  detail={...base,canFreeze:false,canUnfreeze:false};
  await page.evaluate(()=>window.mount('report'));
  await page.getByRole('heading',{name:'Requisição nº 184',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Ações',exact:true}).count(),0,'Sem capacidade não deve oferecer a ação');
  detail={...detail,status:'concluido',customStatus:'Deferida após análise técnica',endedAt:'2026-10-29T12:00:00Z'};
  await page.evaluate(()=>window.mount('report'));
  await page.getByText('Deferida após análise técnica',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Processo concluído',exact:true}).waitFor();
  await page.evaluate(()=>window.mount('list'));
  await page.getByRole('heading',{name:'Deferida após análise técnica',exact:true}).waitFor();
  await page.evaluate(()=>window.mount('task'));
  await page.getByRole('heading',{name:'Requisição congelada',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Concluir',exact:true}).count(),0);
  assert.equal(await page.getByLabel('Assunto',{exact:true}).count(),0);
  await page.screenshot({path:join(out,`task-blocked-${width}.png`),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${width}px ações/permissões/justificativa/status/relatório/tarefa bloqueada`);
  await page.close();
 }
 console.log(`Artefatos: ${out}`);
} finally {await browser.close();}

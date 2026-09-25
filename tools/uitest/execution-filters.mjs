// npm run build && node tools/uitest/execution-filters.mjs
// Componentes reais e respostas controladas: contrato da URL, acessibilidade e layout.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../..');
const out=await mkdtemp(join(tmpdir(),'septem-execution-filters-'));
await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createMemoryRouter,RouterProvider,useLocation,useNavigate} from 'react-router-dom';
import {TarefasPage} from './src/pages/TarefasPage';import {InstanciasPage} from './src/pages/InstanciasPage';
import {useSessionStore} from './src/stores/session';
const root=createRoot(document.getElementById('root'));let revision=0;
function Probe(){window.currentSearch=useLocation().search;window.navigate=useNavigate();return null;}
window.mount=(kind,mode='interno',search='')=>{
useSessionStore.setState({status:'authenticated',accessToken:'fixture',accessMode:mode,user:{id:'actor',name:'Ana',email:'ana@example.test',isInternal:true,perms:['*'],hasDashboard:false,accessProfiles:[]}});
root.render(<QueryClientProvider key={++revision} client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RouterProvider router={createMemoryRouter([{path:'*',element:<><Probe/>{kind==='tasks'?<TarefasPage/>:<InstanciasPage/>}</>}],{initialEntries:['/'+search]})}/></QueryClientProvider>);};`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(out,'bundle.js'),format:'iife',platform:'browser',tsconfig:join(root,'tsconfig.app.json'),loader:{'.css':'empty'},define:{'import.meta.env':'{}'}});
const processes=[{key:'compras',name:'Compras de materiais',count:3},{key:'licenca',name:'Licenciamento ambiental',count:2}];
const tagNames=[{name:'Urgente',count:2,available:true},{name:'Revisão',count:1,available:true}];
const task={id:'task-1',executionId:'exec-1',name:'Conferir documentos',process:'Compras de materiais',processKey:'compras',processNumber:184,requester:'Maria Almeida',inboxText:'Solicitação de material para as unidades administrativas.',createdAt:'2026-09-20T12:00:00Z',dueAt:null};
const request={...task,id:'exec-1',number:184,status:'em_andamento',startedAt:task.createdAt,endedAt:null,pendingTasks:1};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const width of [320,375,1280]) {
  const height=width===320?640:900;
  const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(8000);
  const errors=[];const calls=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://filters.test/**',async route=>{
   const url=new URL(route.request().url());
   if(!url.pathname.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
   calls.push(url);
   const empty=url.searchParams.get('q')==='inexistente';
   const facets={processes:empty?[]:processes,tagNames:empty?[]:tagNames};
   const body=url.pathname.endsWith('/tasks')?{items:empty?[]:[task],...facets}:url.pathname.endsWith('/instances')?{items:empty?[]:[request],total:empty?0:1,page:1,pageSize:20,...facets}:{};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('https://filters.test/');
  for(const file of (await readdir(join(root,'dist/assets'))).filter(f=>f.endsWith('.css')))await page.addStyleTag({content:await readFile(join(root,'dist/assets',file),'utf8')});
  await page.addStyleTag({content:'html,body,#root{height:100%;margin:0}'});await page.addScriptTag({path:join(out,'bundle.js')});
  const popup=page.getByTestId('painel-filtros');
  const category=async label=>{
   if(width<640&&await popup.getByRole('button',{name:'Todos os filtros',exact:true}).isVisible())await popup.getByRole('button',{name:'Todos os filtros',exact:true}).click();
   await popup.getByRole('navigation').getByRole('button',{name:label,exact:true}).click();
  };
  const query=async()=>new URLSearchParams(await page.evaluate(()=>window.currentSearch));
  for(const kind of ['tasks','requests']){
   calls.length=0;await page.evaluate(kind=>window.mount(kind),kind);await page.locator('article').first().waitFor();
   // ⚠️ CONFLITO DE INTENÇÃO, registrado em doc/plano_26_09/PENDENCIAS.md (§8) para o dono
   // decidir: esta linha fixava que a caixa "Concluídas" das Tarefas havia sido REMOVIDA.
   // Ela voltou, porque o histórico do que o usuário concluiu ficou sem porta alguma (a
   // `TarefasExecutadasPage` está sem rota) enquanto o backend continua servindo
   // `status=concluida`. O switcher usa `caixa=`, não `status=`, então o contrato de que
   // `status` é parâmetro morto — medido algumas linhas abaixo — segue valendo.
   assert.equal(await page.getByRole('button',{name:'Concluídas',exact:true}).count(),kind==='tasks'?1:0,
    'Tarefas têm o switcher Pendentes/Concluídas; Requisições não');
   if(kind==='requests'){assert.equal(calls.find(u=>u.pathname.endsWith('/instances')).searchParams.get('scope'),'personal');assert.equal((await query()).get('status'),null);}
   const trigger=page.getByTestId('abrir-filtros');const box=await trigger.boundingBox();assert.ok(box.x<30,'Filtros à esquerda');assert.ok(box.height<=32,'Botão compacto');
   await trigger.click();await popup.waitFor();await category('Processos');
   await popup.getByLabel('Compras de materiais',{exact:false}).check();await popup.getByLabel('Licenciamento ambiental',{exact:false}).check();
   assert.deepEqual((await query()).getAll('processes'),['compras','licenca']);assert.equal(await trigger.textContent(),'Filtros1');
   assert.ok((await page.getByRole('button',{name:/Editar filtro Processos:/}).boundingBox()).height<=32,'Chip compacto');
   await category('Tags');await popup.getByLabel('Urgente',{exact:false}).check();await popup.getByLabel('Revisão',{exact:false}).check();
   assert.equal(await trigger.textContent(),'Filtros2');assert.deepEqual((await query()).getAll('tagNames'),['Urgente','Revisão']);
   await category(kind==='tasks'?'Data de recebimento':'Data de encerramento');await popup.getByRole('button',{name:'Últimos 7 dias',exact:true}).click();
   assert.ok((await query()).get(kind==='tasks'?'receivedFrom':'endedFrom'));
   if(kind==='requests'){
    await category('Meu vínculo');await popup.getByLabel('Feitas por mim',{exact:true}).uncheck();assert.equal((await query()).get('relationship'),'participant');
    await category('Situação');await popup.getByLabel('Concluídas',{exact:true}).check();assert.equal((await query()).get('status'),'concluido');
   }
   await category('Processos');await page.screenshot({path:join(out,`${kind}-${width}.png`)});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Sem overflow horizontal');
   const bounds=await popup.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height,'Popover contido no viewport');
   await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'Escape devolve foco');
   await page.getByRole('button',{name:/Editar filtro Processos:/}).click();await popup.waitFor();await popup.getByRole('heading',{name:'Processos',exact:true}).waitFor();
   await category('Palavra-chave');await popup.getByTestId('filtro-q').fill('inexistente');await page.keyboard.press('Escape');
   await page.getByText('Uma seleção não possui resultados disponíveis.',{exact:false}).waitFor();
   assert.deepEqual((await query()).getAll('processes'),['compras','licenca'],'Seleções sem resultados preservadas');
   await page.getByTestId('limpar-filtros').click();await page.locator('article').first().waitFor();
   const cleared=await query();assert.equal(cleared.get('q'),null);assert.equal(cleared.get('processes'),null);assert.equal(cleared.get('relationship'),null);assert.equal(cleared.get('status'),null);
   // Voltar restaura filtros e chips sem estado oculto no editor.
   await page.evaluate(()=>window.navigate(-1));await page.getByRole('button',{name:/Editar filtro Processos:/}).waitFor();
  }
  await page.evaluate(()=>window.mount('tasks','externo','?status=concluidas&tagNames=Urgente'));await page.locator('article').first().waitFor();
  assert.equal((await query()).get('status'),null);await page.getByTestId('abrir-filtros').click();assert.equal(await popup.getByRole('button',{name:'Tags',exact:true}).count(),0,'Tags não expostas em modo externo');
  const lastTask=calls.filter(u=>u.pathname.endsWith('/tasks')).at(-1);assert.equal(lastTask.searchParams.get('assignee'),'me');assert.equal(lastTask.searchParams.get('status'),null);assert.equal(lastTask.searchParams.get('tagNames'),null);
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${width}: filtros, chips, URL, datas, vínculos, teclado e permissões`);
 }
} finally {await browser.close();}
console.log(`Capturas: ${out}`);

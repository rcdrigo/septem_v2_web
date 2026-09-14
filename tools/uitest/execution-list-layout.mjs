// npm run build && node tools/uitest/execution-list-layout.mjs
// Componentes reais, API simulada: layout e ações secundárias sem alterar dados.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const out = await mkdtemp(join(tmpdir(), 'septem-execution-layout-'));
await build({ stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {TarefasPage} from './src/pages/TarefasPage';
import {InstanciasPage} from './src/pages/InstanciasPage';
import {useSessionStore} from './src/stores/session';
const root=createRoot(document.getElementById('root'));
let revision=0;
window.opened=[];
window.open=(url)=>{window.opened.push(url);return null;};
window.mount=(kind,mode='interno',status='pendentes')=>{
 useSessionStore.setState({status:'authenticated',accessToken:'fixture',accessMode:mode,user:{id:'actor',name:'Ana',email:'ana@example.test',isInternal:true,perms:['*'],hasDashboard:false,accessProfiles:[]}});
 root.render(<QueryClientProvider key={++revision} client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/?status='+ (kind==='tasks'?status:'em_andamento')]}>{kind==='tasks'?<TarefasPage/>:<InstanciasPage/>}</MemoryRouter></QueryClientProvider>);
};`, resolveDir: root, loader:'tsx'},bundle:true,outfile:join(out,'bundle.js'),format:'iife',platform:'browser',tsconfig:join(root,'tsconfig.app.json'),loader:{'.css':'empty'},define:{'import.meta.env':'{}'}});
const tags=Array.from({length:8},(_,i)=>({id:`tag-${i}`,name:`Classificação ${i+1}`,addedBy:{id:'actor',name:'Ana'},addedAt:'2026-09-14T10:00:00Z'}));
const task={id:'task-1',executionId:'exec-1',name:'Analisar documentação da contratação',process:'Contratação de serviços especializados para manutenção de equipamentos',processNumber:184,requester:'Maria Aparecida de Albuquerque e Vasconcelos',inboxText:'Solicitação de contratação de serviços de manutenção preventiva e corretiva dos equipamentos das unidades administrativas. Inclui avaliação técnica, levantamento de peças e parecer sobre a disponibilidade orçamentária. '.repeat(3),createdAt:'2026-09-10T10:00:00Z',dueAt:'2026-09-12T10:00:00Z',completedAt:'2026-09-14T10:00:00Z',isTest:true,absentUserName:'João Henrique de Albuquerque e Vasconcelos',tags};
const request={...task,id:'exec-1',number:184,status:'em_andamento',startedAt:task.createdAt,endedAt:null,pendingTasks:2};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const width of [320,375,414,768,1280]) {
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<768});
  page.setDefaultTimeout(6000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://layout.test/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(!path.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
   let body={};
   if(path.endsWith('/tasks'))body={items:[task,{...task,id:'task-2',executionId:'exec-2',processNumber:185,name:'Conferir solicitação',isTest:false,absentUserName:null,tags:[],dueAt:null,inboxText:null}],processes:[]};
   if(path.endsWith('/instances'))body={items:[request,{...request,id:'exec-2',number:185,status:'concluido',endedAt:'2026-09-14T10:00:00Z',isTest:false,tags:[]}],total:2,page:1,pageSize:20};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('https://layout.test/');
  for(const file of (await readdir(join(root,'dist/assets'))).filter(f=>f.endsWith('.css')))await page.addStyleTag({content:await readFile(join(root,'dist/assets',file),'utf8')});
  await page.addStyleTag({content:'html,body,#root {height:100%;margin:0}'});
  await page.addScriptTag({path:join(out,'bundle.js')});
  for(const kind of ['tasks','requests']) {
   await page.evaluate(kind=>window.mount(kind),kind);
   const card=page.locator('article').first();await card.waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${kind} ${width}: overflow da página`);
   const summary=card.locator('p.line-clamp-3');
   assert.ok(await summary.evaluate(el=>el.clientHeight<=3*parseFloat(getComputedStyle(el).lineHeight)), 'Resumo excede 3 linhas');
   assert.equal(await page.locator('article').nth(1).locator('[aria-label="Indicadores e tags"]').count(),0,'Rodapé vazio não deve aparecer');
   const number=card.getByRole('button',{name:'Acompanhar requisição #184',exact:true});
   await page.evaluate(()=>window.opened=[]);await number.focus();await page.keyboard.press('Enter');
   assert.deepEqual(await page.evaluate(()=>window.opened),['/requests/exec-1'],'Número deve abrir só requisição');
   await page.evaluate(()=>window.opened=[]);
   const right=card.getByRole('button',{name:'Rolar tags para a direita'});await right.waitFor();
   await right.focus();await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('article [class*="overflow-x-auto"]').scrollLeft>0);
   assert.deepEqual(await page.evaluate(()=>window.opened),[],'Seta não deve abrir card');
   assert.equal(await card.locator('[class*="overflow-x-auto"]').evaluate(el=>getComputedStyle(el).scrollbarWidth),'none');
   if(kind==='tasks') {
    const due=card.locator('button[aria-describedby^="deadline-"]');await due.focus();await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(()=>window.opened),[],'Prazo não deve abrir tarefa');
    await page.locator('[data-testid="due-popover"]').waitFor();
    const footer=card.locator('.task-card-deadline').locator('..');
    assert.ok(await footer.evaluate(el=>{const [left,right]=el.children;return left.getBoundingClientRect().right<=right.getBoundingClientRect().left;}),'Requisitante não deve sobrepor prazo');
    assert.equal(await card.getByTitle('Ausência temporária: '+task.absentUserName,{exact:true}).count(),1);
   }
   await card.focus();await page.keyboard.press('Enter');
   assert.deepEqual(await page.evaluate(()=>window.opened),[kind==='tasks'?'/tasks/task-1':'/requests/exec-1']);
   await page.mouse.move(width-1,899);await page.locator('h1').click();await card.hover();
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.task-card-access')).opacity==='1');
   await page.screenshot({path:join(out,`${kind}-${width}.png`)});
   await page.getByTitle('Tabela',{exact:true}).click();
   if(width>=768){
    const row=page.locator('tbody tr:visible').first();await row.waitFor();
    await page.evaluate(()=>window.opened=[]);await row.getByRole('button',{name:'Acompanhar requisição #184'}).click();
    assert.deepEqual(await page.evaluate(()=>window.opened),['/requests/exec-1']);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:join(out,`${kind}-table-${width}.png`)});
   }else assert.ok(await card.isVisible(),'Mobile deve manter cards');
   await page.getByTitle('Cards',{exact:true}).click();
  }
  await page.evaluate(()=>window.mount('tasks','externo'));
  await page.locator('article').first().waitFor();
  assert.equal(await page.getByRole('button',{name:/Classificação/}).count(),0,'Tags ocultas no modo externo');
  assert.equal(await page.locator('article [data-testid="selo-teste"]').count(),1,'Teste independe de acesso a tags');
  await page.evaluate(()=>window.mount('tasks','interno','concluidas'));
  await page.getByText('Concluída com 2 dias de atraso',{exact:true}).first().waitFor();
  assert.deepEqual(errors,[],`Erros React: ${width}`);
  await page.close();console.log(`PASS ${width}: cards, tabela, navegação, rodapé e ausência condicional`);
 }
}finally{await browser.close();}
console.log(`Capturas: ${out}`);

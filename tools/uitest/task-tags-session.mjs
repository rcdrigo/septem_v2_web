// Regressão da tarefa aberta em nova aba: token persistido, sessão ainda não carregada.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-task-tags-session-'));
await build({ stdin: {contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {TarefaPage} from './src/pages/TarefaPage';
import {useSessionStore} from './src/stores/session';
window.sessionState=()=>({status:useSessionStore.getState().status,userLoaded:!!useSessionStore.getState().user});
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
<MemoryRouter initialEntries={['/tasks/task-1']}><Routes><Route path="/tasks/:taskId" element={<TarefaPage/>}/></Routes></MemoryRouter>
</QueryClientProvider>);
`, resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'bundle.js'),format:'iife',platform:'browser',tsconfig:join(root,'tsconfig.app.json'),loader:{'.css':'empty'},define:{'import.meta.env':'{}'}});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const failures=[];
try {
  for(const width of [1280,375]) {
    const page=await browser.newPage({viewport:{width,height:850}});
    page.setDefaultTimeout(4000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let meCalls=0;
    await page.route('https://task-session.test/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(!path.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
      let body={};
      if(path==='/api/tenant/config')body={tenantId:'test',clienteNome:'Teste',ambienteNome:'Teste',primaryColor:'#123456',modulos:[]};
      if(path==='/api/v1/me'){meCalls++;body={id:'actor',name:'Ana',email:'ana@example.test',isInternal:true,perms:['*'],hasDashboard:false,accessProfiles:[]};}
      if(path.endsWith('/tasks/task-1'))body={id:'task-1',executionId:'exec-1',name:'Analisar compra',process:'Compras',status:'pendente',formSchema:{components:[]},data:{},buttons:[]};
      if(path.endsWith('/tags'))body={executionRevision:0,catalogRevision:0,flowKey:'compras',catalog:[{id:'tag-1',name:'Urgente'}],tags:[{id:'tag-1',name:'Urgente',addedBy:{id:'actor',name:'Ana'},addedAt:'2026-09-14T10:00:00Z'}]};
      await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto('https://task-session.test/');
    await page.evaluate(()=>localStorage.setItem('septem.accessToken','fixture-only'));
    for(const css of (await readdir(join(root,'dist/assets'))).filter(f=>f.endsWith('.css'))){await page.addStyleTag({content:await readFile(join(root,'dist/assets',css),'utf8')});}
    await page.addScriptTag({path:join(dir,'bundle.js')});
    await page.getByRole('heading',{name:'Analisar compra',exact:true}).waitFor();
    if(width<640)await page.getByRole('button',{name:'Botões de conclusão',exact:true}).click();
    try {
      await page.getByRole('button',{name:'Tags',exact:true}).waitFor({state:'visible'});
      console.log(`PASS ${width}: botão Tags visível na tarefa aberta em nova aba`);
      await page.getByRole('button',{name:'Tags',exact:true}).click();
      await page.getByRole('button',{name:'Excluir tag do processo: Urgente',exact:true}).click();
      await page.getByRole('heading',{name:'Excluir tag do processo?',exact:true}).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog',{name:'Tags da execução',exact:true}).waitFor();
      console.log(`PASS ${width}: confirmação de exclusão disponível sem sair da tarefa`);
    }catch{
      const state=await page.evaluate(()=>window.sessionState());
      const failure=`FAIL ${width}: Tags ou confirmação ausente; sessão=${state.status}; usuário carregado=${state.userLoaded}; consultas /me=${meCalls}`;
      console.log(failure);failures.push(failure);
    }
    assert.deepEqual(errors,[],`Erros React em ${width}`);
    await page.close();
  }
}finally{await browser.close();}
assert.equal(failures.length,0,failures.join('\n'));

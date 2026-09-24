// Componentes reais com API simulada: não altera execuções ou dados de um ambiente.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, writeFile, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-tags-test-'));
await build({ stdin: { contents: `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TagsButton, TagPills, ProcessTagHistory } from './src/components/tags';
import { TarefasPage, TaskView } from './src/pages/TarefasPage';
import { ConfirmDialogHost } from './src/components/ui/ConfirmDialog';
import { useSessionStore } from './src/stores/session';
const root = createRoot(document.getElementById('root'));
let revision = 0;
window.mount = (kind = 'tags', mode = 'interno', internal = true, url = '/') => {
  useSessionStore.setState({ status: 'authenticated', accessToken: 'fixture', accessMode: mode,
    user: {id:'actor', name:'Ana', email:'ana@example.test', isInternal:internal, perms:['*'], hasDashboard:false, accessProfiles:[]} });
  const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  flushSync(() => root.render(<QueryClientProvider key={++revision} client={client}><MemoryRouter initialEntries={[url]}>
    {kind === 'task' ? <TaskView taskId="task-1" onClose={()=>window.taskClosed=true}/> : kind === 'tasks' ? <TarefasPage/> : kind === 'history' ? <ProcessTagHistory processKey="compras"/> : <>
      <TagsButton executionId="exec-1"/>
      <div role="link" style={{maxWidth:320}} onClick={()=>window.cardOpened=true} onKeyDown={()=>window.cardOpened=true}>
        <TagPills tags={kind==='light' ? [{id:'tag-1',name:'Urgente',color:'#ffffff',addedBy:{id:'actor',name:'Ana'},addedAt:'2026-09-14T10:00:00Z'}] : kind==='overflow' ? Array.from({length:15},(_,i)=>({id:'tag-'+i,name:'Classificação '+i,addedBy:{id:'actor',name:'Ana'},addedAt:'2026-09-14T10:00:00Z'})) : [{id:'tag-1',name:'Urgente',color:'#000000',addedBy:{id:'actor',name:'Ana'},addedAt:'2026-09-14T10:00:00Z'}]}/>
      </div>
    </>}
    <ConfirmDialogHost/>
  </MemoryRouter></QueryClientProvider>));
};
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'bundle.js'), format: 'iife', platform: 'browser', tsconfig: join(root, 'tsconfig.app.json'), loader: {'.css':'empty'}, define: {'import.meta.env':'{}'} });

const snapshot = () => ({executionRevision:0,catalogRevision:0,flowKey:'compras',catalog:[{id:'tag-1',name:'Urgente',color:'#000000'},{id:'tag-2',name:'Financeiro',color:'#0ea5e9'}],tags:[{id:'tag-1',name:'Urgente',color:'#000000',addedBy:{id:'actor',name:'Ana'},addedAt:'2026-09-14T10:00:00Z'}]});
const history = {items:[{id:'event-3',action:'recolored',tagId:'tag-1',tagName:'Urgente',previousColor:'#ffffff',color:'#000000',occurredAt:'2026-09-14T12:00:00Z',actor:{id:'actor',name:'Ana'}},{id:'event-2',action:'renamed',tagId:'tag-1',tagName:'Urgente',previousName:'Prioritário',occurredAt:'2026-09-14T11:00:00Z',actor:{id:'actor',name:'Ana'},operator:{id:'op',name:'Operador'}},{id:'event-1',action:'created',tagId:'tag-1',tagName:'Prioritário',occurredAt:'2026-09-14T09:00:00Z',actor:{id:'actor',name:'Ana'}}]};
const browser = await chromium.launch({executablePath:process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const calls=[];let current=snapshot(),conflict=false;
  await page.route('https://tags.test/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(!url.pathname.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
    calls.push({url:req.url(),method:req.method(),body:req.postDataJSON(),headers:req.headers()});
    let body={};let status=200;
    if(url.pathname.endsWith('/tags/history'))body=history;
    else if(url.pathname.endsWith('/tags')) {
      body=current;
      if(req.method()==='PUT') {
        if(conflict){status=409;body={title:'Conflito',detail:'As tags foram alteradas por outro usuário.',current:{...current,catalogRevision:1}};}
        else {current={...current,executionRevision:current.executionRevision+1};body=current;}
      }
    } else if(url.pathname.endsWith('/tasks/task-1'))body={id:'task-1',executionId:'exec-1',name:'Analisar compra',process:'Compras',status:'pendente',formSchema:{components:[]},data:{},buttons:[]};
    else if(url.pathname.endsWith('/tasks')) body={items:[],processes:[{key:'compras',name:'Compras',count:1}],tagNames:[{name:'Urgente',count:1,available:true},{name:'Financeiro',count:1,available:true}]};
    else if(url.pathname.endsWith('/summary'))body={pendingCount:0};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('https://tags.test/');
  const styles=(await readdir(join(root,'dist/assets'))).filter(name=>name.endsWith('.css'));
  assert.ok(styles.length,'Execute npm run build antes deste teste para validar também o layout.');
  for(const name of styles)await page.addStyleTag({content:await readFile(join(root,'dist/assets',name),'utf8')});
  await page.addScriptTag({path:join(dir,'bundle.js')});
  const mount=(...args)=>page.evaluate(args=>window.mount(...args),args);
  const check=(label,actual,expected)=>{assert.deepEqual(actual,expected,label);results.push(label);console.log(label);};

  await mount('tags','externo',true);
  check('modo externo oculta tags',await page.getByRole('button',{name:'Tags',exact:true}).count(),0);
  await mount('history','interno',false);
  check('usuário externo não consulta histórico',calls.length,0);
  await mount('tags');
  await page.getByRole('button',{name:'Tags',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('region',{name:/Associadas a esta execução/}).getByText('Urgente',{exact:true}).waitFor();
  await page.getByRole('region',{name:/Disponíveis no processo/}).getByText('Financeiro',{exact:true}).waitFor();
  check('leitura envia modo interno',calls.find(c=>c.url.endsWith('/tags'))?.headers['x-access-mode'],'interno');
  const editor=()=>page.getByRole('dialog',{name:'Tags da execução',exact:true});
  const openEditor=async()=>{await page.getByRole('button',{name:'Tags',exact:true}).click();await page.getByLabel('Nome da tag',{exact:true}).waitFor();};
  const writes=()=>calls.filter(c=>c.method==='PUT');
  await page.getByLabel('Nome da tag',{exact:true}).fill(' financeiro ');
  await editor().getByRole('button',{name:'Adicionar',exact:true}).click();
  check('editar não grava antes de salvar',writes().length,0);
  await editor().getByRole('button',{name:'Cancelar',exact:true}).click();
  check('cancelar modal não grava',writes().length,0);
  await openEditor();
  await page.getByLabel('Nome da tag',{exact:true}).fill(' financeiro ');
  await editor().getByRole('button',{name:'Adicionar',exact:true}).click();
  await editor().getByRole('button',{name:'Salvar tags',exact:true}).click();
  await editor().waitFor({state:'hidden'});
  check('nome existente reutiliza tag',writes().at(-1).body.createTags,[]);
  check('associação salva em lote',writes().at(-1).body.selectedTagIds.sort(),['tag-1','tag-2']);

  await openEditor();
  await page.getByLabel('Nome da tag',{exact:true}).fill('Revisão');
  await editor().getByRole('button',{name:'Adicionar',exact:true}).click();
  await editor().getByRole('listitem').filter({hasText:'Revisão'}).getByRole('button',{name:'Remover desta execução',exact:true}).click();
  check('adicionar e remover nova tag não deixa alteração',await editor().getByRole('button',{name:'Salvar tags',exact:true}).isDisabled(),true);
  await page.getByLabel('Nome da tag',{exact:true}).fill('Revisão');
  await editor().getByRole('button',{name:'Adicionar',exact:true}).click();
  await editor().getByRole('button',{name:'Histórico de tags',exact:true}).click();
  await page.getByRole('dialog',{name:'Histórico de tags',exact:true}).getByRole('listitem').first().waitFor();
  await page.keyboard.press('Escape');
  check('Escape do histórico preserva editor',await editor().count(),1);
  check('histórico preserva alterações pendentes',await editor().getByRole('listitem').filter({hasText:'Revisão'}).count(),1);
  await editor().getByRole('button',{name:'Salvar tags',exact:true}).click();await editor().waitFor({state:'hidden'});
  check('nova tag enviada no lote',writes().at(-1).body.createTags,[{name:'Revisão',color:'#0ea5e9'}]);

  await openEditor();
  await editor().getByRole('button',{name:'Renomear Urgente',exact:true}).click();
  await editor().getByRole('button',{name:'Cor da tag Urgente',exact:true}).click();
  await page.getByRole('button',{name:'Cor #b91c1c',exact:true}).click();
  check('aviso de cor explica alcance global',(await editor().innerText()).includes('todas as execuções'),true);
  const beforeColorCancel=writes().length;
  await editor().getByRole('button',{name:'Cancelar',exact:true}).click();
  check('cancelar alteração de cor não grava',writes().length,beforeColorCancel);
  await openEditor();
  await editor().getByRole('button',{name:'Renomear Urgente',exact:true}).click();
  await editor().getByRole('button',{name:'Cor da tag Urgente',exact:true}).click();
  check('cancelar restaura cor persistida',await page.getByLabel('Cor personalizada: Cor da tag Urgente',{exact:true}).inputValue(),'#000000');
  await page.keyboard.press('Escape');
  check('Escape da paleta preserva editor',await editor().isVisible(),true);
  await editor().getByRole('button',{name:'Cor da tag Urgente',exact:true}).click();
  await page.getByRole('button',{name:'Cor #b91c1c',exact:true}).click();
  await editor().getByRole('button',{name:'Salvar tags',exact:true}).click();
  await editor().waitFor({state:'hidden'});
  check('cor existente salva em lote',writes().at(-1).body.colorUpdates,[{id:'tag-1',color:'#b91c1c'}]);
  check('alteração de cor não renomeia tag',writes().at(-1).body.renames,[]);
  await openEditor();
  await page.getByLabel('Nome da tag',{exact:true}).fill('Colorida');
  await editor().getByRole('button',{name:'Cor da nova tag',exact:true}).click();
  await page.getByLabel('Cor personalizada: Cor da nova tag',{exact:true}).fill('#ffffff');
  await editor().getByRole('button',{name:'Adicionar',exact:true}).click();
  await editor().getByRole('button',{name:'Salvar tags',exact:true}).click();
  await editor().waitFor({state:'hidden'});
  check('nova tag mantém cor escolhida',writes().at(-1).body.createTags,[{name:'Colorida',color:'#ffffff'}]);

  await openEditor();
  await editor().getByRole('button',{name:'Excluir tag do processo: Urgente',exact:true}).click();
  await page.getByRole('heading',{name:'Excluir tag do processo?',exact:true}).waitFor();
  check('aviso explica alcance global',(await page.locator('body').innerText()).includes('todas as execuções associadas'),true);
  await page.keyboard.press('Escape');
  check('cancelar exclusão com Escape preserva editor',await editor().count(),1);
  const beforeDelete=writes().length;
  await editor().getByRole('button',{name:'Excluir tag do processo: Urgente',exact:true}).click();
  await page.getByRole('button',{name:'Excluir tag do processo',exact:true}).click();
  check('confirmar exclusão ainda exige salvar',writes().length,beforeDelete);
  await editor().getByRole('button',{name:'Salvar tags',exact:true}).click();await editor().waitFor({state:'hidden'});
  check('exclusão global separada da associação',writes().at(-1).body.deleteTagIds,['tag-1']);

  conflict=true;
  await openEditor();
  await editor().getByRole('button',{name:'Renomear Urgente',exact:true}).click();
  await page.getByLabel('Novo nome da tag',{exact:true}).fill('Prioritário');
  await editor().getByRole('button',{name:'Salvar tags',exact:true}).click();
  await editor().getByRole('alert').waitFor();
  check('conflito impede reenvio sem revisão',await editor().getByRole('button',{name:'Salvar tags',exact:true}).isDisabled(),true);
  check('conflito recarrega catálogo atual',await editor().getByRole('button',{name:'Renomear Urgente',exact:true}).count(),1);
  conflict=false;

  await mount('tags');
  const pill=page.getByRole('button',{name:/Urgente\. Adicionado por Ana/});
  check('pill escura usa texto branco',await pill.evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
  await pill.focus();await page.keyboard.press('Enter');
  check('teclado na pill não abre execução',await page.evaluate(()=>!!window.cardOpened),false);
  await page.getByRole('tooltip').waitFor({state:'visible'});
  check('popover identifica adição',(await page.getByRole('tooltip').innerText()).includes('Adicionado por Ana em'),true);

  await mount('light');
  check('pill clara usa texto preto',await page.getByRole('button',{name:/Urgente\. Adicionado por Ana/}).evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 0)');

  await mount('history');
  await page.getByRole('listitem').first().waitFor();
  const colorHistory=await page.getByRole('listitem').first().innerText();
  check('histórico preserva cores anterior e nova',colorHistory.toLowerCase().includes('#ffffff') && colorHistory.toLowerCase().includes('#000000'),true);
  check('histórico exibe renomeação anterior',(await page.getByRole('listitem').nth(1).innerText()).includes('renomeou “Prioritário” para “Urgente”'),true);
  check('histórico identifica personificação',(await page.getByRole('listitem').nth(1).innerText()).includes('Operado por Operador'),true);

  await mount('tasks','interno',true,'/?process=removido&tagNames=Urgente&tagNames=Financeiro');
  await page.getByText('Uma seleção não possui resultados disponíveis.',{exact:false}).waitFor();
  check('filtro de processo inválido preservado',await page.getByRole('button',{name:'Remover filtro Processos',exact:true}).count(),1);
  check('envia tags em parâmetros separados',new URL(calls.filter(c=>new URL(c.url).pathname.endsWith('/tasks')).at(-1).url).searchParams.getAll('tagNames'),['Urgente','Financeiro']);
  await page.getByTestId('abrir-filtros').click();
  await page.getByTestId('painel-filtros').getByRole('navigation').getByRole('button',{name:'Tags',exact:true}).click();
  check('tags selecionadas podem ser removidas',await page.getByTestId('filtro-tags').getByLabel('Urgente',{exact:false}).isChecked(),true);
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/tasks') && new URL(r.url()).searchParams.getAll('tagNames').length===1),page.getByTestId('filtro-tags').getByLabel('Urgente',{exact:false}).click()]);
  check('remover uma tag preserva outra',new URL(calls.filter(c=>new URL(c.url).pathname.endsWith('/tasks')).at(-1).url).searchParams.getAll('tagNames'),['Financeiro']);

  await mount('tasks','externo',true,'/?tagNames=Urgente');
  await page.getByTestId('abrir-filtros').click();
  check('modo externo não exibe filtro de tags',await page.getByTestId('filtro-tags').count(),0);
  check('modo externo não envia tag da URL',new URL(calls.filter(c=>new URL(c.url).pathname.endsWith('/tasks')).at(-1).url).searchParams.getAll('tagNames'),[]);


  await page.setViewportSize({width:375,height:812});
  await mount('task');
  await page.getByRole('button',{name:'Botões de conclusão',exact:true}).click();
  const sheet=page.getByRole('dialog',{name:'Botões de conclusão',exact:true});
  await sheet.getByRole('button',{name:'Tags',exact:true}).click();
  await page.getByLabel('Nome da tag',{exact:true}).waitFor();
  check('abrir tags no celular fecha sheet nativo',await page.locator('dialog[open]').count(),0);
  await editor().getByRole('button',{name:'Cor da nova tag',exact:true}).click();
  await page.getByRole('button',{name:'Cor #047857',exact:true}).click();
  const nameBox = await page.getByLabel('Nome da tag',{exact:true}).boundingBox();
  const colorBox = await editor().getByRole('button',{name:'Cor da nova tag',exact:true}).boundingBox();
  check('nome e cor na mesma linha móvel',Math.abs(nameBox.y-colorBox.y)<2,true);
  await page.getByLabel('Nome da tag',{exact:true}).fill('Mobile');
  await editor().getByRole('button',{name:'Adicionar',exact:true}).click();
  check('editor móvel recebe interação',await editor().getByRole('listitem').filter({hasText:'Mobile'}).count(),1);
  const saveBounds=await editor().getByRole('button',{name:'Salvar tags',exact:true}).boundingBox();
  check('salvar tags cabe na tela móvel',saveBounds.x>=0 && saveBounds.x+saveBounds.width<=375 && saveBounds.y+saveBounds.height<=812,true);
  await page.screenshot({path:join(dir,'tags-mobile.png')});
  await editor().getByRole('button',{name:'Cancelar',exact:true}).click();
  check('cancelar tags não fecha formulário',await page.evaluate(()=>!!window.taskClosed),false);
  await mount('overflow');
  await page.getByRole('button',{name:'Rolar tags para a direita',exact:true}).waitFor();
  await page.getByRole('button',{name:'Rolar tags para a direita',exact:true}).click();
  await page.getByRole('button',{name:'Rolar tags para a esquerda',exact:true}).waitFor();
  check('tags excedentes permitem rolagem horizontal',await page.getByRole('button',{name:'Rolar tags para a esquerda',exact:true}).isVisible(),true);
  await page.getByRole('button',{name:/Classificação 3\./}).dispatchEvent('pointerdown',{pointerType:'touch'});
  check('toque exibe autoria',(await page.getByRole('tooltip').innerText()).includes('Adicionado por Ana'),true);
  check('sem overflow da página móvel',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.setViewportSize({width:1280,height:900});
  await mount('tags');await openEditor();
  await page.screenshot({path:join(dir,'tags-desktop.png')});
  check('sem erros React',errors,[]);
  await writeFile(join(dir,'results.json'),JSON.stringify(results,null,2));
  console.log(`PASSOU: ${results.length}; evidências: ${dir}`);
} finally {await browser.close();}

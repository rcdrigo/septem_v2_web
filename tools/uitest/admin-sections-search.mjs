import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Real React pages and API hooks; only HTTP and browser window side effects are fixtures.
const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-admin-sections-'));
const screenshots = process.env.OUT_DIR || join(root, '.impeccable/review/admin-sections');
await mkdir(screenshots, { recursive: true });
await build({ stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {ModelosEmailPage} from './src/pages/admin/ModelosEmailPage';import {ModelosDocumentoPage} from './src/pages/admin/ModelosDocumentoPage';
import {UsuariosPage} from './src/pages/admin/UsuariosPage';import {RelatoriosPage} from './src/pages/admin/RelatoriosPage';import {ManuaisPage} from './src/pages/admin/ManuaisPage';
import {ModeloEmailPage} from './src/pages/ModeloEmailPage';import {ModeloDocumentoPage} from './src/pages/ModeloDocumentoPage';import {ManualEditorPage} from './src/pages/ManualEditorPage';
import {ComponentEditorModal} from './src/components/reports/ComponentEditorModal';import type {BlockDef} from './src/lib/api/reports';
import {useSessionStore} from './src/stores/session';
import {useToastStore} from './src/stores/toast';
useSessionStore.setState({status:'authenticated',user:{id:'fixture',name:'Operador',email:'fixture@example.test',isInternal:true,perms:['*']}});
const root=createRoot(document.getElementById('root'));let key=0,client;
const pages={email:ModelosEmailPage,document:ModelosDocumentoPage,users:UsuariosPage,reports:RelatoriosPage,manual:ManuaisPage};
const initialBlock:BlockDef={id:'receita',type:'bars',title:'Receita inicial',agg:'count',groupBy:'area',w:6,h:1};
const blockColumns=[{value:'area',label:'Área'},{value:'valor',label:'Valor'},{value:'quantidade',label:'Quantidade'},{value:'situacao',label:'Situação'}];
const globalBlockFilters=[{id:'ano',type:'text',default:'2026'}];
function ComponentFixture(){return <ComponentEditorModal open isEdit initial={initialBlock} columnOptions={blockColumns} reportKey='r5' globalFilters={globalBlockFilters} hasSource onClose={()=>window.closedEditor=true} onSave={block=>window.savedBlock=block}/>;}
pages.component=ComponentFixture;
window.mount=(name,id='novo')=>{client?.clear();useToastStore.setState({toasts:[]});client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false,staleTime:Infinity},mutations:{retry:false}}});
const Component=pages[name];window.closedEditor=false;window.opened=[];window.documentLocations=[];
window.close=()=>window.closedEditor=true;
window.open=(...args)=>{window.opened.push(args);return {opener:null,closed:false,document:document.implementation.createHTMLDocument(),location:{replace:url=>window.documentLocations.push(url)},close(){this.closed=true}}};
flushSync(()=>root.render(<QueryClientProvider key={++key} client={client}><MemoryRouter initialEntries={['/'+id]}><Routes><Route path='/:id' element={Component?<Component/>:name==='email-editor'?<ModeloEmailPage/>:name==='document-editor'?<ModeloDocumentoPage/>:<ManualEditorPage/>}/></Routes></MemoryRouter></QueryClientProvider>));};
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'app.js'), platform: 'browser', format: 'iife', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/septem-test/' }) } });

const emails = [
  {id:'e1',name:'Aviso simples',description:'Cadastro inicial'},
  {id:'e2',name:'Contrato Beta',description:'Aviso interno'},
  {id:'e3',name:'Contrato Árvore',description:'Licença ambiental'},
];
const documents = [
  {id:'d1',name:'Ofício simples',description:'Cadastro inicial',hasFile:false,fileName:null,templateValid:false,outputType:'docx',active:false},
  {id:'d2',name:'Contrato Beta',description:'Cadastro interno',hasFile:true,fileName:'beta.docx',templateValid:false,outputType:'docx',active:true},
  {id:'d3',name:'Contrato Árvore',description:'Licença ambiental',hasFile:true,fileName:'licenca.docx',templateValid:true,outputType:'pdf',active:true},
].map(d=>({...d,orgUnitId:null,updatedAt:'2026-10-31T12:00:00Z',createdAt:'2026-01-01',fileSize:1200,fileUploadedAt:null,validation:{issues:[]}}));
const users = [
  ['u1','Maria Inicial','maria@example.test','disabled',true],['u2','Pedro Interno','pedro@example.test','active',true],
  ['u3','Ana Convite','ana@example.test','invited',false],['u4','João Desativado','joao@example.test','disabled',false],
  ['u5','José Árvore','jose@licenca.test','active',false],['u6','Ana Externa','ana@licenca.test','active',false],
].map(([id,name,email,status,isInternal])=>({id,name,email,status,isInternal}));
const reports = Array.from({length:6},(_,i)=>({key:`r${i+1}`,name:i===4?'Contrato Árvore':`Relatório ${i+1}`,description:i===4?'Licença ambiental':'Cadastro geral',status:i===4?'published':i===5?'inactive':'draft',updatedAt:i===4?'2026-10-31T12:00:00Z':'2026-09-01T12:00:00Z'}));
const manuals = [
  {id:'m1',title:'Cadastro inicial',categoryName:'Cadastro',audience:'externo',published:false,isTechnical:false},
  {id:'m2',title:'Contrato Beta',categoryName:'Contratos',audience:'interno',published:true,isTechnical:false},
  {id:'m3',title:'Contrato Árvore',categoryName:'Licença ambiental',audience:'ambos',published:true,isTechnical:false},
  {id:'m4',title:'Integração API',categoryName:'Tecnologia',audience:'interno',published:true,isTechnical:true},
].map(m=>({...m,categoryId:'c1',parentId:null,icon:null,displayOrder:0,orgUnitIds:[],contentHtml:'<p>Texto do manual.</p>'}));
const emailDetail = {...emails[2],subject:'Licença {{requisitante.nome}}',bodyHtml:'<p>Olá <strong>{{requisitante.nome}}</strong></p>',attachments:[{fieldRef:'anexo_licenca'}],recipients:[{kind:'cc',type:'fixedAddress',address:'gestor@example.test'}]};
const scenarios = [
  {page:'email',total:3,target:'Contrato Árvore',terms:['arvore','ambiental'],filters:[['Nome','Contrato Árvore'],['Descrição','ambiental']]},
  {page:'document',total:3,target:'Contrato Árvore',terms:['arvore','ambiental','licenca.docx','Válido','PDF','Ativo'],filters:[['Nome','Contrato Árvore'],['Descrição','ambiental'],['Arquivo','licenca.docx'],['Validação','Válido'],['Saída','PDF'],['Status','Ativo']]},
  {page:'users',total:6,target:'José Árvore',terms:['jose','licenca.test','Ativo','Externo'],filters:[['Nome','José Árvore'],['E-mail','licenca.test'],['Status','Ativo'],['Acesso','Externo']]},
  {page:'reports',total:6,target:'Contrato Árvore',terms:['arvore','ambiental','Publicado','31/10/2026'],filters:[['Relatório','Contrato Árvore'],['Descrição','ambiental'],['Status','Publicado'],['Atualizado','31/10/2026']]},
  {page:'manual',total:3,target:'Contrato Árvore',terms:['arvore','ambiental','Ambos','Publicado'],filters:[['Título','Contrato Árvore'],['Categoria','ambiental'],['Público','Ambos'],['Publicação','Publicado']]},
];

let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  for (const width of [1440,390]) {
    const context = await browser.newContext({viewport:{width,height:1000}});
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const writes=[],reads=[],errors=[],unknown=[];
    const fixtureEmails=structuredClone(emails),fixtureDocuments=structuredClone(documents);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
    await page.context().route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      if(url.origin!=='http://localhost') throw new Error(`Unexpected external request ${url}`);
      if(!path.startsWith('/api/')) return route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="root" style="height:100dvh;min-width:0"></div></body></html>'});
      if(request.method()!=='GET') {
        writes.push({path,method:request.method(),body:request.headers()['content-type']?.includes('application/json')?request.postDataJSON():request.postData(),headers:request.headers()});
        if(request.method()==='PUT'&&path==='/api/v1/email-templates/e3') Object.assign(fixtureEmails[2],request.postDataJSON());
        if(request.method()==='PUT'&&path==='/api/v1/document-templates/d3') Object.assign(fixtureDocuments[2],request.postDataJSON());
        if(path==='/api/v1/reports/r5/preview-block') {const {block}=request.postDataJSON();return route.fulfill({json:{block:{id:block.id,type:block.type,title:block.title,w:block.w,h:block.h,items:[{label:'Licenciamento',value:1250},{label:'Fiscalização',value:750}]}}});}
        if(path.endsWith('/test')) return route.fulfill({json:{ok:true,sentTo:'fixture@example.test'}});
        if(path.endsWith('/file')) return route.fulfill({json:{fileName:'licenca.docx',fileSize:15,templateValid:true}});
        return route.fulfill({json:{id:'created-fixture'}});
      }
      reads.push(url.pathname+url.search);
      if(path==='/api/v1/email-templates/') return route.fulfill({json:fixtureEmails});
      if(path==='/api/v1/email-templates/e3') return route.fulfill({json:emailDetail});
      if(path==='/api/v1/document-templates/') return route.fulfill({json:fixtureDocuments});
      if(path==='/api/v1/document-templates/d3') return route.fulfill({json:documents[2]});
      if(path.endsWith('/preview')) return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n%%EOF'});
      if(path==='/api/v1/manuals/') return route.fulfill({json:manuals});
      if(path==='/api/v1/manuals/m3') return route.fulfill({json:manuals[2]});
      if(path==='/api/v1/manuals/parents') return route.fulfill({json:manuals.filter(m=>m.id!=='m3')});
      if(path==='/api/v1/manual-categories/') return route.fulfill({json:[{id:'c1',name:'Licença ambiental',icon:null,displayOrder:0}]});
      if(['/api/v1/users/','/api/v1/reports/'].includes(path)) {
        const items=path.includes('/users/')?users:reports,number=Number(url.searchParams.get('page')??1);
        return route.fulfill({json:{items:items.slice((number-1)*2,number*2),total:items.length,page:number,pageSize:2}});
      }
      if(/org-units|access-profiles|areas|positions|categories|data-sources|guide/.test(path)) return route.fulfill({json:[]});
      unknown.push(path);return route.fulfill({json:[]});
    });
    const css=(await Promise.all((await readdir(join(root,'dist/assets'))).filter(file=>file.endsWith('.css')).map(file=>readFile(join(root,'dist/assets',file),'utf8')))).join('\n');
    const initialize=async target=>{await target.goto('http://localhost');await target.addStyleTag({content:css});await target.addScriptTag({path:join(dir,'app.js')});};
    await initialize(page);
    const mount=(name,id)=>page.evaluate(([name,id])=>window.mount(name,id),[name,id]);
    const result=async count=>{await page.getByRole('status').filter({hasText:new RegExp(`^${count} resultado`)}).waitFor();};
    const overflow=async name=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} at ${width}px has viewport overflow`);
    const shot=async name=>page.screenshot({path:join(screenshots,`${name}-${width}.png`),fullPage:true});
    const editorShots=async name=>{await shot(name);for(const button of await page.getByRole('button',{name:'Fechar',exact:true}).all()) await button.click();await page.locator('main').evaluate(node=>node.scrollTop=0);await shot(name+'-top');};
    const clear=async()=>{const button=page.getByRole('button',{name:'Limpar busca',exact:true});if(await button.count()) await button.first().click();};
    for(const scenario of scenarios) {
      await mount(scenario.page);await result(scenario.total);
      const query=page.getByRole('searchbox',{name:'Busca em todas as colunas'});
      const rows=scenario.page==='document'&&width<640?page.getByTestId('doc-card'):page.locator('tbody tr');
      for(const term of scenario.terms) {
        await query.fill(term);
        await rows.filter({hasText:scenario.target}).waitFor();
        await clear();await result(scenario.total);
      }
      await page.getByRole('button',{name:'Filtros por coluna',exact:true}).click();
      // Each column can independently find its value, and clearing restores every row.
      for(const [name,value] of scenario.filters) {
        const input=page.getByLabel(`Filtrar por ${name}`,{exact:true});
        if(await input.evaluate(node=>node.tagName==='SELECT')) await input.selectOption(value);else await input.fill(value);
        await rows.filter({hasText:scenario.target}).waitFor();
        await clear();await result(scenario.total);
      }
      // Query terms can match different columns; every filled column filter is ANDed.
      await query.fill(scenario.terms.slice(0,2).join(' '));
      for(const [name,value] of scenario.filters) {
        const input=page.getByLabel(`Filtrar por ${name}`,{exact:true});
        if(await input.evaluate(node=>node.tagName==='SELECT')) await input.selectOption(value);else await input.fill(value);
      }
      await result(1);assert.equal(await rows.count(),1);
      await overflow(scenario.page);await shot(`${scenario.page}-combined`);
      const toggle=page.getByRole('button',{name:/^Filtros por coluna/});
      await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      for(const [name] of scenario.filters) assert.equal(await page.getByLabel(`Filtrar por ${name}`,{exact:true}).isVisible(),false);
      await result(1);await rows.filter({hasText:scenario.target}).waitFor();
      await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
      for(const [name,value] of scenario.filters) assert.equal(await page.getByLabel(`Filtrar por ${name}`,{exact:true}).inputValue(),value);
      await query.fill('nenhum-registro-fixture');await result(0);
      assert.equal(await rows.filter({hasText:scenario.target}).count(),0);
      await clear();await result(scenario.total);await overflow(scenario.page);
      if(scenario.page==='email'||scenario.page==='document') {
        await page.getByRole('button',{name:/^Novo modelo$|^Novo$/}).click();
        let opened=await page.evaluate(()=>window.opened.at(-1));
        assert.deepEqual(opened,[`/septem-test/${scenario.page==='email'?'email':'document'}-templates/novo`,'_blank','noopener']);
        await page.getByRole('button',{name:`Editar ${scenario.target} em nova aba`,exact:true}).click();
        opened=await page.evaluate(()=>window.opened.at(-1));
        assert.equal(opened[0],`/septem-test/${scenario.page==='email'?'email':'document'}-templates/${scenario.page==='email'?'e3':'d3'}`);
        assert.equal(await page.getByRole('dialog').count(),0);
      }
      if(scenario.page==='reports') {
        await page.getByRole('button',{name:'Novo relatório',exact:true}).click();
        await page.getByRole('heading',{name:'Identificação',exact:true}).waitFor();
        await page.getByRole('heading',{name:'Origem dos dados',exact:true}).waitFor();
        await overflow('report editor');await shot('report-editor');
      }
      if(scenario.page==='manual') {
        assert.equal(await page.getByTestId('lista-manuais').count(),1);
        await page.getByRole('button',{name:'Técnico',exact:true}).click();await result(1);
        await page.getByRole('button',{name:'Novo manual',exact:true}).click();
        assert.equal(await page.evaluate(()=>window.opened.at(-1)[0]),'/septem-test/manuals/nova?tecnico=1');
      }
      console.log(`PASS ${width}px ${scenario.page}: global fields, column fields, AND, zero, clear, layout.`);
    }
    assert.ok(reads.some(url=>url.includes('/users/?page=3&')), 'users: server-clamped third page loaded');
    assert.ok(reads.some(url=>url.includes('/reports/?page=3&')), 'reports: server-clamped third page loaded');

    await mount('email-editor','e3');
    await page.getByLabel('Nome',{exact:true}).fill('Contrato atualizado');
    assert.equal(await page.getByLabel(/^Assunto/).inputValue(),emailDetail.subject);
    assert.equal(await page.locator('[contenteditable]').innerHTML(),emailDetail.bodyHtml);
    await page.getByLabel(/^Assunto/).fill('Assunto atualizado');
    await page.locator('[contenteditable]').fill('Mensagem atualizada');
    const updatedEmailHtml=await page.locator('[contenteditable]').innerHTML();
    for(const title of ['Identificação','Conteúdo','Destinatários e anexos','Teste']) await page.getByRole('heading',{name:title,exact:true}).waitFor();
    await page.getByRole('button',{name:'Testar',exact:true}).click();
    await page.waitForFunction(()=>document.body.innerText.includes('Teste enviado'));
    let write=writes.at(-1);assert.equal(write.path,'/api/v1/email-templates/test');
    assert.deepEqual(write.body,{subject:'Assunto atualizado',bodyHtml:updatedEmailHtml});
    await overflow('email editor');await editorShots('email-editor');
    assert.equal(await page.getByRole('dialog').count(),0);
    await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.waitForFunction(()=>window.closedEditor);
    write=writes.at(-1);assert.equal(write.method,'PUT');
    assert.deepEqual(write.body,{name:'Contrato atualizado',description:emailDetail.description,subject:'Assunto atualizado',bodyHtml:updatedEmailHtml,attachments:emailDetail.attachments,recipients:emailDetail.recipients});
    await mount('email-editor','novo');await page.getByLabel('Nome',{exact:true}).fill('Novo aviso');
    await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.waitForFunction(()=>window.closedEditor);
    assert.equal(writes.at(-1).method,'POST');assert.equal(writes.at(-1).body.name,'Novo aviso');

    await mount('document-editor','d3');await page.getByLabel('Nome',{exact:true}).fill('Documento atualizado');
    for(const title of ['Identificação e responsabilidade','Formato e disponibilidade','Arquivo','Validação']) await page.getByRole('heading',{name:title,exact:true}).waitFor();
    await page.getByTestId('doc-file-input').setInputFiles({name:'licenca.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('fixture content')});
    await page.getByText('Arquivo "licenca.docx" enviado.',{exact:true}).waitFor();
    write=writes.at(-1);assert.equal(write.path,'/api/v1/document-templates/d3/file');
    assert.match(write.headers['content-type'],/multipart\/form-data/);assert.match(write.body,/filename="licenca.docx"/);
    await page.getByRole('button',{name:'Visualizar',exact:true}).click();
    await page.waitForFunction(()=>window.documentLocations.length===1);
    assert.match(await page.evaluate(()=>window.documentLocations[0]),/^blob:/);
    await overflow('document editor');await editorShots('document-editor');assert.equal(await page.getByRole('dialog').count(),0);
    await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.waitForFunction(()=>window.closedEditor);
    assert.deepEqual(writes.at(-1).body,{name:'Documento atualizado',description:documents[2].description,orgUnitId:null,active:true,outputType:'pdf'});
    await mount('document-editor','novo');await page.getByLabel('Nome',{exact:true}).fill('Novo documento');
    assert.equal(await page.getByRole('button',{name:'Enviar .docx',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.waitForFunction(()=>window.closedEditor);
    assert.equal(writes.at(-1).method,'POST');assert.equal(writes.at(-1).body.name,'Novo documento');

    await mount('manual-editor','m3');await page.getByTestId('manual-titulo').fill('Manual atualizado');
    for(const title of ['Identificação e categoria','Público e visibilidade','Conteúdo','Publicação']) await page.getByRole('heading',{name:title,exact:true}).waitFor();
    assert.equal(await page.getByRole('dialog').count(),0);
    assert.ok(await page.locator('main > div').evaluate(node=>node.getBoundingClientRect().width>innerWidth-80),'manual editor uses available width');
    await overflow('manual editor');await shot('manual-editor');
    await page.getByTestId('salvar-manual').click();await page.waitForFunction(()=>window.closedEditor);
    assert.equal(writes.at(-1).body.title,'Manual atualizado');assert.equal(writes.at(-1).body.contentHtml,manuals[2].contentHtml);
    await mount('component');
    const component=page.getByRole('dialog',{name:'Editar componente',exact:true});
    for(const heading of ['Tipo e título','Dados e cálculos','Filtros e ordenação','Aparência','Preview do componente']) await component.getByRole('heading',{name:heading,exact:true}).waitFor();
    await component.getByRole('heading',{name:'Receita inicial',exact:true}).waitFor();
    assert.equal(await component.locator('canvas').count(),1,'the actual chart renders its HTTP preview');
    await component.getByLabel('Título do componente',{exact:true}).fill('Receita por área');
    await component.getByLabel(/^Agregação/).selectOption('sum');
    await component.getByLabel(/^Campo de valor/).selectOption('valor');
    await component.getByLabel(/^Agrupar por/).selectOption('situacao');
    await component.locator('summary').filter({hasText:'Fórmula avançada'}).click();
    await component.getByLabel(/^Expressão por linha/).fill('[valor] * [quantidade]');
    await component.getByRole('button',{name:'filtro',exact:true}).click();
    await component.getByLabel('Campo do filtro',{exact:true}).selectOption('situacao');
    await component.getByLabel('Operador do filtro',{exact:true}).selectOption('contains');
    await component.getByPlaceholder('valor',{exact:true}).fill('Pago');
    await component.getByRole('button',{name:'Adicionar ordenação',exact:true}).click();
    await component.getByLabel('Ordenar por 1',{exact:true}).selectOption('valor');
    await component.getByTitle('Inverter direção',{exact:true}).click();
    await component.getByLabel('Limite',{exact:true}).fill('10');
    await component.getByLabel(/^Formatação/).selectOption('currency');
    await component.getByLabel('Largura em colunas',{exact:true}).focus();
    await page.keyboard.press('End');for(let i=0;i<3;i++) await page.keyboard.press('ArrowLeft');
    const finalPreview=page.waitForRequest(request=>request.url().endsWith('/reports/r5/preview-block')&&request.postDataJSON().block.h===3);
    await component.getByLabel('Altura em linhas',{exact:true}).fill('3');
    const previewRequest=await finalPreview;
    const expectedBlock={id:'receita',type:'bars',title:'Receita por área',agg:'sum',groupBy:'situacao',w:9,h:3,valueField:'valor',formula:'[valor] * [quantidade]',filters:[{field:'situacao',op:'contains',value:'Pago'}],sorts:[{field:'valor',desc:false}],limit:10,format:'currency'};
    assert.deepEqual(previewRequest.postDataJSON(),{block:expectedBlock,filters:{ano:'2026'}},'live preview uses every current configuration value and global defaults');
    await component.getByRole('heading',{name:'Receita por área',exact:true}).waitFor();
    await component.locator('canvas').waitFor();await overflow('report component editor');
    await component.locator('.overflow-y-auto').first().evaluate(node=>node.scrollTop=0);
    // The real Chart.js preview animates for 1000ms; capture its final bar heights.
    await page.waitForTimeout(1100);
    await shot('component-editor');
    await component.getByRole('button',{name:'Salvar',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(window.savedBlock))),expectedBlock,'save callback preserves the configuration used in preview');
    console.log(`PASS ${width}px component editor: grouped controls, rendered live chart, changed calculation/formula/filter/sort/dimensions preview and save, no viewport overflow.`);
    // Separate browser tabs own separate QueryClients. Saving in the editor must
    // refresh an already-loaded parent catalogue when the parent becomes visible.
    for(const [kind,id,previous] of [['email','e3','Contrato atualizado'],['document','d3','Documento atualizado']]) {
      await mount(kind);await result(3);
      const parentRows=kind==='document'&&width<640?page.getByTestId('doc-card'):page.locator('tbody tr');
      await parentRows.filter({hasText:previous}).waitFor();
      // Headless Chrome may leave every tab visible; model the browser visibility
      // boundary explicitly so TanStack's real visibility listener receives it.
      await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));});
      const child=await page.context().newPage();
      child.on('pageerror',error=>errors.push(error.message));
      child.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
      await initialize(child);await child.bringToFront();
      await child.evaluate(([kind,id])=>window.mount(kind+'-editor',id),[kind,id]);
      const changed=`${kind} salvo em outra aba`;
      await child.getByLabel('Nome',{exact:true}).fill(changed);
      await child.getByRole('button',{name:'Salvar',exact:true}).click();await child.waitForFunction(()=>window.closedEditor);
      // Parent invalidation cannot come from the child's in-memory query cache.
      assert.equal(await parentRows.filter({hasText:changed}).count(),0);
      await child.close();await page.bringToFront();
      await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));});
      await parentRows.filter({hasText:changed}).waitFor();
      console.log(`PASS ${width}px ${kind}: parent list refreshes after save in a separate editor tab.`);
    }
    assert.deepEqual(unknown,[],'all API boundaries are known fixture endpoints');
    assert.deepEqual(errors,[],'no browser console errors or page errors');
    console.log(`PASS ${width}px: five combined searches, all column/global fields, AND/zero/clear, users/reports all server pages, basename new/edit tabs, standalone editor groups, email create/update/test payloads, document create/update/upload/preview, manual table/full-width save, no viewport overflow or console errors.`);
    await context.close();
  }
  console.log(`Screenshots: ${screenshots}`);
} finally {await browser?.close();await rm(dir,{recursive:true,force:true});}

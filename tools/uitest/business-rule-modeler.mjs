import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-business-rule-ui-'));
const xml = await readFile(join(root, 'src/assets/empty-diagram.bpmn'), 'utf8');
const cssName = (await readdir(join(root, 'dist/assets'))).find(name => name.endsWith('.css'));
const css = cssName ? await readFile(join(root, 'dist/assets', cssName), 'utf8') : '';
await build({ stdin: { contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ModeladorPage} from './src/pages/modelador/ModeladorPage';
import {useSessionStore} from './src/stores/session';
import {useFormStore} from './src/stores/form';
import {validateProcess} from './src/lib/validation';
import {getExtensionConfig,setExtensionConfig} from './src/lib/bpmn-helpers';
import {BUSINESS_RULE_DEFAULTS} from './src/lib/bpmn-business-rule';
import Modeler from 'bpmn-js/lib/Modeler';
const original=Modeler.prototype.importXML;
Modeler.prototype.importXML=function(...args){window.modeler=this;return original.apply(this,args);};
useSessionStore.setState({accessToken:'test-token',status:'authenticated',user:{id:'test',name:'Teste',email:'teste@local',isInternal:true,perms:['*'],accessProfiles:[]}});
window.fields=()=>useFormStore.getState().setFields([
{id:'numero_alvo',label:'Número da requisição alvo',type:'number',group:'Geral'},
{id:'valor',fieldId:'field-valor',tabLabel:'Dados',label:'Valor do pedido',type:'number',group:'Geral'},
{id:'categorias',fieldId:'field-categorias',tabLabel:'Dados',label:'Categorias do pedido',type:'taglist',group:'Geral'},
{id:'arquivos',fieldId:'field-arquivos',tabLabel:'Dados',label:'Documentos do pedido',type:'filepicker',group:'Geral'},
{id:'coluna',label:'Coluna de tabela',type:'number',group:'Itens',tableKey:'itens',path:'itens[].coluna'}]);
window.config=()=>getExtensionConfig(window.modeler.get('elementRegistry').get(window.ruleId),'septem:BusinessRule',BUSINESS_RULE_DEFAULTS);
window.setConfig=patch=>setExtensionConfig(window.modeler,window.modeler.get('elementRegistry').get(window.ruleId),'septem:BusinessRule',patch);
window.lint=()=>validateProcess(window.modeler);
const router=createMemoryRouter([{path:'/flows/edit',element:<ModeladorPage/>}],{initialEntries:['/flows/edit']});
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RouterProvider router={router}/></QueryClientProvider>);
`, resolveDir: root, loader: 'tsx' }, plugins: [{ name: 'raw-bpmn', setup(b) {
  b.onResolve({ filter: /\?raw$/ }, args => ({path:resolve(args.path.startsWith('@/')?join(root,'src'):args.resolveDir,args.path.replace(/^@\//,'').replace(/\?raw$/,'')),namespace:'raw'}));
  b.onLoad({filter:/.*/,namespace:'raw'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text',resolveDir:dirname(args.path)}));
} }], bundle:true, outfile:join(dir,'app.js'), platform:'browser', format:'iife', tsconfig:join(root,'tsconfig.app.json'), define:{'import.meta.env':'{}'} });
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(20000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.stack??error.message));
  let lastSave;
  await page.route('http://rules.local/**', async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname==='/app.css') return route.fulfill({contentType:'text/css; charset=utf-8',body:css});
    if(url.pathname.startsWith('/assets/')) return route.fulfill({body:await readFile(join(root,'dist',url.pathname))});
    if(!url.pathname.startsWith('/api/')) return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><link rel="stylesheet" href="/app.css"><div id="root"></div>'});
    if(['POST','PUT'].includes(request.method())&&url.pathname.includes('/process-definitions/')) {lastSave=request.postDataJSON();return route.fulfill({json:{key:'teste',version:1}});}
    if(url.pathname.includes('/data-sources')) return route.fulfill({json:[{id:'11111111-1111-1111-1111-111111111111',name:'Instâncias selecionadas'}]});
    return route.fulfill({json:url.pathname.includes('/process-definitions/')?{key:'teste',name:'Teste de regras',version:1,status:'draft',bpmnXml:xml,hasInstances:false}:[]});
  });
  await page.goto('http://rules.local/flows/edit');
  await page.addScriptTag({path:join(dir,'app.js')});
  await page.locator('.djs-container').waitFor();
  assert.equal(await page.locator('[data-action="create.business-rule-task"]').count(),1);
  await page.evaluate(()=>{
    const m=window.modeler,root=m.get('canvas').getRootElement();
    const shape=m.get('modeling').createShape(m.get('elementFactory').createShape({type:'bpmn:BusinessRuleTask'}),{x:440,y:220},root);
    const end=m.get('modeling').createShape(m.get('elementFactory').createShape({type:'bpmn:EndEvent'}),{x:680,y:220},root);
    const start=m.get('elementRegistry').filter(el=>el.type==='bpmn:StartEvent')[0];
    m.get('modeling').connect(start,shape);m.get('modeling').connect(shape,end);
    window.ruleId=shape.id;m.get('modeling').updateProperties(shape,{name:'Controlar requisições'});m.get('selection').select(shape);m.get('canvas').zoom('fit-viewport');window.fields();
  });
  await page.getByLabel('Tipo de operação',{exact:true}).waitFor();
  assert.equal(await page.getByRole('option',{name:'Mudar requisitante',exact:true}).count(),0);
  assert.equal(await page.getByRole('option',{name:'Executar regra de negócio',exact:true}).count(),0);
  assert.ok((await page.evaluate(()=>window.lint())).some(issue=>issue.rule.startsWith('business-rule')));
  for(const operation of ['cancel','freeze','unfreeze','setStatus','setField']) {
    await page.getByLabel('Tipo de operação',{exact:true}).selectOption(operation);
    if(operation==='cancel') {
      await page.getByRole('radio',{name:'Outras requisições, por campo do formulário',exact:true}).check();
      await page.locator('button').filter({hasText:/^Selecione o campo do formulário$/}).click();
      await page.getByTestId('combobox-popover').getByRole('button',{name:'Número da requisição alvo (numero_alvo)',exact:true}).click();
    }
    if(operation==='cancel') {
      await page.evaluate(()=>window.modeler.get('commandStack').undo());
      assert.equal((await page.evaluate(()=>window.config())).instanceFieldRef,'','Desfazer deve restaurar a configuração anterior');
      await page.evaluate(()=>window.modeler.get('commandStack').redo());
      assert.equal((await page.evaluate(()=>window.config())).instanceFieldRef,'numero_alvo');
    }
    if(operation==='setStatus') {
      assert.equal(await page.getByRole('radio',{name:'Própria requisição',exact:true}).count(),0);
      await page.getByRole('radio',{name:'Outras requisições, por fonte de dados',exact:true}).check();
      await page.locator('button').filter({hasText:/^Selecione a fonte de dados$/}).click();
      await page.getByTestId('combobox-popover').getByRole('button',{name:'Instâncias selecionadas',exact:true}).click();
      await page.getByLabel('Novo status',{exact:true}).fill('Deferido & concluído');
    }
    if(operation==='setField') {
      assert.equal(await page.getByRole('radio').count(),0);
      await page.locator('button').filter({hasText:/^Selecione o campo do formulário$/}).click();
      assert.equal(await page.getByTestId('combobox-popover').getByText('Coluna de tabela',{exact:false}).count(),0);
      await page.getByTestId('combobox-popover').getByRole('button',{name:'Dados › Geral › Valor do pedido (valor)',exact:true}).click();
      await page.getByLabel('Valor fixo',{exact:true}).fill('42.5');
    }
    const before=await page.evaluate(async()=>({xml:(await window.modeler.saveXML({format:true})).xml,config:window.config(),issues:window.lint()}));
    assert.equal(before.config.operation,operation);
    assert.equal(before.issues.filter(issue=>issue.rule.startsWith('business-rule')).length,0,JSON.stringify(before.issues));
    assert.ok(before.xml.includes('bpmn:businessRuleTask'));
    assert.ok(before.xml.includes(`<septem:businessRule operation="${operation}"`));
    await page.evaluate(async xml=>{await window.modeler.importXML(xml);window.modeler.get('selection').select(window.modeler.get('elementRegistry').get(window.ruleId));window.fields();},before.xml);
    await page.getByLabel('Tipo de operação',{exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.config()),before.config);
    if(operation==='setField') assert.equal(before.config.valueJson,'42.5');
    if(operation==='freeze') await page.screenshot({path:join(dir,'modeler-freeze-desktop.png')});
    console.log(`PASS: ${operation}, configuração, validação e XML de ida e volta`);
  }
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.waitForFunction(()=>document.body.innerText.includes('salvo')||document.body.innerText.includes('Salvo'));
  assert.ok(lastSave?.bpmnXml.includes('valueJson="42.5"'));
  await page.screenshot({path:join(dir,'modeler-field-desktop.png')});
  await page.locator('button').filter({hasText:/^Dados › Geral › Valor do pedido \(valor\)$/}).click();
  await page.getByTestId('combobox-popover').getByRole('button',{name:'Dados › Geral › Categorias do pedido (categorias)',exact:true}).click();
  const list=page.getByLabel('Valor fixo',{exact:true});
  await list.fill('Primeiro');await list.press('Enter');
  assert.equal(await list.inputValue(),'Primeiro\n');
  await list.pressSequentially('Segundo');
  assert.deepEqual(JSON.parse((await page.evaluate(()=>window.config())).valueJson),['Primeiro','Segundo']);
  const listXml=await page.evaluate(async()=> (await window.modeler.saveXML({format:true})).xml);
  await page.evaluate(async xml=>{await window.modeler.importXML(xml);window.modeler.get('selection').select(window.modeler.get('elementRegistry').get(window.ruleId));window.fields();},listXml);
  await page.getByLabel('Valor fixo',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Valor fixo',{exact:true}).inputValue(),'Primeiro\nSegundo');
  await page.screenshot({path:join(dir,'modeler-list-desktop.png')});
  console.log('PASS: lista digitada com Enter, segundo valor e persistência');
  await page.locator('button').filter({hasText:/^Dados › Geral › Categorias do pedido \(categorias\)$/}).click();
  await page.getByTestId('combobox-popover').getByRole('button',{name:'Dados › Geral › Documentos do pedido (arquivos)',exact:true}).click();
  await page.getByLabel('Valor fixo',{exact:true}).fill('https://files.example.test/licenca.pdf');
  assert.deepEqual(JSON.parse((await page.evaluate(()=>window.config())).valueJson),[{name:'licenca.pdf',url:'https://files.example.test/licenca.pdf',size:0}]);
  console.log('PASS: valor fixo de arquivo preserva o formato de anexo');
  await page.setViewportSize({width:375,height:900});
  await page.screenshot({path:join(dir,'modeler-field-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Configurações',exact:true}).click();
  await page.getByRole('button',{name:'Controle de acesso',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar regra',exact:true}).click();
  const capability=page.getByText('Capacidade',{exact:true}).locator('..').locator('select');
  await capability.selectOption('freeze');
  assert.equal(await capability.inputValue(),'freeze');
  await capability.selectOption('unfreeze');
  assert.equal(await capability.inputValue(),'unfreeze');
  assert.deepEqual(errors,[]);
  console.log(`Artefatos: ${dir}`);
} finally {await browser.close();}

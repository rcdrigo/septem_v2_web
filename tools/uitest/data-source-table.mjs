import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as XLSX from 'xlsx';

const root = resolve(import.meta.dirname, '../..'), dir = await mkdtemp(join(tmpdir(), 'septem-table-source-'));
await build({ stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {DataSourceDialog} from './src/pages/admin/FontesDadosPage';import {ReactForm} from './src/components/form/ReactForm';
const root=createRoot(document.getElementById('root')),ref=React.createRef(),client=new QueryClient({defaultOptions:{queries:{retry:false}}});let key=0;
window.editor=id=>flushSync(()=>root.render(<QueryClientProvider client={client}><DataSourceDialog key={++key} id={id} scope="process" fullPage onClose={()=>window.closedEditor=true}/></QueryClientProvider>));
window.form=(schema,data={})=>flushSync(()=>root.render(<QueryClientProvider client={client}><ReactForm key={++key} ref={ref} schema={schema} data={data}/></QueryClientProvider>));
window.data=()=>ref.current.getData();window.submit=()=>ref.current.submit();
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'app.js'), platform: 'browser', format: 'iife', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' } });
const columns = ['Grupo','Subgrupo','Código','Atividade'];
const rows = [['1','1.2','001','Aço'],['1','1.2','002','Soldas'],['1','1.2','002','Soldas'],['2','2.0','003','Minerais']];
const saved = { id:'table-source', name:'Atividades', type:'fixed-table', scope:'process', config:{columns,rows} };
const derived = { id:'derived', name:'Atividades filtradas', type:'table', scope:'process', config:{sourceId:'table-source',valueColumn:'Código',textColumn:'Atividade',filters:[{column:'Grupo',operator:'eq',field:'grupo'},{column:'Subgrupo',operator:'eq',field:'subgrupo'}],mapping:{fields:{codigo:'Código'}}} };
const field=(key,type='textfield',source,options)=>({id:'f-'+key,kind:'field',type,key,label:key,config:{...(source?{properties:{septemDataSourceId:source}}:{}),...(options?{values:options}:{})}});
const baseFields=[field('grupo','select',null,[{value:'1',label:'Indústria'},{value:'2',label:'Mineração'},{value:'3',label:'Sem cadastro'}]),field('subgrupo','select','sub'),field('atividade','select','activity'),field('resumo','textfield','text'),field('codigo')];
const schema=table=>({format:'septem-native',schemaVersion:1,id:'form',tabs:[{id:'tab',label:'Cadastro',groups:[{id:'group',label:'Dados',type:table?'table':'group',...(table?{key:'itens'}:{}),fields:baseFields}]}]});
const wb=XLSX.utils.book_new(), sheet=XLSX.utils.aoa_to_sheet([columns,...rows]);sheet.C2={t:'n',v:1,z:'000'};XLSX.utils.book_append_sheet(wb,sheet,'Dados');
const spreadsheet=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(12000);const requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.startsWith('/api/')) return route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'});
   if(url.pathname.endsWith('/table-source')) return route.fulfill({json:saved});
   if(url.pathname.endsWith('/derived')) return route.fulfill({json:derived});
   if(url.pathname.endsWith('/usages')) return route.fulfill({json:{usages:[]}});
   if(req.method()==='GET') return route.fulfill({json:[saved,derived]});
   const body=req.postDataJSON();requests.push({path:url.pathname,body});
   if(url.pathname.endsWith('/field-options')) {
    const data=body.formData??{}, isSub=body.dataSourceId==='sub';
    const dependencies=isSub?['grupo']:['grupo','subgrupo'],waitingForFields=dependencies.filter(k=>!data[k]);
    const matches=waitingForFields.length?[]:rows.filter(r=>r[0]===data.grupo&&(isSub||r[1]===data.subgrupo));
    const seen=new Set(),options=matches.map(r=>isSub?{value:r[1],label:r[1]}:{value:r[2],label:r[3],...(body.dataSourceId==='activity'?{fieldValues:{codigo:r[2]}}:{})}).filter(o=>{const k=JSON.stringify([o.value,o.label]);if(seen.has(k))return false;seen.add(k);return true;});
    if(data.grupo==='1') await new Promise(r=>setTimeout(r,70));
    return route.fulfill({json:{sourceType:'table',dependencies,waitingForFields,options}});
   }
   if(url.pathname.endsWith('/test')) return route.fulfill({json:{columns:['Código','Atividade'],rows:[['001','Aço'],['002','Soldas']],mappedResult:{columns:['codigo'],rows:[['001'],['002']]}}});
   return route.fulfill({json:{id:'created'}});
  });
  await page.goto('http://localhost');
  for(const file of await readdir(join(root,'dist/assets')))if(file.endsWith('.css'))await page.addStyleTag({content:await readFile(join(root,'dist/assets',file),'utf8')});
  await page.addScriptTag({path:join(dir,'app.js')});
  await page.evaluate(()=>window.editor());
  await page.getByLabel('Nome',{exact:true}).fill('Tabela de atividades');
  const type=page.locator('#ds-form select').first();
  assert.match(await type.innerText(),/Fixa \(Simples\)/);
  await type.selectOption('fixed-table');
  await page.getByRole('button',{name:'Adicionar coluna',exact:true}).click();
  await page.getByRole('textbox',{name:'Nome da coluna 3',exact:true}).fill('Extra');
  await page.getByRole('button',{name:'Remover coluna 3',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar linha',exact:true}).click();
  await page.getByRole('button',{name:'Remover linha 2',exact:true}).click();
  await page.getByLabel(/Importar planilha/).setInputFiles({name:'atividades.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:spreadsheet});
  await page.getByRole('button',{name:'Usar dados importados',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'Linha 1, Código',exact:true}).inputValue(),'001');
  await mkdir(join(root,'.impeccable/review'),{recursive:true});
  await page.locator('[role=region]').evaluateAll(nodes=>nodes.forEach(el=>el.scrollLeft=0));
  await page.screenshot({path:join(root,`.impeccable/review/data-source-table-edit-${width}.png`),fullPage:false});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.waitForFunction(()=>window.closedEditor);
  assert.equal(requests.at(-1).body.type,'fixed-table');assert.deepEqual(requests.at(-1).body.config,{columns,rows});
  await page.evaluate(()=>window.editor('table-source'));
  assert.equal(await page.getByRole('textbox',{name:'Linha 1, Código',exact:true}).inputValue(),'001');
  await type.selectOption('table');
  await page.getByLabel('Fonte Fixa (Tabela)',{exact:true}).selectOption('table-source');
  await page.getByLabel('Coluna de valor',{exact:true}).selectOption('Código');
  await page.getByLabel('Coluna de texto',{exact:true}).selectOption('Atividade');
  for(const [i,col,key]of [[1,'Grupo','grupo'],[2,'Subgrupo','subgrupo']]){
   await page.getByRole('button',{name:'Adicionar filtro',exact:true}).click();
   await page.getByLabel(`Coluna do filtro ${i}`,{exact:true}).selectOption(col);
   await page.getByLabel(`Comparação do filtro ${i}`,{exact:true}).selectOption('eq');
   await page.getByLabel(`Identificador do filtro ${i}`,{exact:true}).fill(key);
  }
  await page.getByRole('textbox',{name:/Mapeamento dos campos do formulário/}).fill('codigo => Código');
  await page.getByLabel('Teste: grupo',{exact:true}).fill('1');await page.getByLabel('Teste: subgrupo',{exact:true}).fill('1.2');
  await page.getByRole('button',{name:'Testar',exact:true}).click();await page.getByRole('region',{name:'Resultado',exact:true}).waitFor();
  assert.deepEqual(requests.at(-1).body.params,{grupo:'1',subgrupo:'1.2'});
  assert.deepEqual(requests.at(-1).body.config,derived.config);
  await page.locator('main').evaluate(el=>el.scrollTop=0);
  await page.locator('div.overflow-auto').evaluateAll(nodes=>nodes.forEach(el=>el.scrollLeft=0));
  await page.screenshot({path:join(root,`.impeccable/review/data-source-table-query-${width}.png`),fullPage:false});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>window.editor('derived'));
  assert.equal(await page.getByLabel('Identificador do filtro 2',{exact:true}).inputValue(),'subgrupo');
  assert.equal(await page.getByRole('textbox',{name:/Mapeamento dos campos do formulário/}).inputValue(),'codigo => Código');
  await page.evaluate(s=>window.form(s),schema(false));
  const group=page.getByRole('combobox',{name:'grupo',exact:true}),sub=page.getByRole('combobox',{name:'subgrupo',exact:true}),activity=page.getByRole('combobox',{name:'atividade',exact:true});
  await page.waitForFunction(()=>!!document.querySelector('select[aria-label="subgrupo"]')?.disabled);
  await group.selectOption('1');await sub.selectOption('1.2');await activity.selectOption('001');
  await page.waitForFunction(()=>window.data().resumo==='Aço, Soldas'&&window.data().codigo==='001');
  await group.selectOption('2');
  await page.waitForFunction(()=>window.data().subgrupo===''&&window.data().atividade===''&&window.data().resumo===''&&!window.data().codigo);
  await sub.selectOption('2.0');await activity.selectOption('003');await page.waitForFunction(()=>window.data().resumo==='Minerais'&&window.data().codigo==='003');
  await group.selectOption('1');await group.selectOption('2');
  await sub.selectOption('2.0');await page.waitForFunction(()=>window.data().resumo==='Minerais');
  await new Promise(r=>setTimeout(r,150));assert.deepEqual(await activity.locator('option').allTextContents(),['Selecione…','Minerais']);
  await group.selectOption('3');await page.getByText('Nenhum resultado encontrado para os filtros informados.').first().waitFor();
  assert.equal(await sub.locator('option').count(),1);
  await group.selectOption('');await page.waitForFunction(()=>document.querySelector('select[aria-label="subgrupo"]')?.disabled);
  await page.evaluate(s=>window.form(s,{itens:[{grupo:'1',subgrupo:'1.2'},{grupo:'2',subgrupo:'2.0'}]}),schema(true));
  await page.waitForFunction(()=>window.data().itens?.[0]?.resumo==='Aço, Soldas'&&window.data().itens?.[1]?.resumo==='Minerais');
  await page.getByRole('combobox',{name:'atividade',exact:true}).nth(1).selectOption('003');
  const data=await page.evaluate(()=>window.data());assert.equal(data.itens[1].codigo,'003');assert.ok(!data.itens[0].codigo);
  assert.deepEqual(errors,[]);
  await page.close();console.log(`PASSOU: tabela editável, XLSX, filtros, mapeamento, cascata, corridas e linhas isoladas (${width}px).`);
 }
}finally{await browser.close();await rm(dir,{recursive:true,force:true});}

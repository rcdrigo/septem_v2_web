// Hooks e renderizador reais; API simulada para verificar publicação e cache.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-publication-'));
await build({ stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {useSaveProcess,useUpdateProcess,usePatchProcessStatus} from './src/lib/api/process-definitions';
import {useProcessForm,useHasHomologation} from './src/lib/api/execution';
import {ReactForm} from './src/components/form/ReactForm';
import {useSessionStore} from './src/stores/session';
useSessionStore.setState({accessToken:'test-token'});
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:60000,refetchOnWindowFocus:false}}});
function Form(){const q=useProcessForm('existente');return <ReactForm schema={q.data?.formSchema}/>;}
function App(){const save=useSaveProcess(),update=useUpdateProcess(),publish=usePatchProcessStatus();const [show,setShow]=React.useState(true);useHasHomologation('existente',true);
window.act=async action=>{if(action==='save')await save.mutateAsync({key:'existente',bpmnXml:'test'});else if(action==='update')await update.mutateAsync({key:'existente',bpmnXml:'test'});else await publish.mutateAsync({key:'existente',status:'published'});};
window.show=setShow;return show?<Form/>:null;}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);
`, resolveDir:root, loader:'tsx' }, bundle:true, outfile:join(dir,'app.js'), platform:'browser',format:'iife',tsconfig:join(root,'tsconfig.app.json'),define:{'import.meta.env':'{}'} });
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const field=(key,row,columns)=>({id:key,key,label:key,type:'textfield',layout:{row,columns}});
const schema=(name,layout)=>({type:'default',septemGroupLayout:layout,components:[
 {id:'principal',type:'group',label:name,components:[field('Primeiro','r1',8),field('Terceiro','r2',8),field('Segundo','r1',8),field('Quarto','r3'),field('Quinto','r3')]},
 {id:'outro',type:'group',label:'Outro grupo',components:[field('Outro campo','r4')]}
]});
try{
 for(const width of [1280,375]){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(15000);const errors=[];let current=schema('Anterior','stacked');let homologationReads=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://publication.local/**',async r=>{
   const req=r.request(),url=req.url();
   if(!url.includes('/api/'))return r.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
   if(req.method()!=='GET')return r.fulfill({json:{key:'existente',version:2,status:'published'}});
   if(url.includes('homologation=true'))homologationReads++;
   return r.fulfill({json:{formSchema:current,buttons:[]}});
  });
  await page.goto('http://publication.local/');await page.addScriptTag({path:join(dir,'app.js')});
  await page.addStyleTag({content:'.flex{display:flex}.flex-col{flex-direction:column}.grid{display:grid}.gap-3{gap:12px}.septem-form-grid{grid-template-columns:repeat(16,minmax(0,1fr))}.septem-form-grid>*{min-width:0}@media(max-width:640px){.septem-form-grid{grid-template-columns:minmax(0,1fr)}.septem-form-grid>*{grid-column:1/-1!important}}'});
  await page.getByText('Anterior',{exact:true}).waitFor();
  for(const action of ['save','update','publish']){
   const before=homologationReads;current=schema('Atual '+action,'tabs');
   await page.evaluate(action=>window.act(action),action);
   await page.getByRole('tab',{name:'Atual '+action,exact:true}).waitFor();
   assert.ok(homologationReads>before,action+' invalida homologação');
  }
  const labels=await page.locator('input').evaluateAll(inputs=>inputs.map(x=>x.parentElement.textContent));
  // Ordem visual segue as linhas, mesmo se a lista do schema intercala seus campos.
  assert.ok(labels[0].includes('Primeiro'));assert.ok(labels[1].includes('Segundo'));assert.ok(labels[2].includes('Terceiro'));
  const boxes=await page.locator('input').evaluateAll(inputs=>inputs.map(x=>{const r=x.closest('.septem-form-grid > div').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width};}));
  if(width>640){assert.equal(boxes[0].y,boxes[1].y);assert.ok(boxes[2].y>boxes[1].y);assert.ok(boxes[1].x>boxes[0].x);assert.equal(boxes[3].y,boxes[4].y);assert.equal(boxes[3].w,boxes[4].w);}
  else for(let i=1;i<boxes.length;i++)assert.ok(boxes[i].y>boxes[i-1].y);
  // Publicação em outra sessão: reabrir antes dos 60s precisa buscar novamente.
  await page.evaluate(()=>window.show(false));await page.locator('input').first().waitFor({state:'detached'});
  current=schema('Outra sessão','tabs');await page.evaluate(()=>window.show(true));
  await page.getByRole('tab',{name:'Outra sessão',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASSOU: cache de salvar/atualizar/publicar, reabertura, abas, ordem, linhas e larguras — '+width);await page.close();
 }
}finally{await browser.close();}

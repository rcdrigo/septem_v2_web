// Editor e hooks reais; API simulada para conferir o SQL enviado no teste e no save.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..'),dir=await mkdtemp(join(tmpdir(),'septem-sql-'));
const query=await readFile(join(root,'tools/uitest/fixtures/contract-types.sql'),'utf8');
const expected=query.replace('&#x20;','').trim();
await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {DataSourceDialog} from './src/pages/admin/FontesDadosPage';import {normalizeSqlQuery} from './src/lib/sql-query';import {useToastStore} from './src/stores/toast';
window.normalize=normalizeSqlQuery;window.messages=()=>useToastStore.getState().toasts.map(t=>t.message);
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><DataSourceDialog scope="process" fullPage onClose={()=>window.closedEditor=true}/></QueryClientProvider>);
`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),platform:'browser',format:'iife',tsconfig:join(root,'tsconfig.app.json'),define:{'import.meta.env':'{}'}});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage();page.setDefaultTimeout(15000);const requests=[],errors=[];let failSave=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://sql.local/**',async r=>{
  const req=r.request();if(!req.url().includes('/api/'))return r.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
  if(req.method()==='POST'){
   requests.push(req.postDataJSON());
   if(req.url().endsWith('/test'))return r.fulfill({json:{columns:['mes'],rows:[['Novo contrato']]}});
   if(failSave)return r.fulfill({status:400,json:{detail:'Nome da fonte já utilizado.'}});
   return r.fulfill({json:{id:'test'}});
  }
  return r.fulfill({json:[]});
 });
 await page.goto('http://sql.local/');await page.addScriptTag({path:join(dir,'app.js')});
 for(const [raw,clean] of [[query,expected],[" &#32;SELECT '&#x20;' AS texto;&#xA0;\n","SELECT '&#x20;' AS texto;"],["SELECT 1; SELECT 2","SELECT 1; SELECT 2"],["SELECT '&amp;' AS texto","SELECT '&amp;' AS texto"]])assert.equal(await page.evaluate(s=>window.normalize(s),raw),clean);
 await page.getByLabel('Nome',{exact:true}).fill('Tipos de contrato');
 await page.locator('#ds-form select').first().selectOption('sql');
 const sql=page.locator('textarea.font-mono');await sql.fill(query);
 await page.getByRole('button',{name:'Testar',exact:true}).click();await page.getByRole('cell',{name:'Novo contrato',exact:true}).waitFor();
 assert.equal(requests.at(-1).config.query,expected);assert.equal(await sql.inputValue(),expected);
 // Salvar sem testar também limpa a consulta; falhas mantêm a mensagem do servidor.
 await sql.fill(query);failSave=true;await page.getByRole('button',{name:'Salvar',exact:true}).click();
 await page.waitForFunction(()=>window.messages().includes('Nome da fonte já utilizado.'));assert.equal(requests.at(-1).config.query,expected);
 failSave=false;await sql.fill(query);await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.waitForFunction(()=>window.closedEditor);
 assert.equal(requests.at(-1).config.query,expected);assert.deepEqual(errors,[]);
 console.log('PASSOU: SQL copiado, literais preservados, testar, salvar e mensagem de erro.');
}finally{await browser.close();}

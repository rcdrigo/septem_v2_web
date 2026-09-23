// Regressões comportamentais de confirmação e foco, sem backend.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-dialog-'));
let browser;
try {
  await build({ stdin: { contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { Dialog } from './src/components/ui/Dialog';
    import { confirm, ConfirmDialogHost } from './src/components/ui/ConfirmDialog';
    function App() {
      const [open, setOpen] = useState(false);
      const [result, setResult] = useState('pending');
      return <><button onClick={async () => setResult(String(await confirm({title:'Excluir registro?',message:'Confirmação de teste',destructive:true})))}>Abrir confirmação</button>
        <output>{result}</output><button onClick={() => setOpen(true)}>Abrir formulário</button>
        <a href="#outside">Fora</a><ConfirmDialogHost />
        <Dialog open={open} onClose={() => setOpen(false)} title="Formulário"><input aria-label="Nome" /><button>Último</button></Dialog></>;
    }
    createRoot(document.getElementById('root')).render(<App />);
  `, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'app.js'), platform: 'browser', format: 'iife', tsconfig: join(root, 'tsconfig.app.json') });
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage();
  await page.route('https://dialog.test/', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><body><div id="root"></div></body></html>'}));
  await page.goto('https://dialog.test/');
  await page.addScriptTag({path:join(dir,'app.js')});
  const trigger = page.getByRole('button',{name:'Abrir confirmação'});
  await trigger.click();
  await page.getByRole('dialog',{name:'Excluir registro?'}).waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Cancelar');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('output').textContent==='false');
  await page.waitForFunction(()=>document.activeElement.textContent==='Abrir confirmação');
  await trigger.click();
  await page.getByRole('button',{name:'Confirmar',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('output').textContent==='true');
  await trigger.click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('output').textContent==='false');
  await page.getByRole('button',{name:'Abrir formulário'}).click();
  await page.getByRole('dialog',{name:'Formulário'}).waitFor();
  await page.getByRole('button',{name:'Último'}).focus();
  await page.keyboard.press('Tab');
  await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Fechar');
  await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(()=>document.activeElement.textContent==='Último');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement.textContent==='Abrir formulário');
  console.log('PASSOU: Cancelar/Confirmar por Enter, Escape, foco inicial, ciclo Tab e retorno ao disparador.');
} finally {
  await browser?.close();
  await rm(dir, {recursive:true,force:true});
}

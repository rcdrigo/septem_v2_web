import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-access-'));
let browser;
try {
  await build({ stdin: { contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {Sidebar} from './src/layout/Sidebar';
import {LoginPage} from './src/pages/LoginPage';
import {useSessionStore} from './src/stores/session';
const root=createRoot(document.getElementById('root'));let revision=0;
window.session=useSessionStore;
window.mount=(kind,internal=true,perms=['*'])=>{
useSessionStore.setState({status:kind==='login'?'unauthenticated':'authenticated',accessToken:null,accessMode:'interno',isImpersonating:false,tenant:{clienteNome:'Prefeitura',modulos:[]},user:kind==='login'?null:{id:'actor',name:'Ana',email:'ana@example.test',isInternal:internal,perms,accessProfiles:[]}});
root.render(<QueryClientProvider key={++revision} client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter>{kind==='login'?<LoginPage/>:<Sidebar mobileOpen/>}</MemoryRouter></QueryClientProvider>);
};`, resolveDir: root, loader: 'tsx' }, bundle: true, tsconfig: join(root,'tsconfig.app.json'), outfile: join(dir,'bundle.js'), platform:'browser', format:'iife', loader:{'.css':'empty'}, define:{'import.meta.env':'{}'} });
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage();page.setDefaultTimeout(4000);
  await page.route('https://access.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(!path.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
    if(path.endsWith('/access-options')){
      const identifier=route.request().postDataJSON().identifier;
      if(identifier==='slow@example.test')await new Promise(r=>setTimeout(r,600));
      return route.fulfill({json:{isInternal:identifier==='internal@example.test'||identifier==='slow@example.test'}});
    }
    if(path.endsWith('/login'))return route.fulfill({json:{twoFactorRequired:true,maskedEmail:'in***@example.test'}});
    return route.fulfill({json:{items:[],pendingCount:0}});
  });
  await page.goto('https://access.test');await page.addScriptTag({path:join(dir,'bundle.js')});
  const css = (await readdir(join(root, 'dist/assets'))).find(name => name.endsWith('.css'));
  await page.addStyleTag({path:join(root, 'dist/assets', css)});
  for(const width of [1280,375]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>window.mount('menu'));
    assert.equal(await page.getByRole('button',{name:'Sair',exact:true}).count(),0);
    await page.getByRole('button',{name:/Ana/}).click();
    await page.getByRole('menuitem',{name:'Acesso',exact:true}).hover();
    await page.screenshot({path:join(tmpdir(), `septem-user-menu-${width}.png`)});
    await page.getByRole('menuitemradio',{name:'Externo'}).click();
    assert.equal(await page.evaluate(()=>window.session.getState().effectiveMode()),'externo');
    await page.getByRole('button',{name:/Ana/}).click();
    await page.getByRole('menuitem',{name:'Acesso',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('menuitemradio',{name:'Interno'}).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('menuitemradio').count(),0);
    await page.getByRole('menuitem',{name:'Personificar',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    await page.evaluate(()=>window.mount('menu',false,[]));
    await page.getByRole('button',{name:/Ana/}).click();
    assert.equal(await page.getByRole('menuitem',{name:'Acesso',exact:true}).count(),0);
    assert.equal(await page.getByRole('menuitem',{name:'Personificar',exact:true}).count(),0);
    await page.evaluate(()=>window.mount('login'));
    assert.equal(await page.getByRole('radio').count(),0);
    await page.locator('[name=identifier]').fill('internal@example.test');
    await page.getByRole('radio',{name:'Externo',exact:true}).check();
    await page.screenshot({path:join(tmpdir(), `septem-login-access-${width}.png`)});
    await page.locator('[name=identifier]').fill('external@example.test');
    assert.equal(await page.getByRole('radio').count(),0);
    await page.locator('[name=identifier]').fill('slow@example.test');
    await page.waitForRequest(r=>r.url().endsWith('/access-options')&&r.postDataJSON().identifier==='slow@example.test');
    await page.locator('[name=identifier]').fill('external@example.test');
    await page.waitForTimeout(750);
    assert.equal(await page.getByRole('radio').count(),0,'ignores stale internal response');
    await page.locator('[name=identifier]').fill('internal@example.test');
    await page.getByRole('radio',{name:'Externo',exact:true}).check();
    await page.locator('[name=password]').fill('test-password');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.getByTestId('form-2fa').waitFor();
    assert.equal(await page.evaluate(()=>window.session.getState().accessMode),'externo','preserves mode for 2FA');
    console.log(`PASS ${width}px: menu, permissions, hover, keyboard, login lookup, stale response, 2FA selection`);
  }
}finally{await browser?.close();await rm(dir,{recursive:true,force:true});}

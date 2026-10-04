// Regression for the real creation wizard and central HTTP client; requests are intercepted.
import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-branding-ui-'));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
let browser;
async function waitUntil(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), 'mock request reached its expected boundary');
}
try {
  await build({stdin:{contents:`
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {MemoryRouter,Routes,Route} from 'react-router-dom';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import {PlatformNovoClientePage} from './src/pages/platform/PlatformNovoClientePage';
    import {configurePlatformApi} from './src/lib/platform-api';
    configurePlatformApi({getAccessToken:()=> 'platform-token',refresh:async()=>null,logout:async()=>{}});
    const revoked=[]; const revoke=URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);}; window.revoked=revoked;
    window.unmount=()=>app.unmount();
    const app=createRoot(document.getElementById('root'));
    app.render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/platform/clients/new']}><Routes><Route path='/platform/clients/new' element={<PlatformNovoClientePage/>}/><Route path='*' element={<p>Cliente criado</p>}/></Routes></MemoryRouter></QueryClientProvider>);
  `,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),format:'iife',platform:'browser',tsconfig:join(root,'tsconfig.app.json'),define:{'import.meta.env':JSON.stringify({VITE_API_URL:'https://api.test'})}});
  const css=(await Promise.all((await readdir(join(root,'dist/assets'))).filter(f=>f.endsWith('.css')).map(f=>readFile(join(root,'dist/assets',f),'utf8')))).join('\n');
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  for(const width of [1280,375]) {
    const context=await browser.newContext({viewport:{width,height:1000}});
    const writes=[],reads=[],errors=[];
    let releaseUpload, releasePreview, failUpload=false, uploadCount=0, created;
    const initialSettings={logoUrl:'/favicon.svg',heroImageUrl:'https://platform.test/default-hero.png',systemDescription:'Septem Compliance',businessHourStart:8,businessHourEnd:18,businessDays:'1,2,3,4,5',twoFactorMode:'off',maxLoginAttempts:5,lockoutMinutes:15,maxUploadMb:20,smtpPort:587,smtpUseSsl:true,smtpAuthMode:'login',s3UrlExpirationMinutes:15,s3UseSignedUrls:true,policies:{}};
    await context.route('https://platform.test/**',route=>route.request().url().endsWith('.png')||route.request().url().endsWith('.svg')?route.fulfill({contentType:'image/png',body:png}):route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}));
    await context.route('https://api.test/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(request.method()==='OPTIONS')return route.fulfill({headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:''});
      const fulfill=body=>route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:body});
      if(request.method()==='POST'&&path.includes('/brand-assets/')) {
        writes.push({path,headers:request.headers()}); uploadCount++;
        await new Promise(resolve=>{releaseUpload=resolve;});
        if(failUpload)return route.fulfill({status:400,headers:{'Access-Control-Allow-Origin':'*'},json:{detail:'Imagem recusada. Escolha PNG, JPEG, GIF ou WebP.'}});
        return fulfill({url:'/api/v1/branding/assets/'+uploadCount,previewUrl:'/api/v1/platform/brand-assets/'+uploadCount});
      }
      if(request.method()==='GET'&&path.includes('/brand-assets/')) {
        reads.push({path,headers:request.headers()});
        await new Promise(resolve=>{releasePreview=resolve;});
        return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'image/png',body:png});
      }
      if(path.endsWith('/provisioning-defaults'))return fulfill({displayName:'Septem Compliance',primaryColor:'#0ea5e9',baseDomain:'septemcompliance.com',initialSettings,storage:{sharedConfigured:true,bucketName:'shared'}});
      if(path.endsWith('/locations/states'))return fulfill({items:[{code:'PE',name:'Pernambuco'}]});
      if(path.endsWith('/cities'))return fulfill({items:[{code:'2611606',name:'Recife',timeZoneId:'America/Recife'}]});
      if(path.endsWith('/provisioning-availability'))return fulfill({available:true,production:{tenantId:'cliente',host:'cliente.septemcompliance.com',dbName:'cliente',errors:[]},staging:{tenantId:'hml-cliente',host:'hml-cliente.septemcompliance.com',dbName:'cliente_hml',errors:[]}});
      if(request.method()==='POST'&&path.endsWith('/clients/')){created=request.postDataJSON();return fulfill({clientId:'novo',operations:[]});}
      return fulfill({items:[],sources:[],total:0});
    });
    const page=await context.newPage(); page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
    async function open(){await page.goto('https://platform.test/');await page.addStyleTag({content:css});await page.addScriptTag({path:join(dir,'app.js')});try {await page.getByRole('button',{name:'Enviar logo',exact:true}).waitFor();} catch(error) { console.log(await page.locator('body').innerText(), errors); throw error; }}
    async function submit(){
      await page.getByLabel('Nome do cliente',{exact:true}).fill('Cliente Teste');
      for(let step=0;step<2;step++)await page.getByRole('button',{name:'Avançar',exact:true}).click();
      await page.getByRole('button',{name:/Cadastrar|Provisionar/}).click();
      await page.getByText('Cliente criado',{exact:true}).waitFor();
    }
    await open();
    assert.equal(await page.getByRole('button',{name:/Usar padrão/}).count(),0);
    await submit();
    assert.equal(created.initialSettings.logoUrl,initialSettings.logoUrl);
    assert.equal(created.initialSettings.heroImageUrl,initialSettings.heroImageUrl);
    assert.equal(writes.length,0,'default images require no upload');
    await open();
    for(const kind of ['logo','hero']) {
      releaseUpload=undefined;releasePreview=undefined;
      await page.locator('#brand-'+kind).setInputFiles({name:kind+'.png',mimeType:'image/png',buffer:png});
      const button=page.getByRole('button',{name:kind==='logo'?'Enviando logo…':'Enviando imagem…',exact:true});
      await button.waitFor();
      assert.equal(await button.isDisabled(),true);
      assert.equal(await button.getAttribute('aria-busy'),'true');
      assert.equal(await page.getByRole('button',{name:'Avançar',exact:true}).isDisabled(),true);
      if(kind==='logo')await page.screenshot({path:join(tmpdir(),`septem-branding-loading-${width}.png`),fullPage:true});
      await waitUntil(()=>releaseUpload);releaseUpload();
      await waitUntil(()=>releasePreview);
      assert.equal(await button.isDisabled(),true,'loading covers the authenticated preview download');releasePreview();
      await page.getByRole('button',{name:kind==='logo'?'Enviar logo':'Enviar imagem de destaque',exact:true}).waitFor();
      if(kind==='logo')await page.waitForFunction(()=>document.querySelector('img[alt="Logo do ambiente"]')?.naturalWidth>0);
      else await page.waitForFunction(()=>document.querySelector('[aria-label="Prévia da identidade"] > div')?.style.backgroundImage.includes('blob:'));
    }
    assert.ok(reads.every(r=>r.headers.authorization==='Bearer platform-token'&&!r.headers['x-tenant']));
    assert.ok(writes.every(r=>r.headers.authorization==='Bearer platform-token'&&!r.headers['x-tenant']));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.screenshot({path:join(tmpdir(),`septem-branding-preview-${width}.png`),fullPage:true});
    const previousLogo=await page.getByAltText('Logo do ambiente').getAttribute('src');
    failUpload=true;releaseUpload=undefined;
    await page.locator('#brand-logo').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:png});
    await page.getByRole('button',{name:'Enviando logo…',exact:true}).waitFor();
    await waitUntil(()=>releaseUpload);releaseUpload();
    await page.getByRole('alert').filter({hasText:'Imagem recusada'}).waitFor();
    assert.equal(await page.getByAltText('Logo do ambiente').getAttribute('src'),previousLogo);
    assert.equal(await page.getByRole('button',{name:'Enviar logo',exact:true}).isEnabled(),true);
    failUpload=false;
    await submit();
    assert.ok(created.initialSettings.logoUrl.startsWith('/api/v1/branding/assets/'));
    assert.ok(created.initialSettings.heroImageUrl.startsWith('/api/v1/branding/assets/'));
    assert.ok(!JSON.stringify(created).includes('blob:'),'only persistent asset URLs go into provisioning');
    assert.equal(await page.evaluate(()=>window.revoked.length),2,'preview URLs are released on unmount');
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}: defaults, loading buttons, authenticated previews, upload failure recovery, persistent URLs and cleanup.`);
    await context.close();
  }
}finally{await browser?.close();await rm(dir,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import {build} from '../../node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright-core';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),dir=await mkdtemp(join(tmpdir(),'septem-platform-session-'));
let browser;
try {
 await build({stdin:{contents:`import {platformApi} from './src/lib/platform-api';import {usePlatformSession} from './src/stores/platform-session';usePlatformSession.setState({status:'authenticated'});window.call=(blob=false)=> (blob?platformApi.getBlob('/clients'):platformApi.get('/clients')).then(async value=>({ok:true,value:value instanceof Blob?Array.from(new Uint8Array(await value.arrayBuffer())):value}),error=>({ok:false,status:error.status}));window.login=()=>usePlatformSession.getState().login('admin@example.test','password');window.complete=trust=>usePlatformSession.getState().completeTwoFactor('admin@example.test','123456',trust);window.snapshot=()=>({status:usePlatformSession.getState().status,reauthentication:usePlatformSession.getState().reauthenticationRequired,access:localStorage.getItem('septem.platform.accessToken'),refresh:localStorage.getItem('septem.platform.refreshToken'),device:localStorage.getItem('septem.platform.deviceToken'),tenantAccess:localStorage.getItem('septem.accessToken'),tenantDevice:localStorage.getItem('septem.deviceToken')});`,resolveDir:root,loader:'tsx'},bundle:true,outfile:join(dir,'app.js'),platform:'browser',format:'iife',tsconfig:join(root,'tsconfig.app.json'),define:{'import.meta.env':'{}'}});
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const mode of ['mfa','mfa-refresh','mfa-retry','concurrent','blob','trust','held-mfa-login']) {
  const context=await browser.newContext(),page=await context.newPage(),requests=[];let refreshCount=0,enter,release;
  const entered=new Promise(resolve=>enter=resolve),held=new Promise(resolve=>release=resolve);
  await context.addInitScript(()=>{localStorage.setItem('septem.platform.accessToken','platform-old');localStorage.setItem('septem.platform.refreshToken','refresh-old');localStorage.setItem('septem.platform.deviceToken','device-old');localStorage.setItem('septem.accessToken','tenant-token');localStorage.setItem('septem.deviceToken','tenant-device');});
  await context.route('https://central.local/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(path==='/')return route.fulfill({contentType:'text/html',body:'<div></div>'});
   requests.push({path,headers:request.headers(),body:request.postData()?request.postDataJSON():undefined});
   if(path.endsWith('/auth/login'))return route.fulfill({json:mode==='trust'&&request.postDataJSON().deviceToken!=='device-month'?{twoFactorRequired:true,maskedEmail:'a***@example.test'}:{accessToken:'platform-new',refreshToken:'refresh-new'}});
   if(path.endsWith('/auth/2fa'))return route.fulfill({json:{accessToken:'platform-new',refreshToken:'refresh-new',deviceToken:'device-month'}});
   if(path.endsWith('/auth/refresh')){
    refreshCount++;if(mode==='held-mfa-login'){enter();await held;}
    if(mode==='mfa-refresh'||mode==='held-mfa-login')return route.fulfill({status:401,json:{error:'mfa_reauthentication_required'}});
    await new Promise(resolve=>setTimeout(resolve,30));return route.fulfill({json:{accessToken:'platform-new',refreshToken:'refresh-new'}});
   }
   if(path.endsWith('/me'))return route.fulfill({json:{id:'admin',name:'Ana',email:'admin@example.test',roles:['super_admin'],globalAccess:true}});
   if(mode==='mfa'||(mode==='mfa-retry'&&request.headers().authorization==='Bearer platform-new'))return route.fulfill({status:401,json:{error:'mfa_reauthentication_required'}});
   if(request.headers().authorization==='Bearer platform-old')return route.fulfill({status:401,json:{error:'expired'}});
   return mode==='blob'?route.fulfill({contentType:'application/octet-stream',body:Buffer.from([0,255,42])}):route.fulfill({json:{items:[]}});
  });
  await page.goto('https://central.local/');await page.addScriptTag({path:join(dir,'app.js')});
  if(mode==='trust') {
   assert.deepEqual(await page.evaluate(()=>window.login()),{maskedEmail:'a***@example.test'});await page.evaluate(()=>window.complete(true));const code=requests.find(x=>x.path.endsWith('/2fa'));assert.equal(code.body.trustDevice,true);assert.equal((await page.evaluate(()=>window.snapshot())).device,'device-month');assert.deepEqual(await page.evaluate(()=>window.login()),{kind:'ok'});assert.equal(requests.filter(x=>x.path.endsWith('/login')).at(-1).body.deviceToken,'device-month');assert.equal(refreshCount,0);
  } else if(mode==='held-mfa-login') {
   const pending=page.evaluate(()=>window.call());await entered;await page.evaluate(()=>window.login());release();assert.equal((await pending).ok,true);assert.equal((await page.evaluate(()=>window.snapshot())).access,'platform-new');assert.equal((await page.evaluate(()=>window.snapshot())).reauthentication,false);assert.equal(refreshCount,1);
  } else {
   const result=await page.evaluate(mode=>mode==='concurrent'?Promise.all(Array.from({length:4},()=>window.call())):window.call(mode==='blob'),mode);
   if(mode.startsWith('mfa')) {assert.equal(result.status,401);const state=await page.evaluate(()=>window.snapshot());assert.equal(state.status,'unauthenticated');assert.equal(state.access,null);assert.equal(state.refresh,null);assert.equal(state.device,null);assert.equal(state.reauthentication,true);assert.equal(refreshCount,mode==='mfa'?0:1);}
   else {assert.ok((Array.isArray(result)?result:[result]).every(x=>x.ok));assert.equal(refreshCount,1);if(mode==='blob')assert.deepEqual(result.value,[0,255,42]);}
  }
  const state=await page.evaluate(()=>window.snapshot());assert.equal(state.tenantAccess,'tenant-token');assert.equal(state.tenantDevice,'tenant-device');assert.ok(requests.every(x=>!x.headers['x-tenant']));assert.ok(requests.filter(x=>x.path.endsWith('/clients')).every(x=>x.headers.authorization.startsWith('Bearer platform-')));console.log('PASS central '+mode+': isolated identity, MFA policy, trusted-device contract and renewal semantics.');release();await context.close();
 }
}finally{await browser?.close();await rm(dir,{recursive:true,force:true});}

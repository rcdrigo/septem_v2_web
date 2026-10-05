// End-to-end against the isolated SeptemApiFactory bridge and real PostgreSQL.
// No response interception. DNS/TLS/provider adapters belong to the external test host.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const api=(process.env.API_URL??'http://localhost:5058').replace(/\/$/,''),front=(process.env.FRONT_URL??'http://localhost:5173').replace(/\/$/,''),output=process.env.OUT_DIR??join(tmpdir(),'septem-onboarding-integration');
assert.ok(['localhost','127.0.0.1'].includes(new URL(api).hostname),'Only the local isolated application bridge is permitted.');
async function jsonFetch(path,{token,tenant,method='GET',body,expected=200,base=api}={}) {
 const response=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(tenant?{'X-Tenant':tenant}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw new Error(`${method} ${path}: expected JSON, received HTTP ${response.status}. Check Vite proxy/API prerequisites.`);}
 if(expected!==null)assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);
 return {status:response.status,data};
}
let marker;
try {marker=(await jsonFetch('/__septem_ui_test_host')).data;}catch(error){throw new Error(`Prerequisite missing: isolated SeptemApiFactory bridge at ${api}. ${error.message}`);}
assert.deepEqual(marker,{isolated:true,externalResources:'simulated',database:'temporary-postgres',application:'SeptemApiFactory'},'Refusing to create clients outside the isolated test database.');
const frontResponse=await fetch(front,{signal:AbortSignal.timeout(15000)}).catch(error=>{throw new Error(`Prerequisite missing: Vite at ${front}, using VITE_API_PROXY_TARGET=${api}. ${error.message}`);});assert.equal(frontResponse.status,200,'Vite must be ready before browser tests.');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const records=[];
try {
 for(const width of [1280,375]) {
  const context=await browser.newContext({viewport:{width,height:width===375?812:900}}),page=await context.newPage(),errors=[],creationRequests=[];
  page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/api/v1/platform/clients/'))creationRequests.push(request.postDataJSON());});
  async function inspect(name){const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,clipped:[...document.querySelectorAll('input:not([type=hidden]),select,textarea,button')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&r.right>0&&r.left<innerWidth&&(r.left< -1||r.right>innerWidth+1)}).map(el=>el.outerHTML.slice(0,120))}));assert.deepEqual(layout,{overflow:false,clipped:[]});await page.screenshot({path:join(output,`${name}-${width}.png`),fullPage:true});}
  await page.goto(front+'/platform/login');await page.getByLabel('E-mail',{exact:true}).fill('super@septem.local');await page.getByLabel('Senha',{exact:true}).fill('super123');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByTestId('platform-2fa-aviso').waitFor();
  const centralCode=(await jsonFetch('/api/v1/platform/auth/dev/last-code?email=super%40septem.local')).data.code;assert.match(centralCode,/^\d{6}$/);await page.getByLabel('Código',{exact:true}).fill(centralCode);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(/\/platform\/clients$/);
  const centralToken=await page.evaluate(()=>localStorage.getItem('septem.platform.accessToken'));assert.ok(centralToken);
  const defaults=(await jsonFetch('/api/v1/platform/provisioning-defaults',{token:centralToken})).data;
  const frontDefaults=(await jsonFetch('/api/v1/platform/provisioning-defaults',{token:centralToken,base:front})).data;assert.deepEqual(frontDefaults,defaults,'Vite API proxy must point at the isolated bridge.');
  const name=`UI Cadastro ${width} ${Date.now()}`,snake=name.toLowerCase().replace(/[^a-z0-9]+/g,'_'),slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  await page.goto(front+'/platform/clients/new');await page.getByLabel('Nome do cliente',{exact:true}).fill(name);assert.equal(await page.getByTestId('assistente-etapas').locator('li').count(),3);assert.equal(await page.getByRole('combobox').count(),0);await inspect('identity');await page.getByRole('button',{name:'Avançar',exact:true}).click();
  assert.equal(await page.getByLabel('Subdomínio de produção',{exact:true}).inputValue(),slug);for(const option of ['Servidor de e-mail','Servidor de armazenamento','Provedor de IA'])assert.equal(await page.getByRole('checkbox',{name:option,exact:true}).isChecked(),false);assert.equal(await page.getByRole('checkbox',{name:/Administrado pela Septem/}).isChecked(),true);await inspect('parameters');
  await page.getByRole('button',{name:'Avançar',exact:true}).click();await page.getByRole('heading',{name:'Revise antes de criar'}).waitFor();await inspect('review');
  const creation=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/api/v1/platform/clients/')&&response.request().method()==='POST');await page.getByRole('button',{name:'Cadastrar e provisionar',exact:true}).click();const creationResponse=await creation;assert.ok(creationResponse.ok(),`Real client creation failed: HTTP ${creationResponse.status()} ${await creationResponse.text()}`);const created=await creationResponse.json();assert.ok(created.clientId);await page.waitForURL(new RegExp(`/platform/clients/${created.clientId}$`));
  let detail;const deadline=Date.now()+180000;
  do {detail=(await jsonFetch(`/api/v1/platform/clients/${created.clientId}`,{token:centralToken})).data;if(detail.environments?.length===2&&detail.environments.every(env=>env.provisioningState==='ready'))break;const operations=await Promise.all((created.operations??[]).map(operation=>jsonFetch(`/api/v1/platform/operations/${operation.operationId}`,{token:centralToken}).then(r=>r.data)));if(operations.some(operation=>operation.status==='failed'||operation.status==='error'))throw new Error(`Provisioning failed: ${JSON.stringify(operations)}`);await new Promise(resolve=>setTimeout(resolve,1000));}while(Date.now()<deadline);
  assert.equal(detail.environments.length,2);assert.ok(detail.environments.every(env=>env.provisioningState==='ready'),`Provisioning did not finish: ${JSON.stringify(detail)}`);
  const prod=detail.environments.find(env=>env.purpose==='production'),hml=detail.environments.find(env=>env.purpose==='staging');assert.ok(prod&&hml);assert.equal(prod.databaseName,snake);assert.equal(hml.databaseName,snake+'_hml');assert.equal(prod.tenantId,slug);assert.equal(hml.tenantId,'hml-'+slug);assert.equal(prod.host,slug+'.'+defaults.baseDomain);assert.equal(hml.host,'hml-'+slug+'.'+defaults.baseDomain);
  assert.equal(creationRequests.length,1);for(const field of ['initialSecrets','initialProcessSelections','businessHours','stateCode'])assert.equal(field in creationRequests[0],false);assert.equal(creationRequests[0].production.seedDummyData,undefined);
  for(const env of [prod,hml]) {
   assert.equal(env.displayName,defaults.displayName);
   const settings=(await jsonFetch(`/api/v1/platform/environments/${env.tenantId}/settings/`,{token:centralToken})).data;
   for(const key of ['email','storage','openRouter']) {const policyKey=Object.keys(settings.policies).find(k=>k.toLowerCase()===key.toLowerCase());assert.ok(policyKey);assert.deepEqual(settings.policies[policyKey],{visible:false,editable:false});}
   for(const key of ['logoUrl','heroImageUrl','systemDescription'])assert.equal(settings[key],defaults.initialSettings[key]);assert.equal(settings.twoFactorMode,'all');assert.ok(!settings.stateCode&&!settings.cityCode);
   const publicConfig=(await jsonFetch('/api/tenant/config',{tenant:env.tenantId})).data;assert.equal(publicConfig.calendarReady,false);assert.equal(publicConfig.ambienteNome,defaults.displayName);assert.equal('clienteNome' in publicConfig,false);
   const services=(await jsonFetch('/api/v1/public/services',{tenant:env.tenantId})).data;assert.deepEqual(services,[],'Creation installs no catalog processes.');
  }
  const invites=(await jsonFetch(`/api/v1/platform/clients/${created.clientId}/admin-invites`,{token:centralToken})).data;assert.deepEqual(invites.items,[]);const metrics=(await jsonFetch(`/api/v1/platform/clients/${created.clientId}/metrics`,{token:centralToken})).data;assert.equal(metrics.internalUsers,1,'Production starts with the authorized superadmin user.');assert.equal(metrics.externalUsers,0);
  const before=(await jsonFetch('/api/v1/platform/clients/',{token:centralToken})).data.total;
  for(const [candidate,candidateSlug] of [[name,slug+'-duplicate'],[name+' Hml',slug+'-collision']]) {
   const query=new URLSearchParams({name:candidate,slug:candidateSlug});const availability=(await jsonFetch('/api/v1/platform/provisioning-availability?'+query,{token:centralToken})).data;assert.equal(availability.available,false,'Names and derived database collisions must be rejected before provisioning.');
   const rejected=await jsonFetch('/api/v1/platform/clients/',{token:centralToken,method:'POST',expected:null,body:{...creationRequests[0],name:candidate,production:{tenantId:candidateSlug},staging:{tenantId:'hml-'+candidateSlug}}});assert.ok([400,409,422].includes(rejected.status),`Conflicting client unexpectedly accepted: ${JSON.stringify(rejected)}`);
  }
  assert.equal((await jsonFetch('/api/v1/platform/clients/',{token:centralToken})).data.total,before,'Rejected registrations leave no partial clients.');await inspect('provisioned');
  // Tenant login goes through its own real MFA and token namespace in the browser.
  await page.goto(front+'/login');await page.getByLabel('CPF ou e-mail',{exact:true}).fill('admin@prefeitura-x.local');await page.getByLabel('Senha',{exact:true}).fill('admin123');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByTestId('form-2fa').waitFor();
  const tenantCode=(await jsonFetch('/api/v1/auth/dev/last-code?identifier=admin%40prefeitura-x.local&purpose=2fa',{tenant:'prefeitura-x'})).data.code;assert.match(tenantCode,/^\d{6}$/);await page.getByTestId('form-2fa').getByRole('textbox').fill(tenantCode);await page.getByRole('button',{name:'Confirmar',exact:true}).click();await page.waitForFunction(()=>!!localStorage.getItem('septem.accessToken'));
  await page.goto(front+'/admin/settings');await page.getByRole('textbox',{name:/Nome do sistema/}).waitFor();assert.equal(await page.getByRole('tab',{name:'Segurança',exact:true}).count(),0);assert.equal(await page.getByRole('textbox',{name:/Nome do cliente/}).count(),0);assert.equal(await page.getByRole('textbox',{name:/Nome do sistema/}).isEnabled(),true);await inspect('tenant-settings');assert.deepEqual(errors,[]);
  records.push({width,clientId:created.clientId,name,production:prod.tenantId,staging:hml.tenantId});console.log(`PASS real API ${width}: central/tenant browser MFA, name-only creation, real databases/jobs, defaults, pair reservation, collision rejection, no client administrator/processes and immutable settings.`);await context.close();
 }
 await writeFile(join(output,'created-fixtures.json'),JSON.stringify(records,null,2));console.log(`PASS real application/PostgreSQL; screenshots: ${output}. Fixture databases belong to the disposable test host.`);
}finally{await browser.close();}

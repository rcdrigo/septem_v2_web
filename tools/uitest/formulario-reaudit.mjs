// Reauditoria da Fase 4 (formulário): garante que (A) o Salvar do MODELADOR preserva
// as props novas no schema — o risco de "efeito não fiado ponta a ponta" — e (B) as
// variantes de regra server-side que as suítes por bloco não cobriram (cpfCnpj
// dinâmico, CNPJ, não-passado, hora, limite de tamanho).
import { chromium } from 'playwright-core';
const BASE='http://localhost:5173',API='http://localhost:5000';
const ok=[],bad=[];const check=(c,m)=>{(c?ok:bad).push(m);};
const api=async(t,p,m='GET',b)=>{const r=await fetch(API+p,{method:m,headers:{'Content-Type':'application/json','X-Tenant':'prefeitura-x',...(t?{Authorization:`Bearer ${t}`}:{})},body:b?JSON.stringify(b):undefined});return{status:r.status,body:await r.json().catch(()=>null)};};
const {body:a}=await api(null,'/api/v1/auth/login','POST',{identifier:'admin@prefeitura-x.local',password:'admin123'});
const t=a.accessToken;

// ── B) Variantes de regra server-side (via API) ─────────────────────────────
{
  const xmlOf=(form,name)=>`<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x"><bpmn:process id="P" name="${name}" isExecutable="true"><bpmn:extensionElements><septem:formSchema>${JSON.stringify(form)}</septem:formSchema></bpmn:extensionElements><bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent><bpmn:userTask id="T" name="Tarefa"><bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok" label="OK"/></septem:actionButtons></bpmn:extensionElements><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask><bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T"/><bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E"/></bpmn:process></bpmn:definitions>`;
  const novoProc=async(form)=>{const s=await api(t,'/api/v1/workflow/process-definitions','POST',{bpmnXml:xmlOf(form,'Reaudit '+Math.random())});const k=s.body.key;await api(t,`/api/v1/workflow/process-definitions/${k}/status`,'PATCH',{status:'published'});return k;};
  const novaTask=async(k)=>(await api(t,'/api/v1/workflow/instances','POST',{key:k,data:{}})).body.tasks[0].id;
  const concluir=async(id,data)=>api(t,`/api/v1/workflow/tasks/${id}/complete`,'POST',{action:'ok',data});

  const kd=await novoProc({components:[{type:'textfield',key:'doc',label:'Doc',properties:{septemDocKind:'cpfCnpj'}}]});
  check((await concluir(await novaTask(kd),{doc:'529.982.247-25'})).status===200,'B/4a cpfCnpj: CPF válido (11) conclui');
  check((await concluir(await novaTask(kd),{doc:'11.222.333/0001-81'})).status===200,'B/4a cpfCnpj: CNPJ válido (14) conclui');
  check((await concluir(await novaTask(kd),{doc:'11.222.333/0001-80'})).status===422,'B/4a cpfCnpj: CNPJ inválido = 422');
  const kc=await novoProc({components:[{type:'textfield',key:'cnpj',label:'CNPJ',properties:{septemDocKind:'cnpj'}}]});
  const rc=await concluir(await novaTask(kc),{cnpj:'11.222.333/0001-80'});
  check(rc.status===422&&rc.body?.fields?.cnpj?.includes('CNPJ'),'B/4a cnpj: inválido = 422 "CNPJ inválido"');

  const kp=await novoProc({components:[{type:'datetime',key:'d',label:'D',properties:{septemDateMode:'date',septemDateLimit:'noPast'}}]});
  const rp=await concluir(await novaTask(kp),{d:'2000-01-01'});
  check(rp.status===422&&rp.body?.fields?.d?.includes('passado'),'B/4b noPast: passado = 422 "passado"');
  check((await concluir(await novaTask(kp),{d:'2099-01-01'})).status===200,'B/4b noPast: futuro conclui');
  const kt=await novoProc({components:[{type:'datetime',key:'h',label:'H',properties:{septemDateMode:'time',septemDateLimit:'noFuture'}}]});
  check((await concluir(await novaTask(kt),{h:'23:59'})).status===200,'B/4b time: hora ignora passado/futuro');

  await api(t,'/api/v1/settings/storage','PUT',{bucketName:null,region:null,endpoint:null,accessKey:null,baseFolder:null,cdnUrl:null,useSignedUrls:false,urlExpirationMinutes:60,storageClass:null,encryption:null,maxUploadMb:1,blockedExtensions:'exe',secretKey:''});
  const ka=await novoProc({components:[{type:'filepicker',key:'anexo',label:'A',properties:{}}]});
  const taskId=await novaTask(ka);
  const fd=new FormData();fd.append('file',new Blob([new Uint8Array(2*1024*1024)]),'grande.pdf');fd.append('taskId',taskId);fd.append('fieldKey','anexo');
  const up=await fetch(API+'/api/v1/workflow/uploads',{method:'POST',headers:{'X-Tenant':'prefeitura-x',Authorization:`Bearer ${t}`},body:fd});
  const ub=await up.json().catch(()=>null);
  check(up.status===422&&ub?.detail?.includes('1 MB'),'B/4c tamanho: acima do limite = 422');
  await api(t,'/api/v1/settings/storage','PUT',{bucketName:null,region:null,endpoint:null,accessKey:null,baseFolder:null,cdnUrl:null,useSignedUrls:false,urlExpirationMinutes:60,storageClass:null,encryption:null,maxUploadMb:25,blockedExtensions:'exe,bat,cmd',secretKey:''});
}

// ── A) Round-trip pelo modelador ────────────────────────────────────────────
// processo novo com diagrama e nome único
const orig=await api(t,'/api/v1/workflow/process-definitions/teste_condicoes_ui');
const nome=`Reaudit RT ${Math.floor(Math.random()*1e9)}`;
const xml=orig.body.bpmnXml.replace(/(<bpmn:process\b[^>]*\bname=")[^"]*(")/,`$1${nome}$2`);
const saved=await api(t,'/api/v1/workflow/process-definitions','POST',{bpmnXml:xml});
const key=saved.body.key;

const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true});
const page=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE ERR:',m.text().slice(0,140));});
await page.goto(BASE+'/login',{waitUntil:'networkidle'});
await page.fill('input[name=identifier]','admin@prefeitura-x.local');await page.fill('input[type=password]','admin123');
await page.click('button[type=submit]');await page.waitForURL(u=>!u.pathname.includes('login'));
await page.goto(`${BASE}/processos/editar?key=${key}`,{waitUntil:'networkidle'});
await page.waitForSelector('[data-element-id="T005"]',{state:'attached',timeout:20000});
await page.getByRole('button',{name:'Formulário',exact:true}).click();
await page.waitForTimeout(2500);

// 1) Texto → Documento=CPF (Aparência)
await page.getByRole('button',{name:'Texto',exact:true}).click();
await page.waitForTimeout(700);
await page.locator('button',{hasText:'Aparência'}).first().click();
await page.waitForTimeout(300);
await page.selectOption('select:has(option:text-is("CPF"))','cpf');
await page.waitForTimeout(300);

// 2) Data/Hora → Restrição=não permitir passado (Validação)
await page.getByRole('button',{name:'Data / Hora'}).click();
await page.waitForTimeout(700);
await page.locator('button',{hasText:'Validação'}).first().click();
await page.waitForTimeout(300);
await page.selectOption('select:has(option:text-is("Não permitir data no passado"))','noPast');
await page.waitForTimeout(300);

// 3) Upload → extensão dwg (Geral)
await page.getByRole('button',{name:'Upload de arquivo'}).click();
await page.waitForTimeout(700);
await page.locator('[data-testid=ext-picker] input').fill('dwg');
await page.waitForTimeout(300);
await page.locator('[data-testid=ext-picker] button',{hasText:'.dwg'}).first().click();
await page.waitForTimeout(400);

// SALVAR pelo modelador
await page.locator('header button',{hasText:'Salvar'}).first().click();
await page.waitForTimeout(3000);

// Lê o schema PERSISTIDO e confere as props
const det=await api(t,`/api/v1/workflow/process-definitions/${key}`);
const m=(det.body.bpmnXml||'').match(/<septem:formSchema>([\s\S]*?)<\/septem:formSchema>/);
const schema=m?JSON.parse(m[1]):null;
const all=JSON.stringify(schema);
check(!!schema,'modelador salvou o formulário (septem:formSchema presente)');
check(all.includes('"septemDocKind":"cpf"'),'round-trip: Documento=CPF sobreviveu ao Salvar');
check(all.includes('"septemDateLimit":"noPast"'),'round-trip: Restrição de data=noPast sobreviveu ao Salvar');
check(all.includes('"septemAllowedExts"')&&all.includes('dwg'),'round-trip: extensão dwg do anexo sobreviveu ao Salvar');
await page.screenshot({path:`${process.env.OUT_DIR||'.'}/reaudit-roundtrip.png`,fullPage:true});
await b.close();
ok.forEach(x=>console.log('✓ '+x));bad.forEach(x=>console.log('✗ '+x));
console.log(bad.length===0?`\nPASSOU (${ok.length})`:`\nFALHOU (${bad.length} de ${ok.length+bad.length})`);
process.exit(bad.length?1:0);

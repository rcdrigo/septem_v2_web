// Regressões dos formulários: componentes reais e API simulada, sem gravações.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'septem-form-regressions-'));
const root = resolve(import.meta.dirname, '../..');
await build({ stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {ReactForm} from './src/components/form/ReactForm';
const root=createRoot(document.getElementById('root')), ref=React.createRef(), client=new QueryClient({defaultOptions:{queries:{retry:false}}});let id=0;
window.mount=(components,data={},reset=true,readOnly=false)=>{if(reset)id++;flushSync(()=>root.render(<QueryClientProvider client={client}><ReactForm key={id} ref={ref} schema={{components}} data={data} readOnly={readOnly}/></QueryClientProvider>));};
window.submit=()=>ref.current.submit();window.data=()=>ref.current.getData();
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'bundle.js'), format: 'iife', platform: 'browser', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' } });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = [];
try {
  for (const width of [1280, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('http://audit.local/**', r => r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto('http://audit.local/'); await page.addScriptTag({ path: join(dir, 'bundle.js') });
    const mount = (components, data = {}, reset = true) => page.evaluate(({components,data,reset}) => window.mount(components,data,reset), {components,data,reset});
    const submit = () => page.evaluate(() => window.submit());
    const check = (label, actual, expected) => { assert.deepEqual(actual, expected, label); results.push(`${width}: ${label}`); };
    const field = (key, extra = {}) => ({type:'textfield',key,label:key,...extra});
    await mount([field('a',{properties:{septemEvents:JSON.stringify([{type:'change',action:"set('b',value); set('c',get('b'))"}])}}),field('b'),field('c')],{a:'antigo'});
    await page.locator('input').first().fill('novo');check('eventos usam snapshot atual',await page.evaluate(()=>window.data()),{a:'novo',b:'novo',c:'novo'});
    await mount([{type:'filepicker',key:'anexo',validate:{required:true}},{type:'dynamiclist',key:'itens',components:[{type:'datetime',key:'data',label:'Data',subtype:'date',properties:{septemDateLimit:'noPast'},validate:{required:true}}]}],{anexo:[],itens:[{data:'2000-01-01'},{}]});
    check('anexos e linhas validados',Object.keys((await submit()).errors).sort(),['anexo','itens.0.data','itens.1.data']);
    check('erro visível na linha',await page.locator('.text-rose-600').filter({hasText:'A data não pode ser no passado.'}).count(),1);
    await mount([{type:'dynamiclist',key:'linhas',components:[field('a',{properties:{septemEvents:JSON.stringify([{type:'change',action:"set('b',value)"}])}}),field('b')]}],{linhas:[{a:'um',b:''},{a:'dois',b:''}]});
    await page.locator('[data-indice="1"] input').first().fill('atual');check('evento com escopo da linha',await page.evaluate(()=>window.data()),{linhas:[{a:'um',b:''},{a:'atual',b:'atual'}]});
    await mount([{type:'dynamiclist',key:'linhas',components:[{type:'datetime',key:'data',subtype:'date',validate:{required:true}}]}],{linhas:[{}, {data:'2026-09-05'}]});
    await page.locator('[data-indice="0"] [data-date-picker-input]').fill('31');
    await submit();await page.locator('[data-indice="0"]').getByRole('button',{name:'Remover item',exact:true}).click();
    check('remover linha elimina erros da linha excluída',(await submit()).errors,{});
    check('remover linha preserva valor seguinte',(await submit()).data,{linhas:[{data:'2026-09-05'}]});
    await mount([{type:'dynamiclist',key:'grupos',components:[{type:'dynamiclist',key:'itens',components:[field('a',{properties:{septemEvents:JSON.stringify([{type:'change',action:"set('b',value)"}])}}),field('b')]}]}],{grupos:[{itens:[{a:'antigo',b:''}]}]});
    await page.locator('input').first().fill('novo');check('evento em lista aninhada',(await submit()).data,{grupos:[{itens:[{a:'novo',b:'novo'}]}]});
    await mount([field('origem',{properties:{septemEvents:JSON.stringify([{type:'change',action:"setDisabled('destino',true)"}])}}),field('destino',{validate:{required:true}})]);
    await page.locator('input').first().fill('teste');check('desabilitado não bloqueia', (await submit()).errors,{});
    for (const type of ['checklist','taglist']) {
      await mount([{type,key:'opcoes',label:'Opções',values:[{label:'Um',value:'1'},{label:'Dois',value:'2'}],validate:{required:true}}]);
      check(`${type} obrigatório`,Object.keys((await submit()).errors),['opcoes']);
      await page.getByLabel('Um',{exact:true}).check();await page.getByLabel('Dois',{exact:true}).check();
      check(`${type} salva array`,(await submit()).data.opcoes,['1','2']);
    }
    await mount([{type:'html',content:'<b>Conteúdo configurado</b><script>throw 1</script>'},{type:'image',source:'data:image/png;base64,',alt:'Imagem'}]);
    check('HTML renderizado',await page.locator('#root b').innerText(),'Conteúdo configurado');check('imagem renderizada',await page.locator('img').count(),1);check('script removido',await page.locator('#root script').count(),0);
    await mount([field('nome')],{nome:'A'});await page.locator('input').fill('rascunho');await mount([field('nome')],{nome:'refetch'},false);check('refetch preserva edição',await page.evaluate(()=>window.data()),{nome:'rascunho'});
    await mount([field('nome')],{nome:'B'});check('nova identidade descarta edição antiga',await page.evaluate(()=>window.data()),{nome:'B'});

    const help='<a href="#orientacao">Orientação</a>';
    await mount([field('primeiro'),{type:'group',label:'Grupo',properties:{septemHelpType:'popover',septemHelpText:help},components:[field('segundo',{properties:{septemHelpType:'popover',septemHelpText:help}}),field('terceiro',{properties:{septemHelpType:'inline',septemHelpText:help}}),{type:'checkbox',key:'aceite',label:'Aceite',properties:{septemHelpType:'popover',septemHelpText:help}}]},field('ultimo')]);
    const controls=page.locator('#root input');
    await controls.first().focus();
    for(let i=1;i<5;i++){await page.keyboard.press('Tab');check('Tab ignora ajuda antes do campo '+i,await controls.nth(i).evaluate(el=>el===document.activeElement),true);}
    for(let i=3;i>=0;i--){await page.keyboard.press('Shift+Tab');check('Shift+Tab ignora ajuda antes do campo '+i,await controls.nth(i).evaluate(el=>el===document.activeElement),true);}
    const helper=page.getByRole('button',{name:'Ajuda',exact:true}).first();
    await helper.hover();await page.getByRole('tooltip').waitFor({state:'visible'});
    check('ajuda continua disponível no hover',await page.getByRole('tooltip').innerText(),'Orientação');
    check('links das ajudas fora do Tab',await page.locator('a[href="#orientacao"]').evaluateAll(links=>links.every(a=>a.tabIndex===-1)),true);
    check('ícones das ajudas fora do Tab',await page.getByRole('button',{name:'Ajuda',exact:true}).evaluateAll(icons=>icons.every(el=>el.tabIndex===-1)),true);
    await controls.first().focus();await page.keyboard.press('Tab');check('Tab ignora ajuda aberta',await controls.nth(1).evaluate(el=>el===document.activeElement),true);
    await page.clock.install({time:new Date('2026-09-05T12:34:30')});
    for (const mode of ['date','time','datetime']) {
      await mount([{type:'datetime',key:'data',subtype:mode,properties:{septemDateLimit:'noPast'}}]);
      await page.locator('[data-date-picker-input]').fill(mode==='time'?'1234':mode==='date'?'05092026':'050920261234');check(`data ${mode} atual válida`,(await submit()).errors,{});
    }
    await mount([{type:'datetime',key:'data',subtype:'date',properties:{septemDateLimit:'noFuture'}}]);await page.locator('[data-date-picker-input]').fill('06092026');check('data futura bloqueada',Object.keys((await submit()).errors),['data']);
    check('sem erros React',errors,[]);await page.close();
  }
  await writeFile(join(dir,'results.json'),JSON.stringify(results,null,2));console.log(results.join('\n'));console.log(`PASSOU: ${results.length}; evidências: ${dir}`);
} finally { await browser.close(); }

import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-native-editor-'));
await build({ stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {FormularioView} from './src/components/modelador/views/FormularioView';import {useModeladorStore} from './src/stores/modelador';
window.referenceElements=[];const events={};const bo={};const shape={businessObject:bo};
const modeler={get:key=>({elementRegistry:{getAll:()=>window.referenceElements},canvas:{getRootElement:()=>shape},eventBus:{on:(e,fn)=>{(events[e]??=[]).push(fn)},off:(e,fn)=>{events[e]=(events[e]??[]).filter(f=>f!==fn)}},moddle:{create:(type,props)=>({$type:type,...props})},modeling:{updateProperties:(_,props)=>Object.assign(bo,props)}}[key])};
window.readSchema=()=>JSON.parse(bo.extensionElements?.values?.find(v=>v.$type==='septem:FormSchema')?.json??'null');
window.loadXml=schema=>{(events['import.parse.start']??[]).forEach(f=>f());bo.extensionElements={values:schema?[{$type:'septem:FormSchema',json:typeof schema==='string'?schema:JSON.stringify(schema)}]:[]};(events['import.done']??[]).forEach(f=>f());};
window.flush=()=>useModeladorStore.getState().flushForm();window.captureFlush=()=>useModeladorStore.getState().flushForm;
const app=createRoot(document.getElementById('root')),client=new QueryClient({defaultOptions:{queries:{retry:false}}});
window.render=ready=>flushSync(()=>app.render(<QueryClientProvider client={client}><FormularioView modeler={modeler} processReady={ready}/></QueryClientProvider>));
window.unmount=()=>flushSync(()=>app.render(null));window.render(false);
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'editor.js'), format: 'iife', platform: 'browser', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' } });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error('pageerror:', e.message); });
  await page.route('http://localhost/**', route => route.fulfill({ contentType: route.request().url().includes('/api/') ? 'application/json' : 'text/html', body: route.request().url().includes('/api/') ? '[]' : '<html><body><div id="root" style="height:100vh;display:flex;flex-direction:column"></div></body></html>' }));
  await page.goto('http://localhost');
  for (const file of await readdir(join(root, 'dist/assets'))) if (file.endsWith('.css')) await page.addStyleTag({ content: await readFile(join(root, 'dist/assets', file), 'utf8') });
  await page.addScriptTag({ path: join(dir, 'editor.js') });
  assert.equal(await page.evaluate(() => window.flush().then(() => false, () => true)), true);
  await page.evaluate(() => window.render(true));
  if (await page.evaluate(() => !!window.previousFlush)) assert.equal(await page.evaluate(() => window.previousFlush().then(() => false, () => true)), true, 'flush antigo não salva após remontagem');
  await page.locator('[data-native-editor]').waitFor({timeout:10000}).catch(async e => { console.log(await page.locator('body').innerText()); throw e; });
  const saved = async () => { await page.evaluate(() => window.flush()); return page.evaluate(() => window.readSchema()); };
  let schema = await saved();
  assert.equal(schema.format, 'septem-native'); assert.equal(schema.tabs.length, 1); assert.equal(schema.tabs[0].groups.length, 1);
  assert.equal(await page.getByRole('button', { name: 'Excluir agrupamento', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Configurar aba', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Excluir aba', exact: true }).isDisabled(), true);
  const add = async (type, group = 'Grupo 1') => {
    await page.getByRole('button', { name: `Adicionar campo em ${group}`, exact: true }).click();
    assert.equal(await page.getByLabel('Buscar tipo de campo').count(),0);
    await page.getByRole('dialog').getByRole('button', { name: type, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  };
  await page.getByRole('button',{name:'Ícone da aba',exact:true}).click();
  await page.getByRole('button',{name:'Mail',exact:true}).click();
  assert.equal((await saved()).tabs[0].config.icon,'Mail');
  assert.equal(await page.getByRole('button',{name:'Aba 1',exact:true}).locator('svg').count(),1);
  await page.getByRole('button',{name:'Ícone da aba',exact:true}).click();
  await page.getByRole('searchbox',{name:'Buscar ícone'}).fill('volcano');
  await page.getByRole('button',{name:'fa-solid fa-volcano',exact:true}).click();
  assert.equal((await saved()).tabs[0].config.icon,'fa-solid fa-volcano');
  assert.equal(await page.getByRole('button',{name:'Aba 1',exact:true}).locator('i.fa-volcano').count(),1);
  console.log('PASSOU: estrutura inicial, ícones antigos e busca no catálogo completo, mínimos');
  await add('Lista');
  assert.equal((await saved()).tabs[0].groups[0].fields[0].key, '', 'chave começa vazia');
  await page.getByRole('button', { name: 'Adicionar opção', exact: true }).click();
  await page.getByLabel('Rótulo da opção 1', { exact: true }).fill('Primeira');
  await page.getByLabel('Nome', { exact: true }).fill('');
  await page.getByLabel('Nome', { exact: true }).pressSequentially('Valor da contratação');
  assert.equal((await saved()).tabs[0].groups[0].fields[0].label, 'Valor da contratação', 'flush inclui nome sem depender de blur');
  await page.getByLabel('Nome', { exact: true }).blur();
  schema = await saved(); const original = schema.tabs[0].groups[0].fields[0];
  assert.equal(original.label, 'Valor da contratação'); assert.equal(original.config.values[0].label, 'Primeira');
  assert.equal(original.key, 'valor_da_contratacao', 'primeiro nome gera chave em snake_case');
  await page.getByRole('switch', { name: /^Obrigatório/ }).focus(); await page.keyboard.press('Space');
  await page.getByLabel('Tipo do campo', { exact: true }).selectOption('number');
  assert.equal(await page.getByRole('dialog').count(), 0);
  schema = await saved(); let field = schema.tabs[0].groups[0].fields[0];
  assert.equal(field.id, original.id); assert.equal(field.key, original.key); assert.equal(field.label, original.label);
  assert.equal(field.config.values, undefined); assert.equal(field.config.validate.required, true);
  await page.getByRole('button', { name: 'Validação', exact: true }).click();
  await page.getByLabel('Valor mínimo', { exact: true }).fill('5');
  schema = await saved(); assert.equal(schema.tabs[0].groups[0].fields[0].config.validate.min, 5);
  await page.evaluate(key => { window.referenceElements=[{businessObject:{id:'Gateway_saida',name:'Decisão',extensionElements:{values:[{$type:'septem:GatewayCondition',rules:[{$type:'septem:FormRule',fieldRef:key}]}]}}}]; }, field.key);
  await page.getByRole('button', {name:'Geral',exact:true}).click();
  await page.getByLabel('Nome', {exact:true}).fill('Campo com referência');
  await page.getByRole('region', {name:'Usos conhecidos'}).waitFor();
  await page.getByLabel('Chave (identificador)', {exact:true}).fill('chave_nova');
  await page.getByLabel('Nome', {exact:true}).focus();
  await page.getByText('Corrija as referências antes de publicar', {exact:true}).waitFor();
  assert.equal((await saved()).tabs[0].groups[0].fields[0].id, field.id);
  await page.getByLabel('Chave (identificador)', {exact:true}).fill(field.key);
  await page.getByLabel('Nome', {exact:true}).focus();
  assert.equal(await page.getByText('Corrija as referências antes de publicar', {exact:true}).count(),0);
  await page.getByLabel('Nome', {exact:true}).fill('Valor da contratação');
  console.log('PASSOU: edição e troca de tipo');
  await page.getByRole('button', { name: 'Nova aba', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Documentos');
  schema = await saved(); assert.equal(schema.tabs[1].groups.length, 1); assert.equal(schema.tabs[1].label, 'Documentos');
  await page.getByRole('button', { name: 'Novo agrupamento', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Criar tabela', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Adicionar campo em Tabela 2', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'HTML', exact: true }).count(), 0);
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Nova aba', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await add('Texto', 'Tabela 2');
  schema = await saved(); assert.equal(schema.tabs[1].groups[1].fields[0].kind, 'field');
  const withTable = schema;
  await page.locator(`[data-field-id="${schema.tabs[1].groups[1].fields[0].id}"]`).getByRole('button', { name: /Excluir campo/ }).click();
  await page.getByRole('button', { name: 'Excluir agrupamento', exact: true }).click();
  assert.equal((await saved()).tabs[1].groups.length, 1);
  assert.equal(await page.getByRole('button', { name: 'Excluir agrupamento', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Configurar aba', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir aba', exact: true }).click();
  assert.equal((await saved()).tabs.length, 1);
  await page.evaluate(s => window.loadXml(s), withTable);

  await page.getByRole('button', { name: 'Aba 1', exact: true }).click();
  for (const type of ['Texto', 'Área de texto', 'Data / Hora', 'Upload de arquivo', 'Opções', 'Caixa de seleção', 'Múltipla escolha', 'Tags', 'Texto estático', 'HTML', 'Imagem', 'Separador', 'Espaçador']) await add(type);
  console.log('PASSOU: catálogo e tabela');
  schema = await saved(); assert.equal(schema.tabs[0].groups[0].fields.length, 14);
  assert.equal(schema.tabs[0].groups[0].fields.filter(f => f.kind === 'presentation').length, 5);
  await page.evaluate(s => window.loadXml(s), schema);
  assert.deepEqual(await saved(), schema, 'reabrir preserva definição inteira');
  await page.getByRole('button', { name: 'Adicionar campo em Grupo 1', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Texto', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal((await saved()).tabs[0].groups[0].fields.length, 15, 'catálogo operável por teclado');
  const beforeInvalid = await saved();
  await page.getByLabel('Importar definição nativa', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"components":[]}') });
  await page.getByRole('alert').waitFor(); assert.deepEqual(await saved(), beforeInvalid, 'importação inválida preserva rascunho');
  await page.getByLabel('Importar definição nativa', { exact: true }).setInputFiles({ name: 'native.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(schema)) });
  await page.getByRole('alert').waitFor({ state: 'hidden' }); assert.deepEqual(await saved(), schema);
  await page.getByRole('button', { name: 'Valor da contratação Número', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Nome"]').value === 'Valor da contratação');
  await mkdir(join(root, '.impeccable/review'), { recursive: true });
  await page.screenshot({ path: join(root, '.impeccable/review/native-editor-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'sem overflow horizontal mobile');
  await page.screenshot({ path: join(root, '.impeccable/review/native-editor-mobile.png') });
  await page.getByLabel('Tipo do campo', { exact: true }).selectOption('textfield');
  await page.getByLabel('Nome', { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const input = document.querySelector('[aria-label="Nome"]'); const r = input.getBoundingClientRect(); return input.value === 'Valor da contratação' && r.top >= 0 && r.bottom <= innerHeight; });
  await page.screenshot({ path: join(root, '.impeccable/review/native-editor-mobile-properties.png') });
  assert.equal((await saved()).tabs[0].groups[0].fields[0].type, 'textfield', 'propriedades acessíveis no mobile');
  await page.getByRole('button', { name: 'Prévia', exact: true }).click();
  await page.getByRole('dialog', { name: 'Prévia do formulário' }).waitFor();
  await page.getByRole('button', { name: 'Validar preenchimento', exact: true }).click();
  await page.getByText('Revise os campos indicados antes de continuar.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const footerOutput = await mkdtemp(join(tmpdir(), 'septem-creation-actions-'));
  const longForm = structuredClone(schema);
  const longTab = longForm.tabs[0];
  const longGroup = longTab.groups[0];
  longGroup.fields = Array.from({ length: 24 }, (_, i) => ({
    ...structuredClone(original), id: `footer-field-${i}`, key: `footer_field_${i}`, label: `Campo ${i + 1}`,
  }));
  longTab.groups.push(
    { ...structuredClone(longGroup), id: 'footer-empty', label: 'Grupo vazio', fields: [] },
    { ...structuredClone(schema.tabs[1].groups[1]), id: 'footer-table', key: 'footer_table', label: 'Tabela final', fields: [] },
  );
  await page.evaluate(() => { window.referenceElements = []; });
  for (const [device, width, height] of [['desktop', 1280, 900], ['mobile', 375, 812]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(s => window.loadXml(s), longForm);
    await page.getByRole('button', { name: 'Configurar aba', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Configurar aba', exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Novo agrupamento', exact: true }).count(), 1);
    const actions = page.getByRole('group', { name: 'Ações da aba', exact: true });
    const initialActions = await actions.boundingBox();
    const checkActions = async () => {
      const box = await actions.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= height && Math.abs(box.y - initialActions.y) <= 1, `${device}: barra sempre visível na mesma posição`);
      for (const control of await actions.getByRole('button').all()) {
        const rect = await control.boundingBox();
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.y >= box.y && rect.y + rect.height <= box.y + box.height, `${device}: botões sem cortes`);
      }
    };
    await checkActions();
    const groupFooter = page.getByRole('button', { name: 'Adicionar campo em Grupo 1', exact: true });
    assert.equal(await groupFooter.count(), 1, 'apenas uma ação de campo por agrupamento');
    await groupFooter.scrollIntoViewIfNeeded();
    await checkActions();
    const lastField = page.locator('[data-field-id="footer-field-23"]');
    assert.ok((await groupFooter.boundingBox()).y >= (await lastField.boundingBox()).y + (await lastField.boundingBox()).height,
      `${device}: ação abaixo do último campo do agrupamento longo`);
    await page.screenshot({ path: join(footerOutput, `${device}-group.png`) });
    await groupFooter.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').getByRole('button', { name: 'Texto', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Campo no final');
    let changed = await saved();
    assert.equal(changed.tabs[0].groups[0].fields.at(-1).label, 'Campo no final', `${device}: campo criado no fim do grupo correto`);
    assert.equal(changed.tabs[0].groups[1].fields.length, 0);
    await page.getByRole('button', { name: 'Adicionar campo em Grupo vazio', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Texto', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Primeiro campo');
    await page.getByRole('button', { name: 'Adicionar campo em Tabela final', exact: true }).click();
    assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'HTML', exact: true }).count(), 0);
    await page.keyboard.press('Escape');
    const newGroupFooter = actions.getByRole('button', { name: 'Novo agrupamento', exact: true });
    await checkActions();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${device}: sem overflow horizontal`);
    await page.screenshot({ path: join(footerOutput, `${device}-tab.png`) });
    await newGroupFooter.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Padrão', exact: true }).click();
    changed = await saved();
    assert.equal(changed.tabs[0].groups.length, 4, `${device}: agrupamento criado ao final da aba`);
    assert.equal(changed.tabs[0].groups[1].fields[0].label, 'Primeiro campo');
    await page.getByLabel('Nome', { exact: true }).fill('Responsável');
    for (const expected of ['campo_no_final_responsavel', 'campo_no_final_responsavel_2']) {
      await page.getByRole('button', { name: 'Adicionar campo em Responsável', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Texto', exact: true }).click();
      await page.getByLabel('Nome', { exact: true }).fill('Campo no final');
      assert.equal(await page.getByLabel('Chave (identificador)', { exact: true }).inputValue(), expected, `${device}: colisão resolvida automaticamente`);
      await page.getByLabel('Nome', { exact: true }).blur();
    }
    await page.getByLabel('Chave (identificador)', { exact: true }).fill('chave_personalizada');
    await page.getByLabel('Chave (identificador)', { exact: true }).blur();
    await page.getByLabel('Nome', { exact: true }).fill('Outro nome');
    await page.getByLabel('Nome', { exact: true }).blur();
    assert.equal((await saved()).tabs[0].groups[3].fields[1].key, 'chave_personalizada', 'renomear preserva chave já definida');
    await checkActions();
    await actions.getByRole('button', { name: 'Configurar aba', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Aba configurada pelo rodapé');
    changed = await saved();
    assert.equal(changed.tabs[0].label, 'Aba configurada pelo rodapé');
    await page.evaluate(s => window.loadXml(s), changed);
    assert.deepEqual(await saved(), changed, `${device}: ações do rodapé persistem após reabrir`);

    const reorderForm = structuredClone(changed);
    reorderForm.tabs[0].groups[0].fields = reorderForm.tabs[0].groups[0].fields.slice(0, 1);
    await page.evaluate(s => window.loadXml(s), reorderForm);
    const order = reorderForm.tabs[0].groups.map(g => g.id);
    const handle = page.getByRole('button', { name: 'Mover agrupamento Tabela final', exact: true });
    await handle.focus();
    await page.keyboard.press('ArrowUp');
    assert.deepEqual((await saved()).tabs[0].groups.map(g => g.id), [order[0], order[2], order[1], order[3]], `${device}: reordenação por teclado`);
    await page.keyboard.press('ArrowDown');
    assert.deepEqual((await saved()).tabs[0].groups.map(g => g.id), order);
    if (device === 'desktop') {
      await handle.dragTo(page.locator(`[data-group-id="${order[0]}"] > div`).first());
      changed = await saved();
      assert.deepEqual(changed.tabs[0].groups.map(g => g.id), [order[2], order[0], order[1], order[3]], 'arraste real reordena agrupamento');
      const box = await handle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 5 });
      await page.locator('[data-group-drop-end]').scrollIntoViewIfNeeded();
      const end = await page.locator('[data-group-drop-end]').boundingBox();
      await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 });
      await page.mouse.up();
      assert.deepEqual((await saved()).tabs[0].groups.map(g => g.id), [order[0], order[1], order[3], order[2]], 'arraste ao final');
    }
    changed = await saved();
    for (const g of changed.tabs[0].groups) assert.deepEqual(g, reorderForm.tabs[0].groups.find(original => original.id === g.id), 'reordenar preserva todo o conteúdo');
    await page.evaluate(s => window.loadXml(s), changed);
    assert.deepEqual(await saved(), changed, 'ordem persiste após reabrir');
  }
  console.log(`PASSOU: ações únicas, barra fixa, reordenação por arraste/teclado, chaves únicas e persistência em desktop/mobile. Capturas: ${footerOutput}`);
  await page.evaluate(() => { window.oldFlush = window.flush; window.previousFlush = window.captureFlush(); window.unmount(); });
  await page.evaluate(() => window.render(true));
  if (await page.evaluate(() => !!window.previousFlush)) assert.equal(await page.evaluate(() => window.previousFlush().then(() => false, () => true)), true, 'flush antigo não salva após remontagem');
  await page.locator('[data-native-editor]').waitFor({timeout:10000}).catch(async e => { console.log(await page.locator('body').innerText()); throw e; });
  await page.evaluate(() => window.loadXml('{invalid')); await page.getByRole('alert').waitFor();
  assert.equal(await page.evaluate(() => window.flush().then(() => false, () => true)), true, 'XML inválido bloqueia save');
  await page.evaluate(() => window.loadXml({ type: 'default', components: [] }));
  assert.match(await page.getByRole('alert').innerText(), /formato anterior/);
  // O que importa aqui é o EFEITO — o schema em formato anterior sair intacto do flush — e
  // não o mecanismo. O flush rejeitava, e isso abortava o Salvar do modelador INTEIRO: um
  // processo com formulário antigo não podia ser salvo de jeito nenhum (nem renomear
  // tarefa), sem requisição e sem aviso. Agora ele é no-op para legado, e o que se cobra é
  // que o schema continue o mesmo.
  assert.equal(await page.evaluate(() => window.flush().then(() => true, () => false)), true,
    'flush com legado não estoura (senão o Salvar do processo morre)');
  assert.deepEqual(await page.evaluate(() => window.readSchema()), { type: 'default', components: [] },
    'e não sobrescreve o schema legado');
  assert.deepEqual(errors, []);
  console.log('PASSOU: CA04–CA06, catálogo, identidade, propriedades, estrutura mínima, teclado, mobile, importação e round-trip BPMN simulado.');
} finally { await browser.close(); await rm(dir, { recursive: true, force: true }); }

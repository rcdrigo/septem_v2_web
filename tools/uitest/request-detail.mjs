// Detail-route regressions, using actual components and synthetic API responses only.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-request-detail-'));
const schema = { format: 'septem-native', schemaVersion: 1, id: 'form', tabs: [{ id: 'cadastro', label: 'Cadastro', groups: [{ id: 'dados', label: 'Dados', type: 'group', fields: [{ id: 'nome', kind: 'field', key: 'nome', label: 'Nome', type: 'textfield', config: {} }], config: {} }], config: {} }] };
const task = { id: 'task-1', executionId: 'request-1', name: 'Analisar documentação do licenciamento', status: 'pendente', assignee: 'Ana Maria de Albuquerque', createdAt: '2026-09-01T12:00:00Z', completedAt: null, dueAt: '2026-09-30T12:00:00Z', action: null, fieldHistory: [{ changedAt: '2026-09-01T12:00:00Z', changedBy: 'Ana', action: 'Editar', field: 'Nome', oldValue: 'Maria', newValue: 'Maria Aparecida' }] };
const detail = { id: 'request-1', number: 184, process: 'Licenciamento de funcionamento', requester: 'Maria Aparecida de Albuquerque', status: 'em_andamento', startedAt: task.createdAt, endedAt: null, data: { nome: 'Maria' }, tasks: [task], tags: [], activeTask: { name: task.name, assignee: task.assignee, startedAt: task.createdAt, dueAt: '2026-10-02T12:00:00Z' }, canReturn: true, canForward: true, canCancel: true, canDelete: true, canEdit: true, formSchema: schema, messages: { count: 0, canPost: true } };
let browser;
try {
  await build({ stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import {SolicitacaoPage} from './src/pages/SolicitacaoPage';
import {useSessionStore} from './src/stores/session';
useSessionStore.setState({status:'authenticated',accessToken:'fixture-only',accessMode:window.fixtureMode,user:{id:'actor',name:'Ana',email:'ana@example.test',isInternal:window.fixtureMode==='interno',perms:['*'],hasDashboard:false,accessProfiles:[]}});
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BrowserRouter><Routes><Route path="/requests/:instanceId" element={<SolicitacaoPage/>}/></Routes></BrowserRouter></QueryClientProvider>);
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'bundle.js'), format: 'iife', platform: 'browser', tsconfig: join(root, 'tsconfig.app.json'), loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  async function open({ width = 1280, ownTasks = [task], messageError = false, detailError = false, tasksError = false, external = false, report = detail } = {}) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(5000);
    const state = { messageError, detailError, tasksError, deletes: 0, saves: 0, errors: [] };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('https://request-detail.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      if (!path.startsWith('/api/')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div></html>' });
      if (method === 'DELETE') { state.deletes++; return route.fulfill({ json: {} }); }
      if (method === 'PUT') { state.saves++; return route.fulfill({ status: 503, json: { detail: 'Falha simulada ao salvar' } }); }
      if (method === 'POST' && path.endsWith('/messages')) return route.fulfill({ status: 503, json: { detail: 'Falha simulada ao enviar' } });
      if (path.endsWith('/messages')) return route.fulfill(state.messageError ? { status: 503, json: { detail: 'Falha simulada nas mensagens' } } : { json: { items: [], hasMore: false, canPost: true, canHideFromRequester: false } });
      if (path.endsWith('/tasks')) return route.fulfill(state.tasksError ? { status: 503, json: { detail: 'Falha simulada nas tarefas' } } : { json: { items: ownTasks, processes: [] } });
      if (path.endsWith('/request-1')) return route.fulfill(state.detailError ? { status: 503, json: { detail: 'Falha simulada na requisição' } } : { json: report });
      return route.fulfill({ json: { items: [], tags: [], catalog: [], executionRevision: 0, catalogRevision: 0 } });
    });
    await page.goto('https://request-detail.test/requests/request-1');
    for (const file of (await readdir(join(root, 'dist/assets'))).filter(file => file.endsWith('.css'))) await page.addStyleTag({ content: await readFile(join(root, 'dist/assets', file), 'utf8') });
    await page.evaluate(mode => { window.fixtureMode = mode; }, external ? 'externo' : 'interno');
    await page.addScriptTag({ path: join(dir, 'bundle.js') });
    return { page, state };
  }
  {
    const report = { ...detail, status: 'concluido', endedAt: '2026-09-03T12:00:00Z', activeTask: null, inboxHtml: '<p>Resumo do licenciamento</p>', tasks: [{ ...task, status: 'concluida', completedAt: '2026-09-03T12:00:00Z', completedBy: 'Ana', action: 'Deferida', actionPrimaryColor: '#047857', actionTextColor: '#ffffff' }], formSchema: { ...schema, tabs: [...schema.tabs, { ...schema.tabs[0], id: 'complemento', label: 'Complemento', groups: [{ ...schema.tabs[0].groups[0], id: 'outros', label: 'Outros dados', fields: [{ ...schema.tabs[0].groups[0].fields[0], id: 'observacao', key: 'observacao', label: 'Observação' }] }] }] } };
    const { page } = await open({ report });
    await page.getByRole('heading', { name: 'Processo concluído' }).waitFor();
    await page.getByText('Resumo do licenciamento').waitFor();
    await page.getByText(/Responsável pela última tarefa: Ana/).waitFor();
    assert.equal(await page.locator('a[href^="/tasks/"]').count(), 0);
    await page.getByRole('tab', { name: /Complemento/ }).click();
    await page.getByText('Outros dados', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Visualizar tramitação completa' }).click();
    const history = page.getByRole('dialog', { name: 'Tramitação completa', exact: true });
    await history.waitFor();
    const narrative = await history.innerText();
    assert.ok(narrative.includes('recebida em'));
    assert.ok(!narrative.includes('recebida por'));
    assert.ok(narrative.includes('Deferida por Ana em'));
    assert.ok(narrative.includes('de setembro de 2026 às'));
    const chip = history.getByTestId('completion-action-chip');
    assert.equal(await chip.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(4, 120, 87)');
    assert.equal(await chip.evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
    assert.equal(await page.locator('main > div > header .lucide-circle-check').count(), 1);
    if (process.env.OUT_DIR) await page.screenshot({ path: join(process.env.OUT_DIR, 'request-history-completed.png') });
    await page.close();
    console.log('PASS completed process, summary, multiple form tabs and history');
  }
  {
    const { page } = await open({ report: { ...detail, status: 'cancelado', activeTask: null } });
    await page.getByRole('heading', { name: 'Processo cancelado' }).waitFor();
    assert.equal(await page.locator('main > div > header .lucide-circle-x').count(), 1);
    await page.close();
  }
  // Assertions are below; these exercise behavior, not class-name implementation.
  for (const width of [1280, 390, 320]) {
    const { page, state } = await open({ width });
    await page.getByRole('heading', { name: /Requisição.*184/ }).waitFor();
    await page.locator('a[href="/tasks/task-1"]').waitFor();
    assert.equal(await page.getByText('Sem resumo configurado.', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Visualizar tramitação completa' }).click();
    await page.getByRole('dialog', { name: 'Tramitação completa', exact: true }).waitFor();
    assert.ok((await page.getByRole('dialog', { name: 'Tramitação completa', exact: true }).innerText()).includes('com previsão de conclusão em 30 de setembro de 2026'));
    if (process.env.OUT_DIR) await page.screenshot({ path: join(process.env.OUT_DIR, `request-history-${width}.png`) });
    await page.getByRole('button', { name: 'Ver histórico de alterações' }).click();
    await page.getByRole('dialog', { name: /Histórico de alterações/ }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: /Histórico de alterações/ }).waitFor({ state: 'hidden' });
    await page.getByRole('dialog', { name: 'Tramitação completa', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('tablist').count(), 0, 'single form tab displays groups directly');
    const overflow = await page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    assert.equal(overflow, false, `no horizontal overflow at ${width}px`);
    await page.getByRole('button', { name: 'Ações', exact: true }).click();
    const menu = page.locator('[id="' + await page.getByRole('button', { name: 'Ações', exact: true }).getAttribute('aria-controls') + '"]');
    const menuButtons = await menu.locator('button').evaluateAll(buttons => buttons.map(button => ({text:button.textContent.trim(), height:button.getBoundingClientRect().height, whitespace:getComputedStyle(button).whiteSpace})));
    assert.deepEqual(menuButtons.map(button=>button.text), ['Editar','Devolver para tarefa já executada','Encaminhar para nova tarefa','Cancelar processo','Excluir requisição']);
    assert.ok(menuButtons.every(button=>button.whitespace==='nowrap' && button.height===menuButtons[0].height));
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Ações', exact: true }).getAttribute('aria-expanded'), 'false');
    await page.getByRole('button', { name: 'Ações', exact: true }).click();
    await page.getByText(/Excluir requisição|Excluir processo/, { exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(state.deletes, 0, 'cancel confirmation does not delete');
    await page.getByRole('button', { name: 'Ações', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar processo', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Ações', exact: true }).getAttribute('aria-expanded'), 'true', 'dialog Escape does not unmount its parent disclosure');
    await page.keyboard.press('Escape');
    assert.deepEqual(state.errors, []);
    if (process.env.OUT_DIR) await page.screenshot({ path: join(process.env.OUT_DIR, `request-detail-${width}.png`), fullPage: true });
    await page.close();
    console.log(`PASS ${width}px: task link, responsive detail, keyboard menu, delete confirmation`);
  }
  {
    const { page, state } = await open({ ownTasks: [] });
    await page.getByRole('heading', { name: /Requisição.*184/ }).waitFor();
    await page.getByRole('button', { name: 'Ações', exact: true }).click();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    assert.equal(await page.locator('a[href="/tasks/task-1"]').count(), 0, 'no task access inferred from assignee name');
    await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Maria atualizada');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByText('Não foi possível salvar as alterações.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Nome', exact: true }).inputValue(), 'Maria atualizada');
    assert.equal(state.saves, 1);
    await page.close();
    console.log('PASS save failure visible and input preserved; unauthorized task link absent');
  }
  {
    const { page, state } = await open({ messageError: true });
    await page.getByText(/Não foi possível carregar as mensagens/).waitFor();
    assert.equal(await page.getByText('Nenhuma mensagem enviada.', { exact: true }).count(), 0);
    state.messageError = false;
    await page.getByRole('button', { name: /Tentar novamente|Recarregar mensagens/ }).click();
    await page.getByRole('textbox', { name: 'Nova mensagem', exact: true }).fill('Minha mensagem deve ser preservada');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await page.getByText(/Não foi possível enviar a mensagem/).first().waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Nova mensagem', exact: true }).inputValue(), 'Minha mensagem deve ser preservada');
    assert.deepEqual(state.errors, []);
    await page.close();
    console.log('PASS messages failure differs from empty state, retry restores composer, send preserves text');
  }
  {
    const { page, state } = await open({ tasksError: true, external: true, ownTasks: [task, { ...task, id: 'task-2', name: 'Conferir anexos' }, { ...task, id: 'unrelated', executionId: 'other-request' }] });
    await page.getByRole('button', { name: 'Verificar novamente' }).waitFor();
    assert.equal(await page.locator('a[href^="/tasks/"]').count(), 0, 'failed lookup does not imply authorization');
    state.tasksError = false;
    await page.getByRole('button', { name: 'Verificar novamente' }).click();
    await page.locator('a[href="/tasks/task-2"]').waitFor();
    assert.equal(await page.locator('a[href^="/tasks/"]').count(), 2, 'external requester sees both assigned parallel tasks, not unrelated tasks');
    assert.deepEqual(state.errors, []);
    await page.close();
    console.log('PASS external task lookup retry, parallel assigned tasks, unrelated task excluded');
  }
  {
    const { page, state } = await open({ detailError: true });
    await page.getByRole('button', { name: /Tentar novamente/ }).waitFor();
    state.detailError = false;
    await page.getByRole('button', { name: /Tentar novamente/ }).click();
    await page.getByRole('heading', { name: /Requisição.*184/ }).waitFor();
    assert.deepEqual(state.errors, []);
    await page.close();
    console.log('PASS report retry recovers from transient failure');
  }
} finally {
  await browser?.close();
  await rm(dir, { recursive: true, force: true });
}

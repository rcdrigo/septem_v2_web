// Isolated browser regression: production editor and location controls, no tenant writes.
// Run after npm run build. Geographic responses are fixtures; backend calculations
// and provider behavior are covered by the backend's calendar tests.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-calendar-'));
const output = process.env.OUT_DIR ?? dir;
await mkdir(output, { recursive: true });
let browser;
try {
  await build({
    stdin: { contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
      import { BusinessHoursEditor } from './src/components/business-calendar/BusinessHoursEditor';
      import { CalendarLocationFields } from './src/components/business-calendar/CalendarLocationFields';
      import { businessHoursFromSettings } from './src/lib/business-calendar';
      import { validateBusinessHours } from './src/components/business-calendar/business-hours';
      function App() {
        const [hours, setHours] = useState(() => businessHoursFromSettings({businessHourStart:8,businessHourEnd:18,businessDays:'1,2,3,4,5'}));
        const [location, setLocation] = useState({});
        const [disabled, setDisabled] = useState(false);
        return <main style={{maxWidth:900,margin:'auto',padding:16}}>
          <h1 className="text-xl font-semibold mb-6">Calendário de horas úteis</h1>
          <CalendarLocationFields value={location} onChange={setLocation} disabled={disabled}/>
          <div className="mt-6"><BusinessHoursEditor value={hours} onChange={setHours} disabled={disabled}/></div>
          <button onClick={()=>setDisabled(!disabled)}>Alternar somente leitura</button>
          <output data-testid="hours" hidden>{JSON.stringify(hours)}</output>
          <output data-testid="location" hidden>{JSON.stringify(location)}</output>
          <output data-testid="validation" hidden>{JSON.stringify(validateBusinessHours(hours))}</output>
        </main>;
      }
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>);
    `, resolveDir: root, loader: 'tsx' },
    bundle: true, outfile: join(dir, 'app.js'), platform: 'browser', format: 'iife',
    define: { 'import.meta.env': '{}' }, tsconfig: join(root, 'tsconfig.app.json'),
  });
  const assets = await readdir(join(root, 'dist/assets'));
  const css = (await Promise.all(assets.filter(file => file.endsWith('.css')).map(file => readFile(join(root, 'dist/assets', file), 'utf8')))).join('\n');
  console.log('Starting isolated calendar browser…');
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, timeout: 15_000 });
  for (const width of [1280, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.route('http://calendar.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const catalogs = {
        '/api/v1/locations/states': { items: [{ code: 'PE', name: 'Pernambuco' }, { code: 'CE', name: 'Ceará' }] },
        '/api/v1/locations/states/PE/cities': { items: [{ code: '2611606', name: 'Recife' }, { code: '2605459', name: 'Fernando de Noronha' }] },
        '/api/v1/locations/states/CE/cities': { items: [{ code: '2304400', name: 'Fortaleza' }] },
      };
      if (catalogs[path]) return route.fulfill({ json: catalogs[path] });
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div></html>' });
      return route.fulfill({ status: 404 });
    });
    await page.goto('http://calendar.test/');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ path: join(dir, 'app.js') });
    const state = async name => JSON.parse(await page.getByTestId(name).textContent());
    await page.getByRole('combobox', { name: /^Estado/ }).selectOption('PE');
    await page.getByRole('combobox', { name: /^Município/ }).selectOption('2611606');
    assert.equal((await state('location')).timeZoneId, 'America/Recife');
    await page.getByRole('combobox', { name: /^Município/ }).selectOption('2605459');
    assert.equal((await state('location')).timeZoneId, 'America/Noronha');
    await page.getByRole('combobox', { name: /^Estado/ }).selectOption('CE');
    assert.equal((await state('location')).cityCode, '', 'changing state must clear the old city');
    await page.getByRole('combobox', { name: /^Município/ }).selectOption('2304400');
    assert.equal((await state('location')).timeZoneId, 'America/Fortaleza');

    assert.deepEqual((await state('hours'))['1'], [{ start: '08:00', end: '18:00' }]);
    await page.getByLabel('Modelo, período 1, início', { exact: true }).fill('830');
    await page.getByLabel('Modelo, período 1, fim', { exact: true }).fill('12:00');
    assert.equal(await page.getByLabel('Modelo, período 1, início', { exact: true }).inputValue(), '08:30', 'mobile numeric entry is normalized on blur');
    await page.getByRole('button', { name: 'Adicionar período', exact: true }).click();
    await page.getByLabel('Modelo, período 2, início', { exact: true }).fill('14:00');
    await page.getByLabel('Modelo, período 2, fim', { exact: true }).fill('18:00');
    await page.getByRole('button', { name: 'Aplicar a 5 dias', exact: true }).click();
    const weekdays = await state('hours');
    for (let day = 1; day <= 5; day++) assert.deepEqual(weekdays[day], [{ start: '08:30', end: '12:00' }, { start: '14:00', end: '18:00' }]);
    assert.deepEqual(weekdays['6'], []);
    assert.deepEqual(weekdays['7'], []);

    await page.getByRole('button', { name: /Sábado.*Sem horas úteis/ }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Adicionar período', exact: true }).last().click();
    await page.getByLabel('Sábado, período 1, início', { exact: true }).fill('09:00');
    await page.getByLabel('Sábado, período 1, fim', { exact: true }).fill('12:00');
    assert.deepEqual((await state('hours'))['6'], [{ start: '09:00', end: '12:00' }]);
    assert.deepEqual((await state('hours'))['1'], weekdays['1'], 'Saturday editing must not mutate copied weekday arrays');
    assert.deepEqual(await state('validation'), []);

    await page.getByLabel('Modelo, período 2, início', { exact: true }).fill('11:00');
    assert.equal(await page.getByRole('button', { name: 'Aplicar a 5 dias', exact: true }).isDisabled(), true);
    assert.match(await page.getByRole('alert').innerText(), /sobrepõem/);
    await page.getByLabel('Modelo, período 2, início', { exact: true }).fill('14:00');
    await page.getByLabel('Sábado, período 1, fim', { exact: true }).fill('08:00');
    assert.match((await state('validation')).join(' '), /fim deve ser depois/);
    await page.getByLabel('Sábado, período 1, fim', { exact: true }).fill('12:00');
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      clipped: [...document.querySelectorAll('input, select, button')].filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1); }).length,
    }));
    assert.equal(layout.overflow, false);
    assert.equal(layout.clipped, 0);
    await page.screenshot({ path: join(output, `business-calendar-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Alternar somente leitura' }).click();
    assert.equal(await page.getByLabel('Sábado, período 1, início', { exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Aplicar a 5 dias', exact: true }).isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: location, timezone, legacy hours, split periods, bulk apply, independent Saturday, overlap, ordering, readonly, layout.`);
    await page.close();
  }
} finally {
  await browser?.close();
  await rm(dir, { recursive: true, force: true });
}

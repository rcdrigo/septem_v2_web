import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
page.on('response', (r) => { if (r.url().includes('impersonate')) console.log('HTTP', r.status(), r.request().method(), r.url().split('/api')[1]); });

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

// personificar um usuário NÃO-admin (Maximiliano, criado antes; senão o Teste)
await page.locator('aside button', { hasText: 'Personificar' }).click();
await page.waitForTimeout(1200);
const nomes = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button span, [role=dialog] li')].map((e) => e.textContent?.trim()).filter(Boolean).slice(0, 8));
console.log('lista de usuários:', JSON.stringify(nomes));
await page.locator('[role=dialog] button', { hasText: 'Cidadao Externo' }).first().click().catch(async () => {
  await page.locator('[role=dialog] button').nth(1).click();
});
await page.waitForTimeout(2000);
await page.screenshot({ path: 'debug-impersonate.png' });

// CLICA em "Sair" da personificação (o do banner amarelo, dentro do aside)
const sairImp = page.locator('aside .bg-amber-50 button', { hasText: 'Sair' });
console.log('botão do banner encontrado:', await sairImp.count());
await sairImp.click();
await page.waitForTimeout(2500);
console.log('após clicar — ainda personificando?', await page.evaluate(() => document.body.innerText.includes('Personificando')));
console.log('usuário atual:', await page.evaluate(() => document.querySelector('aside .truncate')?.textContent));

const st = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('aside button')].map((b) => ({ txt: b.textContent?.trim().slice(0, 30), disabled: b.disabled }));
  return { banner: document.body.innerText.includes('Personificando'), btns: btns.filter((b) => /Sair|Personific/i.test(b.txt ?? '')) };
});
console.log('estado:', JSON.stringify(st, null, 1));
await browser.close();

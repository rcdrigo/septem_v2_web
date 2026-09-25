/**
 * Aquece o front ANTES da bateria.
 *
 * Por que existe: `npm run dev` compila sob demanda. A primeira suíte do `run-all.sh` pega o
 * Vite frio, o `/login` demora mais de 30 s para pintar e a sonda cai por timeout — passando
 * isolada depois. Já aconteceu com `doc-gerar-na-tarefa`, `ajustes-layout`,
 * `botao-orientacoes` e `ajustes-formulario`: sempre a suíte que calhou de ser a primeira.
 *
 * Aqui o formulário de login é esperado UMA vez, com prazo folgado. Quem roda depois encontra
 * tudo compilado. Não conta como suíte: não imprime ✓ nem PASSOU.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

const inicio = Date.now();
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('input[name=identifier]', { timeout: 120000 });
  // Uma rota interna também: o chunk do shell é o segundo gargalo.
  await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle', timeout: 120000 });
  console.log(`aquecido em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
} catch (e) {
  console.log(`! aquecimento falhou (${e.name}) — a bateria segue, mas a 1ª suíte pode cair`);
}
await browser.close();

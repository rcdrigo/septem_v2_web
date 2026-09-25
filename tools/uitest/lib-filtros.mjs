// Helpers dos FILTROS de execução (`ExecutionFilters`), compartilhados pelas sondas.
//
// Antes, cada tela de lista tinha os filtros à vista: chips de situação, campo de busca,
// selects. Tudo isso passou para UM popover ("Filtros") com categorias — então toda sonda
// que filtrava por seletor direto parou de achar o controle. Concentrar a navegação aqui
// evita repetir o passo a passo em cada suíte (e consertar em 10 lugares quando mudar).
//
// Não é uma suíte: o `run-all.sh` ignora `lib-*.mjs`.

/** Abre o popover de filtros (idempotente). */
export async function abrirFiltros(page) {
  const painel = page.locator('[data-testid=painel-filtros]');
  if (await painel.count() > 0 && await painel.first().isVisible()) return;
  await page.locator('[data-testid=abrir-filtros]').first().click();
  await painel.first().waitFor({ timeout: 8000 });
}

/** Escolhe uma categoria pelo rótulo ("Situação", "Busca", "Ordenação", "Processos"…). */
export async function escolherCategoria(page, rotulo) {
  await abrirFiltros(page);
  await page.locator(`[data-testid=painel-filtros] button[aria-label="${rotulo}"]`).first().click();
  await page.waitForTimeout(250);
}

/** Marca uma opção de rádio/checkbox do editor da categoria aberta, pelo texto. */
export async function marcarOpcao(page, texto) {
  await page.locator('[data-testid=painel-filtros] .ef-option', { hasText: texto }).first()
    .locator('input').first().check();
  await page.waitForTimeout(400);
}

/** Filtra pela situação da requisição ("Em andamento", "Concluídas", "Canceladas"). */
export async function filtrarSituacao(page, rotulo) {
  await escolherCategoria(page, 'Situação');
  await marcarOpcao(page, rotulo);
  await fecharFiltros(page);
}

/** Digita no campo de busca (categoria "Busca"). */
export async function filtrarBusca(page, texto, rotulo = 'Busca') {
  await escolherCategoria(page, rotulo);
  await page.locator('[data-testid=filtro-q]').fill(texto);
  await page.waitForTimeout(600);
}

/** Fecha o popover. */
export async function fecharFiltros(page) {
  await page.keyboard.press('Escape');
  await page.locator('[data-testid=painel-filtros]').first()
    .waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
}

// ── Filtros do RELATÓRIO (`ReportFilters`) ──────────────────────────────────────
// Mesma mudança da lista: a barra com um campo por filtro virou um popover com
// categorias, e não há mais botão "Aplicar" — a alteração é aplicada sozinha.

/** Preenche um filtro de texto/número/data do relatório e fecha o popover. */
export async function filtrarRelatorio(page, rotulo, valor) {
  const popup = page.locator('[data-testid=report-filters]');
  if (await popup.count() === 0 || !(await popup.first().isVisible())) {
    await page.locator('.ef-trigger', { hasText: 'Filtros' }).first().click();
    await popup.first().waitFor({ timeout: 8000 });
  }
  await popup.locator('.ef-category', { hasText: rotulo }).first().click();
  await popup.locator(`input[aria-label="${rotulo}"]`).first().fill(valor);
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
}

/** Escolhe uma OPÇÃO de um filtro do tipo lista no relatório (vira rádio no popover). */
export async function filtrarRelatorioOpcao(page, rotulo, opcao) {
  const popup = page.locator('[data-testid=report-filters]');
  if (await popup.count() === 0 || !(await popup.first().isVisible())) {
    await page.locator('.ef-trigger', { hasText: 'Filtros' }).first().click();
    await popup.first().waitFor({ timeout: 8000 });
  }
  await popup.locator('.ef-category', { hasText: rotulo }).first().click();
  await popup.locator('.ef-option', { hasText: opcao }).first().locator('input').check();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
}

/** Lista os rótulos das categorias de filtro do relatório (abre e fecha o popover). */
export async function categoriasDoRelatorio(page) {
  await page.locator('.ef-trigger', { hasText: 'Filtros' }).first().click();
  const popup = page.locator('[data-testid=report-filters]');
  await popup.waitFor({ timeout: 8000 });
  const nomes = (await popup.locator('.ef-category').allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return nomes;
}

// ── Leitura e uso dos filtros da LISTA (tarefas e requisições) ─────────────────

/** Rótulos dos chips de filtro ativos, no formato "Categoria: resumo". */
export async function chipsDeFiltro(page) {
  return (await page.locator('.ef-chip .ef-chip-label').allInnerTexts()).map((t) => t.trim());
}

/** Marca um PROCESSO na categoria "Processos" e devolve o contador exibido para ele. */
export async function escolherProcesso(page, nome) {
  await escolherCategoria(page, 'Processos');
  const opcao = page.locator('[data-testid=filtro-processos] .ef-option', { hasText: nome }).first();
  await opcao.waitFor({ timeout: 8000 });
  const contador = (await opcao.locator('span').last().innerText()).trim();
  await opcao.locator('input').check();
  await page.waitForTimeout(400);
  await fecharFiltros(page);
  return contador;
}

/** Ordena a lista: `campo` é '', 'prazo' ou 'numero'; `direcao` é 'asc' ou 'desc'. */
export async function ordenarPor(page, campo, direcao) {
  await escolherCategoria(page, 'Ordenação');
  await page.locator('[data-testid=filtro-ordenar]').selectOption(campo);
  await page.waitForTimeout(300);
  if (direcao) {
    await page.locator('[data-testid=painel-filtros] .ef-option', { hasText: direcao === 'asc' ? 'Crescente' : 'Decrescente' })
      .first().locator('input').check();
    await page.waitForTimeout(300);
  }
  await fecharFiltros(page);
}

/** Preenche um intervalo de datas. `categoria` é o rótulo; `de`/`ate` são ISO (ou ''). */
export async function filtrarIntervalo(page, categoria, prefixo, de, ate) {
  await escolherCategoria(page, categoria);
  if (de !== undefined) await page.locator(`[data-testid=painel-filtros] input[aria-label="${prefixo} de"]`).fill(de);
  if (ate !== undefined) await page.locator(`[data-testid=painel-filtros] input[aria-label="${prefixo} até"]`).fill(ate);
  await page.waitForTimeout(400);
  await fecharFiltros(page);
}

/** Remove um filtro pelo chip (o rótulo do botão é "Remover filtro <categoria>"). */
export async function removerFiltro(page, categoria) {
  await page.getByRole('button', { name: `Remover filtro ${categoria}` }).first().click();
  await page.waitForTimeout(600);
}

/** Limpa todos os filtros. */
export async function limparFiltros(page) {
  await page.locator('[data-testid=limpar-filtros]').first().click();
  await page.waitForTimeout(800);
}

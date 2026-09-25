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

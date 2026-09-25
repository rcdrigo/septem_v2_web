// Helpers do EDITOR DE FORMULÁRIO (nativo) no modelador, compartilhados pelas sondas.
//
// O editor form-js (paleta + canvas + painel) foi substituído pelo editor NATIVO: uma
// LISTA de campos por agrupamento, campos adicionados por um catálogo ("Adicionar campo
// em <grupo>") e o painel de propriedades numa coluna à direita (`data-native-properties`,
// com abas Geral/Aparência/Validação/Eventos). O editor só assume formulário no formato
// nativo — processo em formato anterior mostra aviso e não abre.
//
// Não é uma suíte: o `run-all.sh` ignora `lib-*.mjs`.

const BASE = 'http://localhost:5173';

/** Abre um processo NOVO no modelador e vai para o editor de formulário (nativo e vazio). */
export async function abrirFormularioDeProcessoNovo(page) {
  await page.goto(`${BASE}/flows/edit`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 20000 });
  await page.getByRole('button', { name: 'Formulário', exact: true }).click();
  await page.locator('[data-native-editor]').waitFor({ timeout: 15000 });
}

/**
 * Acrescenta um campo pelo catálogo e o deixa selecionado (o editor já foca o "Nome").
 * `tipo` é o rótulo do catálogo: "Texto", "Data / Hora", "Upload de arquivo", "Lista"…
 */
export async function adicionarCampo(page, tipo, nome) {
  await page.getByRole('button', { name: /^Adicionar campo em / }).first().click();
  await page.getByRole('button', { name: tipo, exact: true }).click();
  const campoNome = page.locator('[data-native-properties] input[aria-label="Nome"]');
  await campoNome.waitFor({ timeout: 10000 });
  // Nomear é parte de adicionar: a CHAVE nasce do nome e campo sem chave NÃO é guardado
  // ao salvar o processo (o editor avisa, mas quem monta o formulário sempre nomeia).
  await campoNome.fill(nome ?? `${tipo} ${Math.floor(Math.random() * 1e6)}`);
  await campoNome.blur();
  await page.waitForTimeout(700);
}

/** Abre uma aba do painel de propriedades do campo ("Geral", "Aparência", "Validação"). */
export async function abaDoCampo(page, rotulo) {
  await page.locator('[data-native-properties] button', { hasText: rotulo }).first().click();
  await page.waitForTimeout(300);
}

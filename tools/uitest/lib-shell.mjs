// Helpers do SHELL (barra lateral, menu do usuário), compartilhados pelas sondas.
//
// O menu do usuário virou um popover cujo gatilho é um <span> (não mais um <button>) e
// cujos itens saem num PORTAL, fora do <aside>. Além disso o gatilho fica dentro do
// drawer no mobile, que anima ao abrir — clicar por classe pegava um elemento "instável".
// Ancorar no e-mail do usuário, que é o texto estável do gatilho, resolve os dois.
//
// Não é uma suíte: o `run-all.sh` ignora `lib-*.mjs`.

/**
 * Abre o menu do usuário na barra lateral.
 *
 * NÃO ancorar no e-mail: durante uma personificação o rodapé mostra o e-mail do
 * personificado, e era justamente aí que a sonda precisava do menu para SAIR.
 * O gatilho é o único `button[aria-haspopup=menu]` do <aside>.
 */
export async function abrirMenuDoUsuario(page) {
  if (await page.getByRole('menuitem').count() > 0) return; // já aberto
  const gatilho = page.locator('aside button[aria-haspopup=menu]').last();
  await gatilho.waitFor({ state: 'attached', timeout: 15000 });
  await gatilho.scrollIntoViewIfNeeded().catch(() => {});
  await gatilho.click();
  await page.getByRole('menuitem').first().waitFor({ timeout: 8000 });
}

/** Clica num item do menu do usuário pelo rótulo (regex ou texto). */
export async function itemDoMenuDoUsuario(page, rotulo) {
  await abrirMenuDoUsuario(page);
  await page.getByRole('menuitem', { name: rotulo }).first().click();
}

/**
 * Troca o modo de acesso (Interno/Externo). O switcher saiu da tela e virou um submenu
 * dentro do menu do usuário: item com `aria-haspopup=menu` e opções `menuitemradio`.
 */
export async function trocarModoDeAcesso(page, rotulo) {
  await abrirMenuDoUsuario(page);
  // HOVER, não clique: o submenu abre no `mouseEnter` e o `onClick` do item alterna —
  // clicar (que passa pelo hover antes) abriria e fecharia na mesma ação.
  await page.locator('[role=menuitem][aria-haspopup=menu]').first().hover();
  await page.getByRole('menuitemradio', { name: rotulo }).waitFor({ timeout: 8000 });
  await page.getByRole('menuitemradio', { name: rotulo }).click();
  await page.waitForTimeout(800);
}

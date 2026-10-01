// Auditoria responsiva OBJETIVA do protocolo de UI (doc/rules.md): "nenhum contêiner com overflow
// horizontal" e "nenhum controle com getBoundingClientRect() fora da viewport (clipped: 0)".
//
// Um lugar só para a medida — antes cada sonda reescrevia a sua, e as do suporte (Fases 5–8) só
// mediam o overflow da página, sem o `clipped`.

/**
 * Mede a tela agora. `clipped` conta controles VISÍVEIS (botão, link, campo, imagem, [role=button])
 * cortados pela borda da viewport. O que está INTEIRO à esquerda da tela (a gaveta lateral fechada do
 * celular, `-translate-x-full`) não é "cortado": é escondido de propósito, e fica de fora.
 */
export async function auditarTela(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const largura = window.innerWidth;
    const cortados = [...document.querySelectorAll('button, a[href], input, select, textarea, img, [role=button]')]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return false;              // invisível
        if (b.right <= 0) return false;                                  // gaveta fechada, fora de propósito
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') return false;
        return b.left < -1 || b.right > largura + 1;
      })
      .map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''}:${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}`);
    return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped: cortados.length, quais: cortados.slice(0, 5) };
  });
}

/** Os dois checks do protocolo, com o nome do que foi cortado quando falha. */
export async function checarResponsivo(page, check, rotulo) {
  const r = await auditarTela(page);
  check(!r.overflows, `${rotulo}: sem overflow horizontal`);
  check(r.clipped === 0, `${rotulo}: nenhum controle cortado (clipped: ${r.clipped}${r.quais.length ? ` → ${r.quais.join(' | ')}` : ''})`);
  return r;
}

/**
 * Acessibilidade mínima e OBJETIVA (requisito transversal do plano 26_09: "rótulos, navegação por
 * teclado, foco devolvido após diálogo"): todo controle VISÍVEL precisa de nome acessível — texto,
 * `aria-label`, `aria-labelledby`, `title`, `alt` de imagem dentro, `<label>` associado ou placeholder.
 * Botão só com ícone e sem `aria-label` é invisível para leitor de tela.
 */
export async function controlesSemNome(page) {
  return page.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')]
    .filter((el) => {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0 || b.right <= 0) return false;
      if (getComputedStyle(el).visibility === 'hidden') return false;
      const nome = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')
        || el.textContent?.trim() || el.querySelector('img[alt]')?.getAttribute('alt')
        || (el.labels && el.labels.length > 0 ? 'rotulo' : '') || el.getAttribute('placeholder') || '').trim();
      // Input de arquivo escondido atrás de um <label> com texto conta pelo rótulo.
      if (!nome && el.type === 'file' && el.closest('label')?.textContent?.trim()) return false;
      return !nome;
    })
    .map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`));
}

export async function checarAcessibilidade(page, check, rotulo) {
  const sem = await controlesSemNome(page);
  check(sem.length === 0, `${rotulo}: todo controle tem nome acessível (${sem.length}${sem.length ? ` → ${sem.slice(0, 5).join(' | ')}` : ''})`);
  return sem;
}

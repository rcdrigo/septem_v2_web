/**
 * Navegação absoluta respeitando o base path do app (`import.meta.env.BASE_URL`,
 * ex.: `/septem_v2_web/` no GitHub Pages). `window.open('/x')` ignora o basename
 * do router e quebra sob subpath — use estes helpers.
 */
function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

/** Abre um caminho do app em nova aba (sem menus), respeitando o base path. */
export function openTab(path: string): void {
  window.open(withBase(path), '_blank', 'noopener');
}

/** Navega na mesma aba para um caminho do app, respeitando o base path. */
export function navTo(path: string): void {
  window.location.assign(withBase(path));
}

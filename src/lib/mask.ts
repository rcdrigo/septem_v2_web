/**
 * Máscaras de campo: deriva um template fixo (placeholders + literais) a partir
 * de uma regex simples e aplica-o ao valor digitado. Compartilhado entre o
 * renderer (ReactForm) e o teste de máscara (MasksDialog).
 *
 * Placeholders do template:
 *   `#` = dígito · `A` = letra (uppercase) · `*` = alfanumérico
 * Demais caracteres do template são literais (`.`, `-`, `/`, `(`, `)`, espaço…).
 */

/** `[A-Z]`→A, `[0-9]`→#, `[A-Za-z0-9]`→*, etc. null se não-mapeável. */
function classToPlaceholder(body: string): string | null {
  const b = body.replace(/\s/g, '');
  const hasDigit = /0-9/.test(b) || /\\d/.test(b);
  const hasLetter = /a-z/i.test(b);
  if (hasDigit && !hasLetter) return '#';
  if (hasLetter && !hasDigit) return 'A';
  if (hasLetter && hasDigit) return '*';
  return null;
}

/**
 * Converte uma regex simples (ex.: `\d{3}\.\d{3}\.\d{3}-\d{2}`,
 * `[A-Z]{3}\d[A-Z]\d{2}`) num template (`###.###.###-##`, `AAA#A##`).
 * Retorna null para construções não-mapeáveis (ranges `{n,m}`, `+ * ? |`, grupos).
 */
export function regexToTemplate(rx: string): string | null {
  let s = rx;
  if (s.startsWith('^')) s = s.slice(1);
  if (s.endsWith('$')) s = s.slice(0, -1);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    let token: string | null = null;

    if (c === '\\') {
      const n = s[i + 1];
      if (n === undefined) return null;
      if (n === 'd') token = '#';
      else if (n === 'w') token = '*';
      else if (n === 's') token = ' ';
      else token = n; // literal escapado (\. \- \/ \( \))
      i += 2;
    } else if (c === '[') {
      const close = s.indexOf(']', i + 1);
      if (close < 0) return null;
      token = classToPlaceholder(s.slice(i + 1, close));
      if (token === null) return null;
      i = close + 1;
    } else if ('+*?|.(){}'.includes(c)) {
      return null; // quantificador/curinga/grupo não-mapeável
    } else {
      token = c; // literal
      i += 1;
    }

    // quantificador fixo {n}? (ranges {n,m} → não-mapeável)
    let count = 1;
    if (s[i] === '{') {
      const close = s.indexOf('}', i);
      if (close < 0) return null;
      const inner = s.slice(i + 1, close);
      if (!/^\d+$/.test(inner)) return null;
      count = parseInt(inner, 10);
      i = close + 1;
    }
    out += token.repeat(count);
  }
  return /[#A*]/.test(out) ? out : null;
}

const isPlaceholder = (ch: string) => ch === '#' || ch === 'A' || ch === '*';

/** Aplica o template ao valor cru, ignorando caracteres que não casam. */
export function applyMask(template: string, raw: string): string {
  let out = '';
  let pending = ''; // literais aguardando o próximo placeholder preenchido
  let ri = 0;
  for (let i = 0; i < template.length; i++) {
    const ph = template[i];
    if (!isPlaceholder(ph)) { pending += ph; continue; }
    let filled = '';
    while (ri < raw.length) {
      const ch = raw[ri++];
      if (ph === '#' && /\d/.test(ch)) { filled = ch; break; }
      if (ph === 'A' && /[a-zA-Z]/.test(ch)) { filled = ch.toUpperCase(); break; }
      if (ph === '*' && /[a-zA-Z0-9]/.test(ch)) { filled = ch; break; }
    }
    if (!filled) break; // input esgotado → não emite literais/placeholder pendentes
    out += pending + filled;
    pending = '';
  }
  return out;
}

/** True se o template só tem dígitos/literais (sem letras) → inputMode numérico. */
export function isAllDigits(template: string): boolean {
  return !/[A*]/.test(template);
}

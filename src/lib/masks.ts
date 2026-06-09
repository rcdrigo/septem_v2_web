/** Máscaras e validações de campos cadastrais (CPF, telefone). */

/** Formata progressivamente como 000.000.000-00 (até 11 dígitos). */
export function maskCpf(raw: string): string {
  const c = raw.replace(/\D/g, '').slice(0, 11);
  if (c.length > 9) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  if (c.length > 6) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6)}`;
  if (c.length > 3) return `${c.slice(0, 3)}.${c.slice(3)}`;
  return c;
}

/** Valida CPF pelos dígitos verificadores (rejeita repetidos como 111.111.111-11). */
export function isValidCpf(raw: string): boolean {
  const c = (raw ?? '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
}

/** Formata como (00) 00000-0000 (celular) ou (00) 0000-0000 (fixo). */
export function maskPhone(raw: string): string {
  const c = raw.replace(/\D/g, '').slice(0, 11);
  if (c.length <= 2) return c.length ? `(${c}` : c;
  if (c.length <= 6) return `(${c.slice(0, 2)}) ${c.slice(2)}`;
  if (c.length <= 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
}

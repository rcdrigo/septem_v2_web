/**
 * CPF/CNPJ: máscara dinâmica + validação por DÍGITO VERIFICADOR (não só formato).
 * Espelha `DocumentValidator` do backend — aqui é a UX (máscara ao digitar + erro
 * em vermelho na hora); lá é a regra autoritativa (a tarefa não conclui inválida).
 */
import { applyMask } from '@/lib/mask';

export type DocKind = 'cpf' | 'cnpj' | 'cpfCnpj';

const CPF_TEMPLATE = '###.###.###-##';
const CNPJ_TEMPLATE = '##.###.###/####-##';

export const onlyDigits = (v: string): string => (v ?? '').replace(/\D/g, '');

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const n = d.split('').map(Number);
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(9) === n[9] && dv(10) === n[10];
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const n = d.split('').map(Number);
  const dv = (len: number) => {
    let sum = 0;
    let weight = 2;
    for (let i = len - 1; i >= 0; i--) {
      sum += n[i] * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === n[12] && dv(13) === n[13];
}

/** Máscara dinâmica: em `cpfCnpj`, ≤11 dígitos vira CPF; a partir do 12º, CNPJ. */
export function maskDocumento(value: string, kind: DocKind): string {
  const d = onlyDigits(value);
  const template = kind === 'cpf' ? CPF_TEMPLATE : kind === 'cnpj' ? CNPJ_TEMPLATE : d.length <= 11 ? CPF_TEMPLATE : CNPJ_TEMPLATE;
  return applyMask(template, d);
}

/** Vazio é válido (obrigatoriedade é outra regra). Devolve a mensagem de erro, ou null. */
export function validateDocumento(value: string, kind: DocKind): string | null {
  if (!onlyDigits(value)) return null;
  if (kind === 'cpf') return isValidCpf(value) ? null : 'CPF inválido.';
  if (kind === 'cnpj') return isValidCnpj(value) ? null : 'CNPJ inválido.';
  const d = onlyDigits(value);
  const ok = d.length <= 11 ? isValidCpf(value) : isValidCnpj(value);
  return ok ? null : 'CPF ou CNPJ inválido.';
}

export const DOC_KIND_OPTIONS = [
  { value: '', label: '— não é documento —' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'cpfCnpj', label: 'CPF ou CNPJ (dinâmico)' },
];

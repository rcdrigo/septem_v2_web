/**
 * Slug determinístico para gerar IDs a partir de labels em português.
 * - normaliza acentos via NFD
 * - troca não-alfanumérico por underscore
 * - colapsa underscores repetidos
 * - força lowercase
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

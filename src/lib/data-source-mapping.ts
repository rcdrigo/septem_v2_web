export type ApiMapping = { repeat: string; value: string; text: string; fields: Record<string, string> };

export function parseFormFieldMapping(text: string): Record<string, string> {
  const entries: [string, string][] = [];
  const seen = new Set<string>();
  for (const [index, line] of text.split('\n').entries()) {
    if (!line.trim()) continue;
    const separator = line.indexOf('=>');
    const key = line.slice(0, separator).trim();
    const path = line.slice(separator + 2).trim();
    if (separator < 1 || !key || !path || path.includes('=>')) {
      throw new Error(`Linha ${index + 1}: use identificador => caminho, com um campo por linha.`);
    }
    if (seen.has(key)) throw new Error(`Linha ${index + 1}: o identificador "${key}" está repetido.`);
    seen.add(key);
    entries.push([key, path]);
  }
  return Object.fromEntries(entries);
}

export function formatFormFieldMapping(fields: unknown): string {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return '';
  return Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, path]) => `${key} => ${path}`).join('\n');
}

// Gera src/lib/fa-icon-names.ts a partir dos metadados do FontAwesome Free.
// Rode após atualizar @fortawesome/fontawesome-free:  node tools/gen-fa-icons.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const m = require('@fortawesome/fontawesome-free/metadata/icon-families.json');
const styleOf = (n) => (m[n].familyStylesByLicense?.free || []).map((x) => x.style);
const solid = Object.keys(m).filter((n) => styleOf(n).includes('solid')).sort();
const regular = Object.keys(m).filter((n) => styleOf(n).includes('regular')).sort();

const body =
  '// AUTO-GERADO de @fortawesome/fontawesome-free/metadata/icon-families.json.\n' +
  '// Não editar à mão — rode tools/gen-fa-icons.mjs após atualizar o FontAwesome.\n\n' +
  `/** Todos os ícones FontAwesome Free com estilo sólido (${solid.length}). */\n` +
  `export const FA_ALL_ICON_NAMES: string[] = ${JSON.stringify(solid)};\n\n` +
  `/** Os que também têm estilo regular free (${regular.length}). */\n` +
  `export const FA_REGULAR_ICON_NAMES: ReadonlySet<string> = new Set(${JSON.stringify(regular)});\n`;

writeFileSync(new URL('../src/lib/fa-icon-names.ts', import.meta.url), body);
console.log(`gerado: src/lib/fa-icon-names.ts — ${solid.length} solid, ${regular.length} regular`);

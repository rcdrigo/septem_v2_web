import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(`${tmpdir()}/migration-contract-`);
try {
  execFileSync('python3', ['tools/uitest/native-migration.py'], { stdio: 'inherit' });
  execFileSync('python3', ['tools/uitest/postgres-tools.py'], { stdio: 'inherit' });
  await build({ entryPoints: ['src/lib/native-form.ts'], bundle: true, platform: 'node', format: 'esm', outfile: `${dir}/contract.mjs` });
  const { parseNativeForm, filterNativeAnswers } = await import(pathToFileURL(`${dir}/contract.mjs`));
  const schema = parseNativeForm(JSON.parse(execFileSync('python3', ['tools/uitest/native-migration.py', '--fixture'], { encoding: 'utf8' })));
  const data = { nome: 'Teste', itens: [{ quantidade: 0, ativo: false }, {}] };
  assert.deepEqual(filterNativeAnswers(schema, data), data);
  console.log('PASSOU: conversão aceita pelo contrato nativo, respostas preservadas.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

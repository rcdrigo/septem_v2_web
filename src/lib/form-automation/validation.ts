import { analyze } from 'eslint-scope';
import globals from 'globals';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';
export function validateAutomation(code: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  try {
    const ast = parse(`async function automation(form,$,jQuery,fetch,setTimeout,setInterval){\n${code}\n}`, { ecmaVersion: 2022, locations: true, ranges: true });
    const scope = analyze(ast as never, { ecmaVersion: 2022, sourceType: 'script', optimistic: true });
    for (const reference of scope.globalScope?.through ?? []) {
      const name = reference.identifier.name;
      if (!(name in globals.browser) && !(name in globals.es2021)) errors.push(`Referência não definida: ${name}.`);
    }
    simple(ast, {
      DebuggerStatement() { warnings.push('Remova debugger antes de publicar.'); },
      WhileStatement(node) {
        if (node.test.type === 'Literal' && node.test.value === true) warnings.push('Laço while(true): confirme uma condição de saída para não travar o navegador.');
      },
      ForStatement(node) { if (!node.test) warnings.push('Laço for sem condição: confirme uma condição de saída.'); },
    });
  } catch (e) { errors.push((e as Error).message); }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

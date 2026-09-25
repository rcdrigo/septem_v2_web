/** Remove apenas resíduos de espaços HTML nas bordas de SQL copiado.
 * Não decodifica o conteúdo da consulta: literais, operadores e ';' são preservados.
 */
export function normalizeSqlQuery(query: string): string {
  const edgeSpace = /^(?:\s|&nbsp;|&#(?:0*(?:9|10|13|32|160)|x0*(?:9|a|d|20|a0));)+|(?:\s|&nbsp;|&#(?:0*(?:9|10|13|32|160)|x0*(?:9|a|d|20|a0));)+$/gi;
  return query.replace(edgeSpace, '');
}

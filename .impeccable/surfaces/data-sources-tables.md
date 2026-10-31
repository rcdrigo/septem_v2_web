# Fontes de dados em tabela

Modo: Operate. Extensão do editor `FontesDadosPage`, mantendo sua identidade branca/slate e seus controles compartilhados. Administradores cadastram tabelas e configuram consultas por campos do formulário sem escrever SQL.

## Continuidade da extensão

A interface preserva superfícies brancas sobre fundo slate claro, bordas discretas, tipografia de sistema e ícones Lucide. `TableDataSourceEditors.tsx` reutiliza `Field`, `Select` e `TextInput`. Os novos títulos e instruções seguem a hierarquia compacta do editor. As ações Cancelar, Testar e Salvar permanecem no rodapé. Em telas estreitas, campos empilham e tabelas mantêm rolagem horizontal dentro do painel.

O tipo Fixa (Simples) preserva a lista de valor/texto. Fixa (Tabela) oferece células e cabeçalhos editáveis, inclusão e remoção de linhas/colunas e importação XLSX, XLS ou CSV com prévia antes da substituição. Customizado (Tabela) escolhe a origem, as colunas de valor/texto e filtros combinados por AND, vinculados ao identificador digitado do campo. Os valores usados para testar não são persistidos.

O mapeamento compartilha o editor das fontes API, com instrução específica `identificador => coluna`. No formulário, `useFormDataSources.ts` coordena atualização de opções, dependências, espera, ausência de resultados e erro. Consultas de tabela preenchem campos de texto com os textos separados por vírgula e removem seleções que deixaram de ser válidas.

## Evidência e alcance

Código conferido: `TableDataSourceEditors.tsx` (`EditableTableEditor` e `TableQueryEditor`), `FontesDadosPage.tsx` (`FormFieldMappingEditor`), `useFormDataSources.ts` e tipografia de `src/styles/globals.css`. O manual operacional está em `docs/manuais-tecnicos/fontes-dados-integracoes.md`.

Capturas conferidas visualmente em larguras de 1440 e 390 px:

- `../review/data-source-table-edit-1440.png`
- `../review/data-source-table-edit-390.png`
- `../review/data-source-table-query-1440.png`
- `../review/data-source-table-query-390.png`

A revisão independente desta extensão retornou `ship`, sem achados materiais. A implementação informou validação por `npm run test:data-sources`, `node tools/uitest/form-automation.mjs` e `node tools/uitest/native-form-runtime.mjs`. No repositório irmão `septem_v2`, informou build da API e 29 testes de DataSources aprovados. Os resultados estão no histórico da entrega; este registro não constitui um log de execução.

Este recorte preserva o sistema existente. Não cria tokens globais, não supre o `DESIGN.md` ausente e não certifica outras superfícies ou integrações. `PRODUCT.md` e o brief `native-form-editor.md` permanecem como estavam.

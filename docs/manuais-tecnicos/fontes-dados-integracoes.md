# Fontes de dados e integrações

## Objetivo deste manual

Este manual explica como criar, testar, manter e utilizar fontes de dados em processos e relatórios. Fontes de dados fornecem listas e valores dinâmicos para campos de formulário e outros pontos da automação. Administradores e usuários autorizados podem cadastrar listas e tabelas visualmente. Fontes SQL e API exigem configuração técnica.

Use uma fonte quando uma informação precisa ser reutilizada, mantida fora do formulário ou consultada em outro sistema. Exemplos: relação de secretarias, tipos de licença, contratos vigentes, fornecedores cadastrados e empreendimentos vinculados a um CPF ou CNPJ.

## Antes de começar

Defina o **escopo** correto. Fontes de **Processos** alimentam formulários, tarefas e rotinas. Fontes de **Relatórios** atendem consultas e relatórios. A tela mostra o escopo ao lado do título; confirme-o antes de criar a fonte.

Também identifique a origem e o responsável pelos dados. Uma lista curta e estável pode ser fixa. Dados do banco do órgão podem usar SQL de leitura. Dados mantidos por outro sistema podem usar uma API JSON.

## Configurando uma fonte

1. Acesse **Administração > Fontes de dados** no escopo desejado.
2. Clique em **Nova fonte**. O editor abre em outra aba.
3. Informe um **Nome** que descreva o dado, como `Tipos de licença ambiental`.
4. Preencha a **Descrição** com a origem, a finalidade e o responsável pela manutenção.
5. Escolha o **Tipo**: Fixa (Simples), Fixa (Tabela), Customizado (Tabela), Customizado (SQL) ou API (JSON).
6. Configure o tipo escolhido e clique em **Testar**.
7. Confira as colunas e linhas retornadas.
8. Clique em **Salvar** somente depois de validar o resultado.

O teste usa a configuração exibida, mesmo antes de salvar. Sempre teste novamente depois de alterar consulta, URL, cabeçalhos, corpo ou mapeamento.

## Fixa (Simples)

A fonte fixa mantém uma lista de pares **valor** e **texto**. O valor é gravado pelo sistema; o texto é apresentado ao usuário.

Exemplo:

| Valor | Texto apresentado |
|---|---|
| `LP` | Licença Prévia |
| `LI` | Licença de Instalação |
| `LO` | Licença de Operação |

Use **+ adicionar item** para incluir opções e o botão de remoção para excluí-las. Ordene alfabeticamente por valor ou texto, ou use as setas para definir uma ordem manual. Evite alterar o valor de uma opção já utilizada: registros antigos podem continuar contendo o código anterior.

## Fixa (Tabela)

Use a **Tabela editável** para cadastrar linhas e colunas. Clique em **Adicionar coluna** para nomear uma informação e em **Adicionar linha** para incluir um registro. Use os botões de remoção para excluir linhas ou colunas.

Para importar dados:

1. Escolha um arquivo `.xlsx`, `.xls` ou `.csv` em **Importar planilha**.
2. Confira os cabeçalhos e as primeiras linhas da prévia.
3. Clique em **Usar dados importados** para substituir a tabela atual.
4. Clique em **Salvar** para persistir os dados.

A importação lê a primeira aba e usa a primeira linha como cabeçalho. Os nomes das colunas devem ser únicos e preenchidos. A tabela aceita até 100 colunas e 10.000 linhas. O arquivo deve ter até 10 MB. A importação mantém a representação de texto dos códigos, incluindo zeros definidos na formatação da planilha.

## Customizado (Tabela)

Use este tipo para consultar uma fonte **Fixa (Tabela)** sem escrever SQL.

1. Selecione a **Fonte Fixa (Tabela)**.
2. Selecione a **Coluna de valor**, cujo conteúdo identifica a opção.
3. Selecione a **Coluna de texto**, cujo conteúdo é apresentado no formulário.
4. Para restringir os resultados, clique em **Adicionar filtro**.
5. Em cada filtro, selecione a coluna e a comparação. Digite o identificador do campo do formulário.
6. Informe os **Valores para testar** e clique em **Testar**.
7. Confira o resultado e clique em **Salvar**.

Todos os filtros devem ser atendidos. As comparações disponíveis são igualdade, diferença, contém, começa com, maior, maior ou igual, menor e menor ou igual. As comparações de ordem usam números. Os valores de teste não são salvos.

Para localizar o identificador, abra o formulário no modelador, selecione o campo e copie **Chave (identificador)**. Por exemplo, filtre a coluna `Código do grupo` usando **Igual a** e o identificador `grupo`.

O resultado contém somente as duas colunas selecionadas como valor e texto. Pares repetidos de valor e texto aparecem uma vez. Em um combobox, os resultados são as opções disponíveis. Em um campo de texto, os textos são concatenados com vírgula.

Enquanto um campo usado como filtro estiver vazio, o campo dependente aguarda seu preenchimento. Ao trocar a seleção anterior, as opções são atualizadas e seleções inválidas são limpas. Quando não há correspondência, o formulário informa que nenhum resultado foi encontrado.

Para preencher outros campos após selecionar uma opção, use **Mapeamento dos campos do formulário**. Informe um mapeamento por linha no formato `identificador => coluna`, usando o nome exato da coluna de origem. O preenchimento utiliza a linha da opção selecionada, como nas fontes API.

## Fonte SQL

A fonte SQL executa uma consulta somente de leitura no banco do tenant. Informe um `SELECT` ou uma procedure permitida. Quando o resultado possui uma coluna, ela é usada como valor e texto. Com duas colunas, a primeira representa o valor e a segunda o texto mostrado.

Exemplo conceitual:

```sql
SELECT id, nome
FROM setores
WHERE responsavel = {{requisitante.nome}}
ORDER BY nome
```

Os tokens entre chaves são **placeholders** resolvidos como parâmetros durante a execução. Abra **Ver placeholders** e clique em um token para copiá-lo. Prefira filtros por parâmetros e retorne somente as colunas necessárias. Não inclua comandos de alteração de dados.

Ao testar uma consulta que depende do contexto de uma requisição, alguns placeholders podem não possuir valor. Valide também a fonte dentro do processo publicado ou de uma simulação controlada.

## Fonte API (JSON)

Informe a **URL**, escolha o método `GET`, `POST` ou `PUT` e, quando necessário, adicione **Headers**. Para métodos diferentes de GET, informe o **Body (JSON)**. URL, cabeçalhos e corpo aceitam placeholders.

Depois configure o mapeamento por caminho pontilhado:

- **nó de repetição**: local do array na resposta, por exemplo `data.itens`;
- **nó de valor**: propriedade gravada, por exemplo `id`;
- **nó de texto**: propriedade apresentada, por exemplo `nome`.

Para uma resposta `{ "data": { "itens": [{ "id": 12, "nome": "Fornecedor Alfa" }] } }`, use `data.itens`, `id` e `nome`.

Não coloque segredos em campos que serão compartilhados sem antes confirmar como o ambiente protege a configuração. Prefira credenciais técnicas com o menor acesso necessário e planeje sua rotação.

## Teste e diagnóstico

O resultado do teste informa o total de linhas, os nomes das colunas e os valores retornados. Verifique se o valor é estável e se o texto é compreensível para o usuário.

Falhas comuns:

- **nenhuma linha**: revise filtros, placeholders e dados disponíveis no ambiente;
- **SQL rejeitado**: confirme que é uma operação de leitura e que os nomes existem no banco do tenant;
- **API sem resultado**: confira URL, método, headers, body e caminhos do mapeamento;
- **texto ou valor vazio**: ajuste as colunas SQL ou as propriedades JSON;
- **resultado duplicado**: corrija a origem ou aplique agrupamento adequado.

## Utilização e manutenção

Ao editar uma fonte existente, consulte **Onde é utilizada**. A seção lista processo, tarefa e campo dependentes. Faça esse levantamento antes de renomear opções, alterar tipos ou excluir a fonte.

Para mudanças relevantes, teste em homologação, simule os processos afetados e registre a alteração. Exclua uma fonte apenas quando a lista de utilizações estiver vazia ou quando todas as dependências já tiverem sido removidas.

## Checklist de publicação

- escopo de processo ou relatório confirmado;
- nome e descrição explicam finalidade e origem;
- valores persistidos são estáveis;
- teste retorna colunas e linhas esperadas;
- placeholders foram validados com contexto real;
- dependências foram revisadas;
- credenciais e dados sensíveis estão protegidos.

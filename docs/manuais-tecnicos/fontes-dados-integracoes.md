# Fontes de dados e integrações

## Objetivo deste manual

Este manual explica como criar, testar, manter e utilizar fontes de dados em processos e relatórios. Fontes de dados fornecem listas e valores dinâmicos para campos de formulário e outros pontos da automação. O cadastro é técnico e deve ser feito por administradores ou usuários autorizados.

Use uma fonte quando uma informação precisa ser reutilizada, mantida fora do formulário ou consultada em outro sistema. Exemplos: relação de secretarias, tipos de licença, contratos vigentes, fornecedores cadastrados e empreendimentos vinculados a um CPF ou CNPJ.

## Antes de começar

Defina o **escopo** correto. Fontes de **Processos** alimentam formulários, tarefas e rotinas. Fontes de **Relatórios** atendem consultas e relatórios. A tela mostra o escopo ao lado do título; confirme-o antes de criar a fonte.

Também identifique a origem e o responsável pelos dados. Uma lista curta e estável pode ser fixa. Dados do banco do órgão podem usar SQL de leitura. Dados mantidos por outro sistema podem usar uma API JSON.

## Configurando uma fonte

1. Acesse **Administração > Fontes de dados** no escopo desejado.
2. Clique em **Nova fonte**. O editor abre em outra aba.
3. Informe um **Nome** que descreva o dado, como `Tipos de licença ambiental`.
4. Preencha a **Descrição** com a origem, a finalidade e o responsável pela manutenção.
5. Escolha o **Tipo**: Fixa, Customizado (SQL) ou API (JSON).
6. Configure o tipo escolhido e clique em **Testar**.
7. Confira as colunas e linhas retornadas.
8. Clique em **Salvar** somente depois de validar o resultado.

O teste usa a configuração exibida, mesmo antes de salvar. Sempre teste novamente depois de alterar consulta, URL, cabeçalhos, corpo ou mapeamento.

## Fonte fixa

A fonte fixa mantém uma lista de pares **valor** e **texto**. O valor é gravado pelo sistema; o texto é apresentado ao usuário.

Exemplo:

| Valor | Texto apresentado |
|---|---|
| `LP` | Licença Prévia |
| `LI` | Licença de Instalação |
| `LO` | Licença de Operação |

Use **+ adicionar item** para incluir opções e o botão de remoção para excluí-las. Ordene alfabeticamente por valor ou texto, ou use as setas para definir uma ordem manual. Evite alterar o valor de uma opção já utilizada: registros antigos podem continuar contendo o código anterior.

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

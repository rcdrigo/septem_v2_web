# Criação e publicação de relatórios

**Manuais técnicos › Relatórios › Criação e publicação de relatórios**

Este manual explica como cadastrar um relatório, selecionar sua origem, montar blocos, configurar filtros e acesso, validar a prévia e publicar a consulta.

> **Acesso restrito**
> A leitura administrativa depende de `reports:read`; criar, editar e publicar requer `reports:write`. Fontes de dados também exigem permissões próprias.

## Planeje antes de criar

Defina:

- pergunta que o relatório responderá;
- público autorizado;
- origem dos dados;
- período e filtros necessários;
- indicadores e detalhamento;
- frequência de atualização;
- campos pessoais ou restritos que devem ser omitidos.

Exemplo: **Quais contratos vencem nos próximos 90 dias, por unidade gestora?** A origem precisa fornecer contrato, fornecedor, unidade, início, fim e situação.

## Cadastrando o relatório

Acesse **Admin › Relatórios e Dashboards › Relatórios** e clique em **Novo relatório**.

Informe:

- **Nome:** título reconhecível no catálogo;
- **Descrição:** finalidade em linguagem do usuário;
- **Fonte de dados:** fonte com escopo de relatório, quando utilizada;
- **Categoria:** agrupamento exibido em Consultas.

O nome deve ser único. Depois de criar, use o botão do builder para configurar blocos, filtros e prévia.

## Conhecendo o editor

O cabeçalho mostra nome, versão e status e contém:

- **Atualizar campos da origem**;
- **Salvar rascunho**;
- **Publicar**.

O editor possui cinco abas:

| Aba | O que configurar |
|---|---|
| **Origem dos dados** | Fonte, processo, campos, rótulos, tipos e exclusões. |
| **Blocos** | Tabelas, KPIs e gráficos que compõem o relatório. |
| **Filtros e detalhe** | Critérios globais, parâmetros, drill-down e cache. |
| **Acesso** | Quem encontra e visualiza a consulta publicada. |
| **Preview** | Execução do rascunho salvo com dados reais. |

## Configurando a origem dos dados

### Fonte de dados de relatório

Escolha **Fonte de dados (relatório)** para usar uma consulta cadastrada. As colunas e tipos são inferidos da fonte e podem ser ajustados no editor.

Use quando os dados precisam de consulta SQL, procedure, API ou preparação específica independente de um processo.

### Processo

Escolha **Processo (instâncias)** para consultar requisições de todas as versões. Somente campos marcados como **Visível no relatório** no formulário ficam disponíveis.

Use quando a pergunta depende diretamente dos dados coletados no processo.

### Rótulos e tipos

A tabela de campos apresenta nome, chave, grupo e tipo. Defina um rótulo compreensível, por exemplo:

- `contrato.numero` → **Número do contrato**;
- `fornecedor.razao_social` → **Fornecedor**;
- `vigencia.fim` → **Fim da vigência**.

Para fontes de dados, ajuste tipos incorretamente inferidos entre texto, número, data e sim/não. O tipo influencia filtros, agregações e apresentação.

Para origem de processo, remova campos que não serão utilizados e restaure-os quando necessário.

## Atualizando campos da origem

Depois que uma fonte ou formulário muda, o relatório publicado preserva o schema anterior até uma sincronização.

Clique em **Atualizar campos da origem** para trazer a estrutura atual. Revise imediatamente:

- campos removidos;
- novas colunas;
- rótulos personalizados;
- blocos e filtros que apontavam para chaves alteradas;
- campos repetidos que exigem uma escolha de origem.

Se uma chave existir em mais de uma lista dinâmica, o editor pode solicitar que você escolha o caminho correto. Campos repetidos não podem ser usados como valor único sem uma redução compatível.

## Criando blocos

Na aba **Blocos**, clique em **Adicionar componente**. Os tipos disponíveis incluem:

- tabela;
- indicador ou KPI;
- gráfico de pizza;
- gráfico de barras;
- gráfico de barras compostas.

Configure título, campos, agregação, agrupamento e dimensões conforme o tipo. O layout usa uma grade de doze colunas.

### Organizando o layout

Arraste um cartão para reposicioná-lo. Dê duplo clique ou use o botão de edição para reconfigurar. Ajuste largura e altura de acordo com a importância e legibilidade.

Exemplo de composição:

1. KPI **Contratos ativos** ocupando três colunas;
2. KPI **Vencem em 90 dias** ocupando três colunas;
3. barras **Contratos por unidade** ocupando seis colunas;
4. tabela detalhada ocupando doze colunas.

Evite muitos KPIs sem contexto. Inclua pelo menos um componente que permita verificar os registros que formam o total.

## Configurando filtros globais

Na aba **Filtros e detalhe**, clique em **Novo filtro** e configure:

- **Rótulo:** texto exibido ao usuário;
- **Campo (pós-filtro):** coluna filtrada depois do retorno da origem;
- **Tipo:** texto, número, período ou seleção;
- **Parâmetro da fonte:** nome enviado à procedure ou consulta;
- **Valor padrão:** preenchimento inicial;
- **Obrigatório:** impede execução sem valor.

Filtros de seleção aceitam opções separadas, como `Obras | Saúde | Educação`.

### Campo ou parâmetro

Use **Campo** quando o conjunto retornado pode ser filtrado pela coluna. Use **Parâmetro da fonte** quando a origem deve receber o valor para limitar ou calcular o resultado.

Uma fonte pode usar ambos, mas documente o motivo. Filtros duplicados podem produzir resultados difíceis de explicar.

## Configurando o detalhe

Marque os campos mostrados no modal de detalhe e no drill-down. Lista vazia significa todos os campos.

Inclua dados necessários à conferência e omita informação que não ajuda a análise. Para contratos, um detalhe útil pode conter número, fornecedor, objeto, unidade, vigência e situação.

## Configurando o cache

Informe o tempo em segundos. O padrão é `300`, equivalente a cinco minutos. Use `0` para desativar.

Cache reduz custo e tempo de resposta, mas posterga a visualização de alterações recentes. Relatórios operacionais urgentes podem precisar de intervalo menor; relatórios consolidados podem usar intervalo maior.

## Configurando o acesso

Na aba **Acesso**, adicione regras com ação **Permitir** ou **Negar** para:

- todos os usuários;
- usuário específico;
- perfil de acesso;
- unidade organizacional.

Sem regras, somente administradores visualizam o relatório. Uma regra **Negar** aplicável vence qualquer **Permitir**.

Exemplo:

1. permitir para o perfil **Gestores de contratos**;
2. permitir para a unidade **Controle Interno**;
3. negar para um usuário afastado que ainda mantém o perfil temporariamente.

Clique em **Salvar regras**. Salvar o rascunho do relatório não substitui essa ação.

## Usando o Preview

O Preview executa o rascunho salvo com dados reais. Portanto:

1. clique em **Salvar rascunho**;
2. abra **Preview**;
3. preencha filtros;
4. compare totais com uma fonte conhecida;
5. abra detalhes e teste gráficos;
6. volte ao editor, ajuste e salve novamente.

O Preview não transforma o relatório em uma consulta disponível aos usuários.

## Salvando e publicando

### Salvar rascunho

Preserva configuração, blocos e filtros sem disponibilizar a nova versão no catálogo. Use frequentemente durante a construção.

### Publicar

Valida e congela o schema da versão publicada. Depois da publicação, o relatório aparece em **Consultas** para usuários permitidos.

Antes de publicar, confirme:

- origem correta;
- tipos e rótulos;
- filtros e parâmetros;
- totais e detalhes;
- regras de acesso;
- cache adequado;
- ausência de campos pessoais desnecessários.

### Inativar

Na lista administrativa, **Inativar** remove o relatório de Consultas e preserva sua configuração para histórico ou reativação conforme as regras do sistema.

## Exemplo completo

Para criar **Licenciamentos por situação**:

1. crie o relatório e escolha a categoria **Licenciamentos**;
2. selecione o processo de licenciamento como origem;
3. renomeie `status` para **Situação** e `createdAt` para **Solicitado em**;
4. remova campos técnicos sem uso;
5. adicione KPI de total, pizza por situação e tabela detalhada;
6. crie filtro de período e seleção de situação;
7. limite o detalhe aos dados necessários;
8. permita acesso ao perfil de fiscalização;
9. salve, execute o Preview e confira uma amostra;
10. publique e abra a consulta com um usuário representativo.

## Erros comuns

### A origem não apresenta campos

Salve o rascunho para carregar o schema. Confirme que a fonte possui escopo correto ou que o processo tem campos visíveis no relatório.

### O Preview não mostra a última alteração

Clique em **Salvar rascunho** antes de abrir ou atualizar o Preview.

### A publicação pede escolha de campo

A mesma chave foi encontrada em mais de um caminho. Escolha a origem correta no diálogo do editor.

### Um campo de lista não pode virar KPI

Valores repetidos precisam de agregação ou redução compatível. Use tabela, agrupamento ou ajuste a origem.

### O relatório foi publicado, mas ninguém o encontra

Configure e salve as regras da aba **Acesso**. Sem regra, apenas administradores veem.

### Os dados demoram a mudar

Revise o cache e a atualização do schema. Cache afeta valores; **Atualizar campos da origem** afeta a estrutura.

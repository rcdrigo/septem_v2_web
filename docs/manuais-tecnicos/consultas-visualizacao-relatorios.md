# Consultas e visualização de relatórios

**Manuais técnicos › Relatórios › Consultas e visualização de relatórios**

Este manual orienta usuários que consomem relatórios publicados para localizar informações, aplicar filtros, interpretar componentes e abrir detalhes.

> **Acesso restrito**
> A consulta exige autenticação e autorização. Um relatório publicado pode continuar invisível quando suas regras de acesso não incluem o usuário.

## O que é uma consulta

Uma consulta é a apresentação publicada de um relatório. Ela pode reunir tabelas, indicadores e gráficos sobre processos ou fontes de dados cadastradas.

Exemplos:

- pedidos de licenciamento por situação;
- contratos com vigência próxima do fim;
- tempo médio por etapa;
- quantidade de tarefas atrasadas por unidade;
- documentos emitidos em determinado período.

Os dados apresentados dependem da origem, dos filtros, do cache e das regras configuradas pelo autor do relatório.

## Localizando uma consulta

Acesse **Consultas** no menu interno. A página mostra somente relatórios publicados e autorizados.

Os relatórios são agrupados por categoria. Use as pílulas do topo para exibir:

- **Todas** as categorias;
- uma categoria específica;
- novamente **Todas** ao clicar na categoria já selecionada.

Cada cartão apresenta ícone, nome, descrição e o botão **Abrir**. O relatório abre em uma aba própria, adequada para leitura, impressão e compartilhamento do endereço com outro usuário autorizado.

## Favoritos

Clique no controle de favorito do cartão para incluir ou remover a consulta do menu lateral. Favoritar não altera permissões e não publica o relatório.

Se o limite de favoritos for alcançado, remova um item antes de adicionar outro.

## Abrindo e reconhecendo o relatório

Na aba da consulta, confira o título antes de interpretar os dados. O cabeçalho permite fechar a aba e retornar à tela anterior.

A área principal pode apresentar:

- filtros globais;
- data ou indicação da execução;
- componentes organizados em grade;
- estados de carregamento, vazio ou erro;
- ações de exportação ou impressão quando disponíveis.

## Aplicando filtros

Os filtros são definidos pelo autor e podem ser:

| Tipo | Como preencher | Exemplo |
|---|---|---|
| **Texto** | Informe parte do valor procurado. | `ambiental` |
| **Número** | Digite o valor numérico esperado. | `184` |
| **Período** | Escolha data inicial e final. | 01/01 a 31/03 |
| **Seleção** | Escolha uma opção previamente cadastrada. | Secretaria de Obras |

Filtros obrigatórios precisam ser informados antes da execução. Um valor padrão pode aparecer preenchido.

Alguns filtros são aplicados depois que a fonte retorna os dados; outros alimentam diretamente parâmetros de uma consulta ou procedure. Por isso, dois relatórios visualmente parecidos podem reagir de forma diferente.

### Exemplo

Para verificar contratos que vencem no trimestre:

1. abra a consulta **Contratos por vigência**;
2. informe o período do trimestre;
3. selecione a unidade gestora, quando o filtro existir;
4. execute ou aguarde a atualização;
5. abra o detalhe dos resultados relevantes.

## Interpretando os componentes

### Indicador ou KPI

Apresenta um valor de destaque, como total de solicitações ou média de dias. Leia o título, a agregação e os filtros ativos. Um total sem filtro pode abranger mais unidades do que o usuário imagina.

### Tabela

Mostra registros em linhas e colunas. Os rótulos podem ser diferentes dos nomes técnicos da origem. Use o detalhe para consultar campos adicionais que não cabem na grade.

### Gráfico de barras

Compara categorias ou períodos. A altura representa a métrica configurada. Barras compostas podem dividir o total por uma segunda categoria.

### Gráfico de pizza

Mostra participação proporcional. Evite concluir que uma fatia pequena representa baixo impacto sem observar o total e o período.

## Detalhe e drill-down

Clique em uma linha, indicador ou parte do gráfico quando o componente permitir detalhamento. O modal apresenta os campos escolhidos pelo autor; quando nenhum campo foi restringido, pode apresentar todos os disponíveis.

O drill-down aplica o contexto do componente. Exemplo: clicar na barra **Em análise** deve abrir registros relacionados a essa situação.

Confira se os filtros do relatório continuam visíveis e se o título do detalhe corresponde ao item selecionado.

## Atualização e cache

Consultas publicadas usam dados atuais da origem, mas podem ter cache. O padrão configurável é de cinco minutos; o autor pode definir outro intervalo ou desativá-lo.

Se uma operação acabou de ser concluída e ainda não aparece:

1. confirme que a tarefa foi realmente concluída;
2. aguarde o intervalo de cache;
3. recarregue a consulta;
4. verifique os filtros e o período;
5. comunique o responsável pelo relatório se a divergência persistir.

## Exportação, impressão e compartilhamento

Use as ações oferecidas pelo relatório. Ao imprimir, a interface remove elementos de navegação que não fazem parte do conteúdo.

O endereço pode ser compartilhado, mas quem o abrir precisará estar autenticado e autorizado. Nunca trate o link como mecanismo de concessão de acesso.

Ao exportar dados, aplique as regras de proteção e retenção do órgão. Uma planilha baixada deixa de receber as proteções e atualizações do sistema.

## Como o acesso é calculado

O relatório precisa estar publicado. Além disso, suas regras podem permitir ou negar acesso para:

- todos os usuários autenticados;
- usuário específico;
- perfil de acesso;
- unidade organizacional.

Sem regras, apenas administradores visualizam a consulta. Uma regra **Negar** aplicável prevalece sobre regras **Permitir**.

## Erros comuns

### A consulta não aparece no catálogo

Confirme publicação, categoria, modo interno e regras de acesso. Favoritar um relatório antes de perder acesso não mantém sua autorização.

### Nenhum dado foi encontrado

Remova filtros progressivamente, confira o período e confirme se a origem possui registros. Um resultado vazio não significa necessariamente falha.

### O valor parece desatualizado

Considere o cache e o momento da última operação. Reabra a consulta depois do intervalo configurado.

### O detalhe mostra menos campos que a tabela de origem

O autor pode limitar os campos de detalhe para reduzir ruído ou proteger informação.

### Outra pessoa não consegue abrir o link

O destinatário precisa de autenticação e regra de acesso própria. Solicite ajuste ao administrador em vez de compartilhar sua sessão ou exportação sem controle.

## Conferência recomendada

Antes de usar um resultado em decisão administrativa, registre:

- nome da consulta;
- data e hora;
- filtros aplicados;
- período analisado;
- unidade ou população abrangida;
- forma de exportação, quando houver.

Essas informações tornam a análise reproduzível.

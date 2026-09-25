# Filtros de tarefas e requisições

Estado: implementado e validado em 24/09/2026.

## Decisões confirmadas

- Botão de filtros alinhado à esquerda, com contador de filtros ativos; botão e chips compactos com 30 px de altura.
- Na tabela, Nº é a primeira coluna, separada de Processo.
- O pill usa a cor da categoria no ícone e no nome, com fundo da mesma cor a aproximadamente 12% de opacidade, sem semáforo. Segue a mesma regra do ícone no modal Nova requisição.
- As listagens e o título da tarefa aberta refletem nome, ícone, categoria e título da versão mais recente salva do processo, como o resumo. A execução continua vinculada ao fluxo original; tarefas ausentes na versão atual mantêm o título original.
- Popover com categorias de filtro e editor adaptado ao tipo de dado, seguindo as imagens de referência fornecidas pelo usuário.
- Alterações aplicadas automaticamente, sem botão Aplicar.
- Filtros ativos representados por chips removíveis; o chip abre a edição do respectivo filtro.
- Seleção de processos dentro do popover, permitindo selecionar mais de um processo.
- Sem visualizações salvas.
- Ampliar filtros de requisições com seleção de processos, número, datas e tags, além dos critérios existentes que continuarem aplicáveis.
- A listagem de tarefas passa a abranger somente tarefas em andamento; retirar a opção de tarefas concluídas.
- Requisições abrangem as feitas pelo usuário ou aquelas em que participou.
- Categoria Meu vínculo com opções Feitas por mim e Participei, permitindo selecionar uma ou ambas. Ambas começam selecionadas; requisições pertencentes aos dois grupos aparecem uma única vez.
- Requisições mantêm situações em andamento, concluídas e canceladas, inicialmente mostrando todas.
- Participei abrange apenas requisições nas quais o usuário concluiu pelo menos uma tarefa. Receber uma tarefa, sem concluí-la, não caracteriza participação.
- Datas em tarefas: data da requisição e data de recebimento da tarefa.
- Datas em requisições: abertura e encerramento. Um intervalo de encerramento exclui requisições ainda abertas.
- Controles de data oferecem intervalo personalizado e atalhos Hoje, Últimos 7 dias e Este mês.

## Comportamento confirmado

- Limpar filtros remove os critérios opcionais e restaura ambos os vínculos e todas as situações em requisições. Tarefas permanecem restritas às em andamento do usuário; a limpeza nunca amplia o acesso.
- Processos selecionados combinam-se por OU; categorias diferentes combinam-se por E. Tags preservam a regra vigente de exigir todas as selecionadas.
- Contador representa categorias com restrição ativa, não a quantidade de itens selecionados. Todos os processos, ambos os vínculos e todas as situações não contam como restrições.
- Cada categoria ativa possui um chip com resumo da seleção; remover o chip limpa essa categoria.
- No desktop, categorias à esquerda e editor à direita; em telas estreitas, navegação entre categorias e editor dentro do popover.
- Opções de processo e tags se adaptam aos demais critérios, preservando seleções que ficaram sem resultados, conforme as regras vigentes.

## Referências do domínio

O glossário em `CONTEXT.md` distingue processo (definição), requisição (execução individual) e tarefa de processo (etapa de trabalho). O número que identifica uma execução deve ser apresentado como número da requisição.

As regras vigentes de tags estão em `docs/requisitos-tags.md` e devem ser consideradas na ampliação dos filtros.

## Contrato de consulta

- Tarefas: `GET /api/v1/workflow/tasks?assignee=me`, com `processes` repetido para seleção múltipla. O parâmetro antigo `process` continua aceito na API.
- Requisições pessoais: `GET /api/v1/workflow/instances?scope=personal`. `relationship=requester` seleciona autoria; `relationship=participant` seleciona tarefas com `Status=concluida` e `CompletedByUserId` igual ao usuário autenticado. Ausência de `relationship` considera a união dos dois vínculos. O operador de personificação, por si só, não caracteriza esse vínculo.
- Requisições aceitam `q`, `number`, `processes` repetido, `tagNames` repetido, `requestedFrom`, `requestedTo`, `endedFrom`, `endedTo`, `status`, `sort=numero`, `dir`, `page` e `pageSize`.
- Facetas `processes` e `tagNames` são calculadas antes da paginação. Tags são expostas e aplicadas apenas no modo interno autorizado.
- Textos e números aguardam 400 ms de pausa para consultar a API; a URL e os chips são atualizados imediatamente. Os demais filtros consultam no ato.
- URLs antigas com `status=concluidas` em tarefas passam a abrir a caixa de tarefas em andamento. O histórico de tramitação da requisição é preservado.
- Limpar a última opção de Meu vínculo restaura ambos os vínculos.

## Validação

- Build do frontend e compilação da API aprovados.
- `tools/uitest/execution-filters.mjs`: aprovado em 320 × 640, 375 × 900 e 1280 × 900 px. Componentes reais com HTTP simulado, cobrindo URL, multisseleção, chips, contador por categoria, datas, vínculos, limpeza, navegação voltar, teclado e modo externo.
- `tools/uitest/execution-list-layout.mjs`: cards, tabelas e ações secundárias aprovados nas larguras 320, 375, 414, 768 e 1280 px; URLs antigas não reabrem tarefas concluídas.
- API: 34 testes aprovados, incluindo `ExecutionPresentationTests` (versão antiga, publicação e remoção de categoria/ícone), além de `ExecutionFiltersTests`, `TarefasFiltrosTests`, `ExecutionEndpointsTests` e `TagsEndpointsTests`, usando PostgreSQL 16 temporário com UTF-8. O teste legado `Usuario_externo_lista_apenas_as_proprias_instancias_mesmo_sem_filtro_mine` foi excluído dessa execução final: ele falha na preparação de acesso ao processo, problema já registrado em `docs/tags-api.md`. O novo teste de participação usa uma regra explícita de acesso e passou com usuário sem permissão administrativa.
- A execução ampla de `tools/uitest/tags.mjs` parou em `cancelar exclusão com Escape preserva editor`, antes dos cenários de filtros. Os componentes desse modal não foram alterados nesta implementação. Os filtros de tags foram exercitados pelo teste específico de filtros e pelos testes da API.
- Não foi realizada publicação. Frontend e API do repositório irmão `septem_v2` devem ser disponibilizados juntos para oferecer o novo contrato.

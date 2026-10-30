# Tarefa de regra de negócio

Estado: implementado e validado em 30/10/2026.

## Escopo confirmado

A entrega inclui o novo tipo de tarefa no modelador e sua execução no backend do repositório `septem_v2`.

As operações incluídas são:

- Cancelar processo.
- Congelar processo, colocando-o em stand-by.
- Descongelar processo, retirando-o do stand-by.
- Modificar o status de um processo finalizado.
- Modificar valor de campo do formulário.

As operações "Executar regra de negócio" e "Mudar requisitante" da imagem de referência estão fora do escopo.

A entrega também inclui ações manuais de congelar e descongelar no relatório da instância e as respectivas permissões no controle de acesso do processo.

## Comportamento confirmado

- Cada tarefa configura apenas uma operação.
- Cancelar, congelar e descongelar podem afetar a própria requisição ou outras requisições, uma ou várias.
- Alterar status afeta uma ou várias requisições já encerradas.
- Para selecionar outras requisições, seus números são obtidos de um campo do formulário da requisição atual ou de uma fonte de dados. O identificador é o número exibido ao usuário, não o UUID interno.
- O status customizado é um texto livre informado na configuração, sem cadastro ou catálogo de status. Alterar esse texto em uma requisição finalizada preserva seu encerramento.
- Congelar suspende todas as tarefas, prazos, alertas e automações da requisição. Suas tarefas ficam ocultas da caixa de entrada e não podem ser acessadas, inclusive por link direto.
- Descongelar preserva o tempo que restava nos prazos, respeitando o calendário configurado. Prazos vencidos antes do congelamento continuam vencidos.
- Uma chamada externa já disparada pode terminar após o congelamento. O fluxo suspende os passos seguintes; o congelamento não desfaz efeitos externos já realizados.
- Administradores podem congelar e descongelar pelo relatório da instância. O controle de acesso do processo permite conceder essas capacidades, além das ações existentes de editar, cancelar e excluir.
- As permissões pessoais são exigidas nas ações manuais. Tarefas automáticas seguem a configuração publicada, independentemente das permissões pessoais de quem concluiu a etapa anterior. A decisão está em `docs/adr/0009-autoridade-das-tarefas-automaticas.md`.
- A alteração de campo afeta apenas um campo da própria requisição e utiliza valor fixo. Não existe seleção de campo de outra requisição.
- Colunas de tabela do formulário estão fora desta entrega, conforme decisão confirmada durante a implementação. A alteração de valor fixo utiliza campos de agrupamentos padrão.
- Uma operação inválida interrompe o avanço com mensagem clara e desfaz as alterações daquela execução, seguindo o comportamento das tarefas de script.

## Vocabulário

O termo "Tarefa de regra de negócio" está definido em `CONTEXT.md`.
O glossário distingue a definição de um processo de sua execução individual, chamada requisição.
Os rótulos das operações acima reproduzem a referência fornecida. "Própria requisição" e "outra requisição" identificam execuções, não definições de processo.

## Detalhes confirmados

- Os alvos pertencem ao mesmo ambiente da requisição que executa a tarefa. Um campo fornece um número ou uma lista de números; uma fonte de dados fornece um número por linha na primeira coluna, seguindo a convenção dos seletores existentes.
- Números repetidos na seleção identificam um único alvo. Se o mesmo número identificar mais de uma requisição no ambiente, a operação falha por ambiguidade.
- A validação abrange todos os alvos antes de aplicar a operação. Uma falha desfaz as alterações de todo o lote na transação do banco; não existe processamento parcial silencioso nem truncamento da seleção.
- Congelar uma requisição já congelada, descongelar uma que não está congelada ou cancelar uma já cancelada não repete os efeitos da operação. Cancelar, congelar ou descongelar uma requisição concluída é inválido. Cancelar uma requisição congelada encerra a requisição sem retomar o fluxo.
- Cancelar encerra todas as tarefas e impede a criação de tarefas ou execução de passos em outros ramos daquela requisição. Cancelar a própria requisição impede o avanço após a tarefa de regra de negócio; cancelar outras permite que o fluxo de origem prossiga.
- Congelar a própria requisição preserva o ponto de continuação e suspende o avanço até o descongelamento, inclusive entre reinícios do servidor. Descongelar restaura as tarefas e retoma os passos pendentes sem repetir os já concluídos.
- O relatório da instância continua consultável durante o congelamento para permitir acompanhamento e ações autorizadas. O bloqueio de acesso abrange a execução das tarefas.
- Ações manuais de congelar e descongelar pedem justificativa, seguindo o padrão atual das ações do relatório. O histórico registra operação, alvos, data, origem manual ou automática e alterações realizadas. A origem automática identifica processo, requisição e tarefa que determinaram a ação.
- O texto customizado aparece como status da requisição, preservando internamente a distinção entre concluída e cancelada. A consulta por situação continua identificando corretamente requisições encerradas.

## Critérios de aceite

- O modelador permite criar, configurar, salvar, reabrir e publicar as cinco operações, preservando a configuração no XML BPMN.
- As fontes de seleção e as quantidades de alvos correspondem às regras confirmadas. Alterar campo não oferece seleção de outra requisição.
- O backend executa as operações e registra os efeitos nas requisições corretas, inclusive em lotes e ramos paralelos.
- Requisições congeladas não aparecem na caixa nem nos contadores de tarefas; acesso direto e tentativas de execução das tarefas são bloqueados no servidor.
- Prazos, alertas e automações não avançam durante o congelamento. O descongelamento preserva o tempo restante e o ponto de continuação.
- O relatório e as permissões do processo oferecem congelar e descongelar aos administradores e demais usuários autorizados.
- A autorização automática é independente das permissões pessoais da etapa anterior, sem dispensar a autorização nas ações manuais.
- Erros impedem efeitos parciais no banco e permitem nova tentativa após a correção. O histórico distingue ações manuais de automáticas.

## Contrato de configuração

O tipo BPMN é `bpmn:BusinessRuleTask`. A extensão `septem:BusinessRule` é serializada como `septem:businessRule`, seguindo a convenção do modelador.

| Atributo | Valores ou finalidade |
|---|---|
| `operation` | `cancel`, `freeze`, `unfreeze`, `setStatus` ou `setField` |
| `target` | `current`, `field` ou `dataSource` |
| `instanceFieldRef` | Campo da requisição atual que fornece os números dos alvos |
| `dataSourceRef` | Fonte que fornece os números dos alvos na primeira coluna |
| `statusText` | Texto do status final, com até 240 caracteres |
| `fieldRef` | Referência estável `field:<id>` do campo da própria requisição que recebe o valor fixo |
| `valueJson` | Valor fixo tipado, serializado em JSON no XML |

O painel apresenta controles de edição conforme o tipo do campo. Listas recebem um valor por linha; anexos recebem um endereço por linha e preservam o formato de anexo da execução. `setField` exige `target=current`; `setStatus` exige alvos externos já encerrados.

O seletor apresenta o caminho **Aba › Agrupamento › Campo** e a chave de resposta. Novas seleções gravam o identificador estrutural com o prefixo `field:`, preservando o vínculo após renomear a chave. Referências antigas continuam aceitas por chave ou caminho, com identificador sem prefixo como alternativa quando não existe chave correspondente. A chave de um campo não conflita com o identificador de outro.

Referências ausentes não são oferecidas como opções válidas. A validação informa a referência não encontrada e orienta selecionar novamente o campo. Um conflito real informa os campos envolvidos.

As ações manuais são `POST /api/v1/workflow/instances/{id}/freeze` e `POST /api/v1/workflow/instances/{id}/unfreeze`, com `{ "justification": "motivo" }`. As capacidades correspondentes são `freeze` e `unfreeze`.

## Persistência e disponibilização

A migração do backend é `20261030110000_BusinessRuleTasksAndStandby`. Ela acrescenta estado de congelamento, continuação, chegadas aos gateways, relógios suspensos, texto do status, configuração da tarefa e origem das ações.

A decisão sobre continuação persistida está em `docs/adr/0010-continuacao-persistida-para-congelamento.md`. Frontend e backend devem ser disponibilizados juntos, com a migração aplicada ao banco do ambiente. Nenhuma publicação ou migração em dados existentes faz parte desta implementação.

## Validação

- `npm run build` e `npm run typecheck`: aprovados.
- `tools/uitest/business-rule-modeler.mjs`: cinco operações no modelador real, configuração, validação, exportação e reimportação do XML, desfazer e refazer, permissões, digitação de listas pelo teclado e formato de anexos.
- `tools/uitest/business-rule-execution.mjs`: ações manuais, capacidades, justificativa obrigatória, status customizado e bloqueio da tarefa, em desktop e celular.
- `tools/uitest/script-task-modeler.mjs`: tarefa de script existente preservada, inclusive em React Strict Mode.
- Testes do backend executados em PostgreSQL 16 temporário, incluindo migrações em banco novo e compatibilidade do modelo EF com a migração.
- A rodada de regressão selecionada passou em 85 testes. A rodada final de regra de negócio passou em 43 testes, incluindo descongelamento recursivo e limpeza das intenções de congelamento após cancelamento, encerramento e reabertura. As rodadas têm casos em comum.
- As alterações foram aplicadas ao backend original preservando o trabalho existente. Os 31 arquivos dessa entrega foram comparados com a cópia validada; o backend de destino compilou sem erros.
- A rodada de regressão excluiu o teste legado `Usuario_externo_lista_apenas_as_proprias_instancias_mesmo_sem_filtro_mine`, cujo problema de preparação de acesso já está documentado em `docs/specs/filtros-tarefas-requisicoes.md`.
- A revisão visual confirmou a preservação da interface existente. O problema de edição de listas identificado nessa revisão foi corrigido e validado.
- A regressão de referência de campo reproduziu a rejeição de `nome` quando esse texto também era o identificador de outro campo. `tools/uitest/business-rule-field-references.mjs` verifica campos extraídos do formulário real, caminho completo, referências estáveis, XML e renomeação; `BusinessRuleFieldReferenceTests` cobre a validação do BPMN e a compatibilidade das referências antigas.
- Após corrigir a referência de campo, a suíte de regra de negócio passou em 51 testes no PostgreSQL temporário, incluindo publicação e execução por chave antiga e por identificador estável. O teste de navegador do modelador e o build do frontend também passaram.

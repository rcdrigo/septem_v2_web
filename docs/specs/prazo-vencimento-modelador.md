# Configuração de vencimento no modelador

## Escopo entregue

O modelador configura timers anexados e ações no vencimento de tarefas humanas. Os valores permanecem no XML BPMN ao salvar e reabrir o diagrama. A interface informa que o disparo automático ainda não está disponível no servidor.

Esta entrega não implementa o agendamento, a interrupção de tarefas em execução, o envio de notificações de vencimento ou a reatribuição automática. O `DeadlineSweeper` existente no backend continua responsável pelos alertas já suportados.

## Contrato BPMN

O timer é um `bpmn:BoundaryEvent` com `bpmn:TimerEventDefinition`. O atributo nativo `cancelActivity` define a interrupção. O valor `false` representa um caminho paralelo. A ausência do atributo mantém o padrão BPMN de interrupção.

A extensão `septem:BoundaryTimerConfig` contém `deadlineSource`:

| Valor | Configuração |
| --- | --- |
| `task` | Usa o vencimento da tarefa anexada. É o padrão. Exige que a ação da tarefa selecione este timer. |
| `custom` | Usa a extensão `septem:TimerConfig` do próprio evento, com os tipos e origens de valor já existentes. |

A extensão `septem:DeadlineConfig` preserva os atributos de prazo e alertas existentes e acrescenta:

| Atributo | Valores e uso |
| --- | --- |
| `overdueAction` | `record` (padrão), `timer`, `notify` ou `reassign`. |
| `overdueTimerRef` | ID BPMN do timer anexado, quando a ação é `timer`. |
| `overdueNotifyTarget` | `assignee` (padrão) ou `supervisor`, quando a ação é `notify`. |
| `overdueAreaId` | Chave da unidade organizacional de destino, quando a ação é `reassign`. |
| `overduePositionId` | Chave da posição de destino, quando a ação é `reassign`. |

A ausência dos atributos novos mantém o comportamento dos diagramas anteriores. Trocar a ação preserva os dados das outras opções para permitir a retomada da edição. Somente os atributos da ação selecionada têm efeito no contrato proposto.

## Validação no editor

Uma ação diferente de `record` exige prazo positivo ou campo de prazo. A ação `timer` exige referência a um timer da própria tarefa, configurado para usar seu vencimento. Cada timer exige uma conexão de saída. A reatribuição exige unidade e posição.

O prazo próprio exige um valor fixo ou um campo, conforme a origem selecionada. Durações fixas precisam ser positivas. Dias do mês precisam ser inteiros de 1 a 31. Remover um timer selecionado preserva a referência com indicação de ausência e gera um erro de validação.

## Verificação

`npm run test:boundary-timer` executa o build e a suíte `tools/uitest/boundary-timer.mjs`. A suíte usa React, bpmn-js e o serializador BPMN reais, com respostas HTTP controladas para os catálogos. Cobre vínculos, interrupção, desfazer e refazer, ações, reabertura do XML, remoção do timer e layout dos painéis em 1280 e 375 pixels.

O teste não comprova persistência em banco nem execução automática. O suporte no backend exige leitura dos novos atributos, validação no servidor, agendamento e testes com relógio controlado, incluindo conclusão simultânea da tarefa e congelamento da requisição.

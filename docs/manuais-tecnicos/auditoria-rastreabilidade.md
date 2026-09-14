# Auditoria e rastreabilidade

## Objetivo deste manual

Este manual orienta a consulta dos logs de auditoria para investigar alterações e comprovar quem realizou uma ação, em qual entidade, quando e a partir de qual endereço IP. O log apoia controles internos, suporte e fiscalização, mas não substitui o conteúdo oficial da requisição ou do processo administrativo.

O acesso deve ser restrito a administradores, auditores e responsáveis formalmente autorizados.

## O que a tela apresenta

Cada registro possui:

- **Quando**: data e hora do evento;
- **Ação**: operação registrada, como `create`, `update`, `delete` ou `impersonate`;
- **Entidade**: tipo do objeto afetado, por exemplo `user`, `flow` ou `org_unit`;
- **Identificador**: referência técnica abreviada da entidade;
- **Usuário**: identificador de quem realizou a ação, quando disponível;
- **IP**: endereço de origem informado ao sistema.

A listagem mostra 50 eventos por página. Use a paginação para avançar ou retornar.

## Consultando logs de auditoria

1. Acesse **Administração > Logs de auditoria**.
2. Defina o período em **De** e **Até**.
3. Informe a **Ação**, quando souber o tipo de operação.
4. Informe a **Entidade** para reduzir os resultados.
5. Leia os eventos na ordem apresentada e avance pelas páginas.
6. Registre os identificadores, horários, usuário e IP relevantes para a apuração.

Alterar qualquer filtro retorna a consulta para a primeira página.

## Como escolher os filtros

Comece pelo período mais curto que contenha o fato. Depois acrescente entidade e ação. Campos de ação e entidade usam os nomes técnicos gravados, portanto tente termos como:

| Objetivo | Ação | Entidade provável |
|---|---|---|
| criação de usuário | `create` | `user` |
| alteração de processo | `update` | `flow` |
| remoção de unidade | `delete` | `org_unit` |
| personificação | `impersonate` | conforme o evento |

Os valores dependem do evento produzido pelo backend. Se a combinação não retornar resultados, remova primeiro o filtro de entidade e confirme como o evento foi registrado.

## Roteiro de investigação

Para investigar uma alteração inesperada:

1. confirme o horário aproximado e o objeto afetado;
2. filtre o período com margem antes e depois;
3. localize eventos da entidade;
4. compare operações anteriores e posteriores;
5. identifique o usuário e o IP;
6. confira a requisição, versão do processo ou cadastro relacionado;
7. preserve as referências encontradas no registro do atendimento ou da auditoria.

Não conclua autoria apenas pelo IP. Contas compartilhadas, redes corporativas e proxies podem reduzir a precisão. A identidade da conta, o contexto e os demais registros devem ser analisados em conjunto.

## Eventos de personificação

A ação `impersonate` merece atenção especial. Ela indica uso de uma capacidade de atuar no contexto de outro usuário ou unidade. Confirme se o operador possuía autorização, qual necessidade administrativa justificou a ação e quais operações ocorreram durante o período.

## Exemplos

### Processo publicado com configuração incorreta

Filtre a entidade de fluxo e as ações de atualização no intervalo da publicação. Identifique a conta que alterou o processo e compare com o histórico de versões do modelador.

### Usuário perdeu acesso

Procure eventos do usuário e alterações em perfis. Depois confira o cadastro atual em **Usuários** e o perfil em **Perfis de acesso**.

### Unidade removida ou alterada

Filtre `org_unit` e revise operações `update` e `delete`. Se uma exclusão foi bloqueada, pode não existir evento de sucesso; consulte também mensagens e registros operacionais do atendimento.

## Limitações atuais

A tela atual oferece filtros, tabela e paginação. Ela não apresenta um painel de detalhes do evento nem exportação. O identificador da entidade aparece abreviado na tabela. Para uma apuração que exija conteúdo completo ou dados adicionais, use os mecanismos autorizados de suporte ao backend e preserve a cadeia de custódia.

O log informa ações que foram instrumentadas pelo sistema. Ausência de resultado não prova que nada ocorreu: revise filtros, período, fuso horário e cobertura do evento.

## Proteção dos registros

- conceda acesso somente a funções autorizadas;
- não copie dados pessoais para canais inadequados;
- preserve datas, identificadores e contexto;
- não altere cadastros durante a investigação sem registrar o motivo;
- use contas individuais;
- trate endereços IP e identificadores como dados de acesso restrito.

## Diagnóstico

- **nenhum evento**: remova filtros gradualmente e amplie o período;
- **data diferente do esperado**: confira fuso horário e horário do navegador;
- **usuário aparece como traço**: o evento pode ser de sistema ou não ter identidade associada;
- **identificador abreviado**: registre o valor visível e solicite consulta técnica quando necessário;
- **muitos resultados**: combine período, ação e entidade;
- **evento esperado ausente**: confirme se a operação foi concluída e se ela possui auditoria implementada.

## Checklist da apuração

- objetivo e período definidos;
- filtros utilizados registrados;
- eventos relacionados preservados;
- usuário, entidade, ação, horário e IP conferidos;
- contexto funcional comparado;
- limitações da evidência informadas;
- conclusão registrada no canal oficial.

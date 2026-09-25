# 02 — Dados, API e processamento

Contrato proposto, a alinhar com as convenções reais do backend antes da implementação. Regras normativas: [01-dominio.md](01-dominio.md).

## Modelo lógico

Todas as entidades possuem ID opaco; referências devem ser validadas no servidor. Datas de API são ISO 8601 em UTC. Entidades mutáveis têm `version` para concorrência otimista. Registros e eventos persistem autor, instante e organização; ações automáticas usam ator de sistema.

| Entidade | Campos essenciais |
| --- | --- |
| SupportTeam | id, organizationId, organizationType (septem/client), clientTenantId quando cliente, name, active |
| SupportTeamMember | teamId, userId, active; identidade do usuário deve ser resolvível entre os contextos autorizados |
| SupportTicket | id, protocol, clientTenantId, requesterId, subject, description, nature, impact, status, priority, dueAt?, teamId?, ownerId?, createdAt, updatedAt, resolvedAt?, closedAt?, canceledAt?, version |
| SupportTask | id, ticketId, title, description, assigneeId, organizationId, category (triage/requirements/development/other), status, startedAt?, completedAt?, canceledAt?, pendingWorkLog, version |
| WorkLog | id, ticketId, taskId, authorId, organizationId, category, durationMinutes, activityDescription, performedAt, createdAt, billable, billingReason, revision, correctionReason? |
| SupportMessage | id, ticketId, authorId, organizationId, visibility (public/internal), body, createdAt, revision |
| SupportAttachment | id, ticketId?, uploadOwnerId, parentType, parentId, organizationId, visibility, originalName, mediaType, sizeBytes, storageKey, createdAt, removedAt?, removedBy? |
| ApprovalRequest | id, ticketId, kind (proposal/solution), revision, description, estimatedMinutes? (proposta), scope (ticket/tasks), taskIds, status (draft/pending/approved/rejected/superseded), submittedBy, submittedAt?, decidedBy?, decidedAt?, rejectionReason? |
| ProposalWaiver | id, ticketId, reason, authorId, createdAt, contexto da proposta dispensada |
| SupportEvent | id, ticketId, type, actorId, organizationId?, visibility, occurredAt, entityType, entityId, dados mínimos da alteração |
| SupportNotification | id, recipientId, ticketId, eventId, channel, deliveryStatus, readAt?, createdAt |

WorkLog e SupportMessage possuem revisões persistidas separadamente; não sobrescrever o conteúdo anterior. Anexos vinculados a uma versão de proposta não são substituídos por revisões posteriores. Proposta e validação podem compartilhar estrutura de aprovação, mantendo tipos e regras distintos.

Respostas para requisitantes omitem tarefas internas e notas, inclusive IDs e metadados restritos. Totais públicos: `estimatedMinutes` da proposta vigente, `executedMinutes` e `billableMinutes`; ausência de proposta é `null`, não estimativa zero. Histórico de estimativas permanece nas versões.

## Regras transacionais

- Conclusão de tarefa + apontamento + evento devem ser uma única transação.
- Transferência + ajustes de tarefas + mudança de responsável devem ser uma única transação.
- Cancelamento cancela tarefas abertas e identifica apontamentos pendentes atomicamente.
- Decisão de aprovação valida versão e estado pendente na mesma transação que registra a decisão.
- Mensagem do requisitante em Resolvido/Encerrado publica conteúdo e reabre atomicamente.
- Persistir notificação pendente junto do evento de negócio (outbox ou mecanismo equivalente). Entrega externa ocorre após commit.
- Unicidade de operação impede que retries dupliquem chamado, mensagem, apontamento ou aprovação.

## Convenções HTTP propostas

Base `/api/v1/support`. Autenticação pelo mecanismo atual da aplicação. A autorização entre tenants é feita no servidor, por capacidade central explícita; filtros nunca concedem acesso.

Listagens: `cursor`, `limit` (padrão 25, máximo 100), retorno `{ items, nextCursor }`. Aplicar autorização antes da paginação. Detalhes retornam `version` e `capabilities` para orientar a interface; o servidor continua validando cada comando.

Mutação de entidade existente inclui `expectedVersion`. Criações e comandos repetíveis aceitam `Idempotency-Key`; a mesma chave e payload retornam o mesmo resultado, payload diferente retorna conflito. Erros possuem código estável, mensagem e erros por campo, alinhados ao envelope real do backend.

Respostas previstas: 400 entrada inválida; 401 sessão inválida; 403 ação não permitida sobre recurso visível; 404 recurso inexistente ou não visível; 409 versão/estado conflitante; 413 arquivo grande; 415 formato não aceito. Nunca retornar detalhes de outra empresa para explicar a negação.

## Recursos e operações

| Método e caminho | Entrada / comportamento |
| --- | --- |
| GET `/tickets` | `scope=mine/triage/team`, status, nature, priority, teamId, ownerId, query, período; escopo sempre validado |
| POST `/tickets` | subject, description, nature, impact?, attachmentIds?; retorna chamado em Aberto |
| GET `/tickets/{id}` | Detalhe filtrado, totais e capabilities |
| PATCH `/tickets/{id}/classification` | priority, dueAt, expectedVersion; triagem |
| POST `/tickets/{id}/assign` | teamId, ownerId, taskResolutions[], expectedVersion; valida transferência completa |
| POST `/tickets/{id}/transitions` | action (analyze/start/wait/resume/resolve/close/cancel/reopen), reason?, expectedVersion; aplicar tabela de estados |
| GET `/tickets/{id}/timeline` | Eventos autorizados paginados, com referências a conteúdo e versões visíveis |
| GET `/tickets/{id}/messages` | Mensagens autorizadas paginadas |
| POST `/tickets/{id}/messages` | body?, attachmentIds?, visibility; servidor determina organização |
| PATCH `/tickets/{id}/messages/{messageId}` | body, expectedRevision; somente autor, cria revisão |
| GET `/tickets/{id}/messages/{messageId}/revisions` | Histórico com a mesma autorização do original |
| GET/POST `/tickets/{id}/tasks` | Consulta interna / criação: title, description, assigneeId, category |
| PATCH `/tickets/{id}/tasks/{taskId}` | Descrição/atribuição permitida, expectedVersion; não pode simular conclusão |
| POST `/tickets/{id}/tasks/{taskId}/start` | expectedVersion; validar assignee e aprovações |
| POST `/tickets/{id}/tasks/{taskId}/complete` | activityDescription, durationMinutes, performedAt, zeroReason?, expectedVersion |
| POST `/tickets/{id}/tasks/{taskId}/cancel` | reason, expectedVersion; manter trabalho registrado |
| POST `/tickets/{id}/tasks/{taskId}/work-logs` | Apontamento residual anterior ao cancelamento, pelo autor responsável; não reabre tarefa |
| GET `/tickets/{id}/work-logs` | Atividades publicadas e totais |
| POST `/tickets/{id}/work-logs/{logId}/revisions` | durationMinutes, activityDescription, reason, expectedRevision; autor |
| GET `/tickets/{id}/work-logs/{logId}/revisions` | Histórico autorizado de correções |
| GET/POST `/tickets/{id}/approvals` | Consultar / criar rascunho de proposta ou solução: kind, description, estimatedMinutes?, attachmentIds, scope, taskIds |
| POST `/tickets/{id}/approvals/{approvalId}/submit` | expectedVersion; congelar versão e ativar bloqueio |
| POST `/tickets/{id}/approvals/{approvalId}/decide` | decision (approve/reject), reason?, expectedVersion; requisitante |
| POST `/tickets/{id}/approvals/{approvalId}/revisions` | Novo conteúdo versionado; preservar versão anterior e sua decisão |
| POST `/tickets/{id}/proposal-waivers` | reason; triagem/responsável, sem contornar aprovação já pendente |
| POST `/uploads` | multipart file, ticketId? e contexto de destino; retorna ID temporário pertencente ao autor |
| POST `/tickets/{id}/attachments` | attachmentIds; publica envio público independente, aplicando reabertura quando cabível |
| GET `/tickets/{id}/attachments/{attachmentId}/download` | Download autenticado; verificar pai e remoção |
| DELETE `/tickets/{id}/attachments/{attachmentId}` | Remoção pelo autor/admin com auditoria e revogação de conteúdo |
| GET/POST `/teams` | Consultar equipes elegíveis / criar equipe no escopo do administrador |
| PATCH `/teams/{teamId}` | Nome e ativação; impedir desativação que deixe atendimento sem responsável válido |
| PUT/DELETE `/teams/{teamId}/members/{userId}` | Adicionar/remover membro; exigir reatribuição de trabalho aberto antes de remover |
| GET `/notifications` | Notificações do usuário autenticado |
| POST `/notifications/{id}/read` | Marcar como lida, somente destinatário |

IDs filhos devem pertencer ao chamado indicado na URL. Não aceitar anexos temporários de outro autor, tenant ou contexto. Upload antes da abertura é temporário e privado; só vincular ao chamado após criação autorizada. Limpar uploads não vinculados por rotina de expiração, sem gerar evento público.

## Exemplo de conclusão

`POST /api/v1/support/tickets/{ticketId}/tasks/{taskId}/complete`

```json
{
  "expectedVersion": 3,
  "activityDescription": "Corrigida a validação do formulário e verificado o envio.",
  "durationMinutes": 95,
  "performedAt": "2026-09-13T15:00:00Z"
}
```

O servidor define autor, timestamp de registro e classificação de cobrança. O retorno inclui tarefa concluída, apontamento e totais atualizados. O cliente não fornece `billable: true` como decisão final.

## Rotinas e infraestrutura

Encerramento automático: selecionar chamados ainda Resolvidos com `resolvedAt + 30 dias <= now`. Revalidar estado/versão dentro da transação, registrar encerramento de sistema e enfileirar aviso. Retry não duplica eventos. Corrida com resposta do requisitante não pode terminar com chamado encerrado após a resposta.

Notificações: deduplicar por evento, destinatário e canal; retry de falhas transitórias e registro de falha final. Revalidar acesso antes de enviar, especialmente após transferência. Falta de e-mail não pode eliminar a notificação interna.

Arquivos: storage privado, limites no servidor e no proxy, validação antes de vinculação. Remoção invalida conteúdo imediatamente; limpeza física pode ser assíncrona. Não retornar storageKey nem URL pública permanente.

Índices propostos: chamados por cliente/requisitante/data; equipe/estado/prioridade; estado/resolvedAt; eventos por chamado/instante/id; tarefas por chamado/responsável/estado; notificações por destinatário/status. Definir limites finais de texto no contrato compartilhado; proposta inicial: assunto 200, descrição/mensagem 20.000 e justificativa 2.000 caracteres.

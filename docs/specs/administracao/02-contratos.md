# 02 — Dados, contratos e processamento

Propostas técnicas a alinhar ao backend; regras normativas em [01-dominio.md](01-dominio.md).

## Modelo lógico e localização

IDs opacos, instantes UTC e versões para concorrência. O catálogo central mantém controle e metadados; cada banco de ambiente mantém seus dados e artefatos. Conexões e segredos ficam protegidos no backend.

| Entidade | Local e campos essenciais |
| --- | --- |
| Client | Central: id, name, version |
| ClientAdminBinding | Central: clientId, identityId; vínculo ao cliente, não a um único ambiente |
| Environment | Central: id, clientId, displayName, purpose, databaseName, connectionSecretRef, logoRef, provisioningStatus, operatingMode, clientCanEditCredentials, version |
| EnvironmentDomain | Central: id, environmentId, host, kind (platform/custom), verificationStatus, tlsStatus, lastCheckedAt, safeError |
| FeatureDefinition | Central: key estável, label, implementedCapability, requiredIntegrationKinds |
| EnvironmentFeature | Central: environmentId, featureKey, enabled, version |
| CatalogProcessVersion | Central: processId, versionId, definição imutável, dependências versionadas, autor/data |
| EnvironmentArtifactVersion | Banco do ambiente: artifactId, kind, versionId, conteúdo, dependencyVersions, originCatalogId?, originVersion?, previousVersionId? |
| ProcessExecution | Banco do ambiente: id, processVersionId, dependencyVersions, status, blockedReason?, checkpoint |
| IntegrationConfiguration | Por ambiente: kind, accountOwner (septem/client), status, secretRef, version; segredo não retornado |
| ProvisioningJob / Step | Central: id, environmentId, requestKey, payloadHash, status, steps, resourceRefs, attempts, safeError, timestamps |
| TransferPlan / Job | Central: id, actor, source, destination, kind, artifactSelections, resolvedDependencies, sourceVersions, targetVersions, diff, conflicts, status, resultVersionRefs |
| AdminInvite | Central: identityId, clientId, tokenHash, expiresAt, deliveryStatus; token de uso único |
| OperationEvent | Central ou ambiente proprietário: actorId, clientId, environmentId, type, operationId, time, versionRefs, safeMetadata |

Separar status de provisionamento (`queued/running/failed/ready`), operação (`active/new_requests_blocked/inactive`), domínio e integração. Uma falha de DNS customizado não transforma ambiente pronto em falha de provisionamento. Uma integração pode estar `missing_configuration` com ambiente pronto.

## Convenções HTTP

Autorização no servidor, antes de consultar ou paginar dados. `Idempotency-Key` em comandos repetíveis: mesma chave + mesmo payload devolve mesma operação; payload diferente retorna 409. `expectedVersion` em alterações. IDs enviados no corpo nunca substituem identidade autorizada.

Jobs retornam 202 com `{ operationId, status, statusUrl }`; consultas retornam passos e erros seguros. Listagens usam `{ items, nextCursor }`. Erros: `{ code, message, fieldErrors?, operationId? }`, alinhado ao envelope real. Usar 400 para entrada inválida, 401 sessão inválida, 403 ação negada, 404 recurso não visível, 409 concorrência/estado e 422 dependências ou conteúdo inválido. Códigos distinguem `ENVIRONMENT_INACTIVE`, `NEW_REQUESTS_BLOCKED`, `FEATURE_DISABLED`, `CONFIGURATION_MISSING` e `STALE_COMPARISON`.

## Recursos propostos

| Operação | Contrato principal |
| --- | --- |
| GET/POST `/api/v1/admin/clients` | Listar/criar cliente; criação aceita primeiro admin e pedido de produção com homologação opcional, retorna clientId e operationIds por ambiente |
| GET `/api/v1/admin/clients/{id}` | Cliente, admins e ambientes autorizados |
| POST `/api/v1/admin/clients/{id}/environments` | displayName, purpose, platformHost, customHost?, logoRef, databaseName, featureKeys, catalogProcessVersionIds, seedDummyData, clientCanEditCredentials |
| PATCH `/api/v1/admin/environments/{id}` | displayName, logoRef, clientCanEditCredentials, expectedVersion; não aceita renomear base ou converter finalidade |
| PUT `/api/v1/admin/environments/{id}/features` | featureKeys habilitadas e expectedVersion; somente super admin |
| POST `/api/v1/admin/environments/{id}/mode` | mode, expectedVersion; só altera modo operacional |
| GET/POST `/api/v1/admin/environments/{id}/overdue-schedules` | Listar ocorrências / decidir occurrenceIds, action execute/discard; somente super admin |
| GET `/api/v1/admin/operations/{id}` | Progresso persistido, por etapa e ambiente |
| POST `/api/v1/admin/operations/{id}/retry` | Retomar job elegível, não reconstruir recursos concluídos |
| POST `/api/v1/admin/clients/{id}/admin-invites/resend` | identityId; reenviar convite válido ou emitir substituto revogando anterior |
| GET/POST `/api/v1/admin/environments/{id}/domains` | Consultar status / cadastrar domínio próprio único |
| POST `/api/v1/admin/environments/{id}/domains/{domainId}/verify` | Disparar verificação; confirmação depende de evidência DNS/TLS |
| GET `/api/v1/admin/features` | Catálogo de capacidades implementadas |
| GET/POST `/api/v1/admin/process-catalog` | Listar/modelar processo; super admin |
| POST `/api/v1/admin/process-catalog/{id}/versions` | Publicar versão imutável validada com dependências |
| GET `/api/v1/client/environments` | Todos os ambientes do cliente autenticado; não aceita clientId como autorização |
| GET `/api/v1/environments/{id}/artifacts` | Artefatos, versões e origem; filtrados por autorização |
| POST `/api/v1/environments/{id}/artifacts/{artifactId}/versions` | Personalização; conteúdo, dependências e expectedVersion |
| POST `/api/v1/client/transfers/compare` | kind catalog_update/promote/sync_to_staging, source, destination, artifactIds; gera plano e diff imutáveis |
| POST `/api/v1/client/transfers/{planId}/apply` | confirmOverwriteConflicts, expectedPlanVersion; revalida identidade, versões e dependências, retorna job |
| GET `/api/v1/client/transfers/{id}` | Plano/progresso/resultado, acessível apenas no escopo autorizado |
| POST `/api/v1/environments/{id}/artifacts/{artifactId}/restore` | previousVersionId, expectedVersion; publica versão recuperada sem alterar execuções existentes |
| GET/PUT `/api/v1/environments/{id}/integrations/{kind}` | Status/metadados seguros / accountOwner, configuração e replacementSecret; validar política de edição |
| GET `/api/v1/environment-status` | Resolve host atual; retorna somente branding seguro e modo necessário para login/tela de inatividade |

Cadastro de logo precisa de upload próprio autenticado, validação de formato/tamanho e referência pertencente ao cadastro; não exigir workflow fictício. Definir limites de arquivo no contrato compartilhado antes de implementar upload.

## Provisionamento durável

1. Validar autorização e entrada, reservar nomes/hosts únicos e persistir cliente/ambientes/jobs antes de executar efeitos externos.
2. Criar banco exclusivo, aplicar migrações e cadastros essenciais; registrar checkpoint e propriedade do recurso.
3. Aplicar branding, funcionalidades e cópias das versões selecionadas. Aplicar seed somente se permitido e uma única vez por versão do seed.
4. Configurar roteamento e HTTPS do subdomínio; preparar domínio próprio separadamente.
5. Preparar identidade/vínculo/convite e verificar critérios de prontidão. Marcar pronto e enfileirar entrega do convite.

Workers usam exclusão por ambiente e leases recuperáveis; uma interrupção pode ser retomada. Não executar operação concorrente de criação sobre o mesmo banco. Cada adaptador externo deve identificar recursos já criados pelo job. Não remover banco com dados como compensação automática. Produção e homologação não compartilham transação de sucesso.

## Transferência consistente

Comparar resolve recursivamente dependências, identifica ciclos/referências inválidas e fixa versões de origem/destino. Exibir dependências adicionadas ao conjunto, incluindo as compartilhadas com outros processos. Artefatos mantêm identidades lógicas entre ambientes; IDs físicos são remapeados. Referências não transferíveis são resolvidas no destino ou retornam pendência/erro explícito.

Ao aplicar, revalidar papel, cliente, modos operacionais e versões. Mudança posterior à comparação retorna 409 e exige comparar novamente, mesmo se sobrescrita havia sido aceita. Preparar novas versões imutáveis no destino e ativar o conjunto atomicamente: falha preserva versões correntes anteriores, sem publicação parcial. Persistir evento e histórico na mesma transação da ativação. Retries retornam o mesmo resultado, sem versões duplicadas.

A leitura de origem e a escrita no destino podem ocorrer em bancos diferentes; fixar versões imutáveis evita exigir transação distribuída. Segredos e dados operacionais são excluídos por allowlist de tipos transferíveis. Validar também código/configuração embutida nos artefatos conforme as regras dos modeladores existentes; uma transferência não concede novas capacidades.

## Operação e segurança de execução

Checar modo do ambiente e funcionalidades no servidor antes de iniciar novas solicitações e antes de cada efeito automático. Invalidar caches de modo/permissões e revalidar sessões existentes. Frontend consulta status ao entrar/retomar foco e trata `ENVIRONMENT_INACTIVE` globalmente, limpando dados visíveis e redirecionando para a tela de inatividade.

Checkpoint e chave de idempotência por efeito evitam repetir integrações na retomada. Resultado externo incerto precisa de reconciliação, não retry cego. Persistir decisão de ocorrências vencidas individualmente. A consulta pública de status não expõe dados de cliente além do branding necessário, credenciais, banco ou diagnósticos internos.

Segredos são write-only na API, cifrados em repouso ou armazenados em cofre, com referências no banco. Convites usam token de uso único com expiração configurada; reenvio não dá acesso a outro cliente. Auditar alterações sem payload secreto. Ações de super admin devem usar contexto central explícito, independente do login do cliente inativado.

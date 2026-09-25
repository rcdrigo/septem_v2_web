# 03 — Interface, entregas e critérios de aceite

## Interface

Área central com clientes, ambientes, catálogo de funcionalidades implementadas e modelagem de processos. Exibir cliente, finalidade e modo em todos os detalhes e confirmações. Ocultar navegação central para usuários sem papel, mantendo autorização obrigatória no backend.

Cadastro guiado: identificação e branding → produção/homologação e URLs/bancos → funcionalidades/processos → dados fictícios e integrações → primeiro admin → revisão. Mostrar separadamente as configurações dos ambientes, sugestão editável de banco, restrição de dados fictícios e permissão de substituir credenciais. Na revisão, informar quais integrações ficarão pendentes. Preservar preenchimento em falhas de validação.

Após criar, mostrar cartões independentes com etapas, erro acionável e retomada de cada ambiente. Separar “Ambiente pronto”, “Domínio próprio pendente” e “Convite não entregue”. Permitir copiar URL disponível, conferir DNS e reenviar convite sem recriar o ambiente.

Detalhe do ambiente: branding, finalidade, modo, funcionalidades, processos, integrações, domínios e histórico. Mudança de modo oferece explicitamente “Bloquear novas requisições” e “Inativar completamente”, explicando efeito nas solicitações existentes. Reativação apresenta ocorrências vencidas para decisão, sem execução automática em massa.

No cliente, oferecer seleção dos ambientes acessíveis ao admin. Usar “Serviços” como nome amigável do catálogo de processos. Para atualização, promoção ou sincronização, selecionar origem/destino e artefatos; apresentar dependências, diferenças, conflitos e itens sobrescritos. Botões “Cancelar” e “Confirmar e aplicar”; quando houver conflito, indicar explicitamente a sobrescrita. Não inserir aprovação de super admin. Exibir job, resultado e versão anterior recuperável.

Integrações mostram configurada/pendente/erro sem segredos salvos. Quando permitido, formulário de substituição de credenciais apenas para admins; caso contrário, status e contato Septem. Aviso de funcionalidade desabilitada aparece onde ela é utilizada. Tela de ambiente inativo substitui login e conteúdo autenticado, com mensagem clara e branding; nunca deixar dados anteriores visíveis atrás dela.

Reutilizar componentes e cliente HTTP existentes. Organização sugerida: `src/pages/admin/`, `src/lib/api/admin.ts` e componentes de transferência compartilhados. Chaves de cache incluem identidade, cliente e ambiente; limpar cache ao trocar contexto e na inativação. Tratar carregamento, vazio, erro, retry, 409 e sessão expirada. Manter rótulos, foco e navegação por teclado; não depender apenas de cores para estados.

## Entregas

| Entrega | Conteúdo | Dependências | Aceite |
| --- | --- | --- | --- |
| E1 — Fundação | Cliente separado de ambiente, identidade central, vínculos, autorização, modelo e auditoria | Verificar contratos atuais do backend | A01–A03 |
| E2 — Provisionamento | Cadastro, criação independente, banco, domínio, HTTPS, seed, convite e jobs | E1; adaptadores de infraestrutura configurados | A04–A10 |
| E3 — Configuração e operação | Funcionalidades, integrações, modos, pausa/retomada | E1–E2 | A11–A17 |
| E4 — Catálogo e versões | Modelagem central, replicação e personalização, execução versionada | E1–E2; motor/modeladores integrados | A18–A19 |
| E5 — Transferências | Comparação, atualização opcional, promoção, sincronização e recuperação | E3–E4 | A20–A25 |
| E6 — Integração final | Fluxo completo, concorrência, segurança, recuperação e UI | E1–E5 | A26–A28 e anteriores |

Cada entrega inclui backend, frontend e testes apropriados; mocks não substituem persistência, autorização, DNS/TLS ou processamento durável na conclusão da integração. Disponibilidade real de cada funcionalidade exige verificar sua implementação, sem tratar exemplos comerciais como prontos.

## Critérios de aceite

| ID | Cenário e resultado esperado |
| --- | --- |
| A01 | Super admin gerencia dois clientes. Admin de A acessa todos os ambientes de A, mas não área central ou recursos de B, mesmo trocando host, header ou ID. |
| A02 | Admin do cliente não cria ambiente nem altera funcionalidades via API; acesso a ambiente não concede permissões adicionais de suporte ou outros domínios. |
| A03 | Cliente possui produção e homologação com IDs/bancos distintos; eventos registram ator e ambiente correto sem segredos. |
| A04 | Cadastro válido provisiona nome exibido padrão Septem, branding, banco, funcionalidades e processos selecionados; campos inválidos falham antes dos efeitos externos. |
| A05 | Colisões de banco/host são rejeitadas sem utilizar recursos de terceiros. Renomear nome exibido funciona; mudar nome de banco após criação é rejeitado. |
| A06 | Dados fictícios são aceitos em homologação/demonstração e rejeitados em produção pela API; retry do seed não duplica registros. |
| A07 | Criação conjunta replica seleção inicial, mas não compartilha dados/credenciais. Falha de homologação mantém produção disponível e permite retomar só homologação. |
| A08 | Queda após criação do banco e dois retries simultâneos resultam em um banco e uma instalação de cada artefato, com progresso recuperado. |
| A09 | Sem HTTPS do subdomínio o ambiente não fica pronto; com subdomínio validado fica pronto mesmo aguardando DNS próprio ou integração, exibindo pendências distintas. |
| A10 | Primeiro admin recebe convite após prontidão. Falha de envio não recria banco; reenvio e aceite não duplicam vínculo, token usado/expirado não concede acesso. |
| A11 | Super admin desabilita funcionalidade dependida por processo; dados permanecem e ponto de uso mostra aviso com contato Septem. API também impede execução. |
| A12 | Etapa automática para na funcionalidade desabilitada; após resolução retoma sem pular etapa nem repetir efeito concluído. |
| A13 | Política bloqueada omite segredos e impede substituição pelo cliente; permitida aceita substituição por admin, mas nunca retorna segredo salvo. Usuário comum continua impedido. |
| A14 | Contas Septem e cliente funcionam como opções independentes da política de edição; credencial ausente mostra “Falta configurar” sem impedir prontidão geral. |
| A15 | Bloqueio de novas requisições impede aberturas via UI/API/agente/agendamento, mas permite login, consulta e continuidade das existentes. |
| A16 | Inativação substitui login por tela informativa; sessão aberta é redirecionada e chamadas diretas são negadas. Processos pausam, dados e gestão central permanecem. |
| A17 | Reativação retoma pendências sem repetir efeitos. Ocorrências vencidas não disparam sem decisão explícita e cada decisão é aplicada uma vez. |
| A18 | Processo replicado pode ser personalizado; publicar nova versão central não altera o cliente. Comparação oferece atualização opcional. |
| A19 | Execução iniciada em V1 continua com V1 e suas dependências após publicação de V2; nova execução utiliza V2. |
| A20 | Admin compara e promove artefatos selecionados com dependências sem aprovação central; outro cliente não pode ser origem/destino. |
| A21 | Sincronização produção → homologação copia definição/dependências, preserva versão anterior e não copia solicitações, execuções, usuários ou credenciais. Promoção respeita as mesmas exclusões. |
| A22 | Conflito mostra o que será sobrescrito. Cancelar deixa destino intacto; confirmar substitui apenas conjunto selecionado/dependências e preserva versão anterior. |
| A23 | Alteração após comparação retorna 409 e exige nova comparação. Aceitar conflitos não permite conteúdo inválido nem contorna autorização. |
| A24 | Falha ao aplicar dependência não publica conjunto parcial; retry não duplica versões. Recuperar versão anterior não reescreve execuções existentes. |
| A25 | Transferência mantém funcionalidades contratadas e segredos do destino intactos; dependência não mapeável gera erro ou pendência explícita antes da ativação conforme sua obrigatoriedade. |
| A26 | Cache, histórico, comparações e consultas de jobs não vazam dados ao trocar cliente/ambiente; status público não expõe banco ou diagnósticos internos. |
| A27 | Mutação concorrente recebe conflito e Idempotency-Key repetida retorna mesma operação; chave com payload diferente falha. Logs e erros não contêm segredos. |
| A28 | Fluxo integrado: cadastrar produção/homologação → convite → personalizar → promover → sincronizar → bloquear novas solicitações → inativar → reativar, com histórico e versões íntegros. |

## Verificação

Priorizar testes de integração de autorização, concorrência, migrações por ambiente, retomada de jobs, versionamento e efeitos externos com falhas controladas. Testar UI nos fluxos principais e nos estados de falha; usar ambiente de teste para evidência real de DNS, HTTPS e convite. Registrar quais adaptadores foram simulados e quais foram verificados de ponta a ponta.

Ao implementar frontend, executar `npm run typecheck` e `npm run build`; executar regressões existentes de sessão, formulários e automação se os respectivos fluxos forem alterados. Esta entrega de documentação requer revisão de cobertura, links e whitespace, não build da aplicação.

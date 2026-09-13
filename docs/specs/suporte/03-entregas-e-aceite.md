# 03 — Interface, entregas e aceite

## Interface

### Meus chamados

Substituir placeholder de Suporte mantendo acesso pelos menus existentes. Listar protocolo, assunto, natureza, estado, prioridade e atualização. Filtros por estado/natureza e busca por protocolo/assunto; paginação, carregamento, vazio e erro com retry. A consulta `mine` nunca mistura chamados de outros usuários, mesmo para quem também atende chamados.

Abertura: assunto, descrição, natureza, impacto opcional e anexos opcionais. Mostrar limite de upload, progresso e falhas por arquivo; preservar texto ao falhar. Exibir protocolo e detalhe após sucesso; impedir envio duplicado.

### Detalhe do requisitante

Cabeçalho com protocolo, estado, prioridade, prazo previsto e equipe responsável. Exibir descrição original, histórico público, mensagens, arquivos, propostas/versionamento e atividades concluídas. Mostrar horas estimadas (ou “Sem estimativa”), executadas e cobráveis.

Compositor disponível em todos os estados; informar quando o envio reabrirá um chamado. Em Cancelado, oferecer ação separada de reabertura com justificativa. Aprovar/rejeitar sempre mostra versão, conteúdo e estimativa aplicáveis; rejeição exige motivo. Oferecer confirmar encerramento em Resolvido e informar encerramento automático após 30 dias.

### Atendimento

Fila de triagem central com identificação inequívoca do cliente. Fila da equipe com filtros por responsável, prioridade e estado. Detalhe acrescenta classificação, atribuição, tarefas, propostas, validação e notas internas conforme capacidades.

Separar visualmente “Mensagem ao requisitante” e “Nota interna da organização”. Antes de concluir tarefa, mostrar que a descrição de atividade e horas ficarão visíveis ao requisitante. Exibir bloqueio de aprovação com link à solicitação correspondente.

Transferência apresenta tarefas abertas e exige destino para cada uma: concluir, cancelar ou reatribuir. Conclusão só pelo próprio participante; tarefa de outro participante deve ser cancelada ou reatribuída. Não trocar equipe parcialmente em caso de falha.

### Administração e notificações

Tela de equipes com organização, membros e estado; opções limitadas ao escopo do administrador. Notificações com estado lida/não lida e link para chamado; acesso negado após transferência deve ser tratado sem exibir conteúdo em cache.

### Integração frontend

Proposta de organização: `src/pages/support/`, `src/components/support/` e `src/lib/api/support.ts`. Reutilizar cliente HTTP, sessão, componentes e padrões de estilo existentes. Chaves React Query incluem tenant, usuário e escopo; invalidar detalhe, filas e totais após comandos. Limpar conteúdo ao trocar identidade/contexto; não usar cache global entre clientes.

Tratar 409 oferecendo recarregamento, sem sobrescrever trabalho concorrente. Não exibir sucesso antes de persistência confirmada. Validar no cliente para orientar, repetir validações no servidor. Manter navegação por teclado, rótulos, foco após diálogos e estados que não dependam apenas de cor. Formatar timestamps no fuso do usuário e permitir consultar data/hora completas.

## Plano de entregas

| Entrega | Conteúdo | Dependências | Aceite mínimo |
| --- | --- | --- | --- |
| E1 — Fundação | Identidade central, escopos, equipes, persistência, auditoria e contrato compartilhado | Backend acessível; decisão técnica de identidade Septem | A01–A03 |
| E2 — Requisitante | Abertura, listagem, detalhe, conversa e anexos privados | E1 | A04–A07 |
| E3 — Atendimento | Triagem, atribuição, tarefas, horas e transferência | E1–E2 | A08–A12 |
| E4 — Aprovações | Propostas/versionamento, dispensa, validação e bloqueios | E3 | A13–A16 |
| E5 — Ciclo completo | Cancelamento, reabertura, rotina de 30 dias e notificações | E2–E4 | A17–A21 |
| E6 — Integração final | Concorrência, regressão de sessão/menu, autorização de todos os recursos | E1–E5 | A22–A24 e todos os anteriores |

Cada entrega inclui backend, frontend correspondente e testes de integração apropriados. Não marcar entrega concluída com mocks substituindo persistência, autorização ou envio real de notificações. E1 não pode presumir que `isInternal` ou `*` representam acesso central entre tenants.

## Critérios de aceite

| ID | Cenário e resultado esperado |
| --- | --- |
| A01 | Usuário A não lista nem acessa chamado de B como requisitante; acesso direto por ID, histórico, anexo e versão também é negado. |
| A02 | Triagem central autorizada consulta chamados de dois clientes; equipe do cliente A não recebe nem consulta chamados do cliente B, mesmo alterando tenant/header/IDs. |
| A03 | Administrador de cliente só gerencia equipes do próprio escopo; condição interna de usuário não concede papel central. |
| A04 | Abertura com campos válidos gera protocolo, estado Aberto, empresa/requisitante corretos e evento com timestamp do servidor; ausência de campo obrigatório falha sem criar chamado. |
| A05 | Mensagem textual, com anexos ou apenas anexos é aceita; envio vazio é rejeitado; timeline mantém ordenação estável. |
| A06 | Arquivo no limite é aceito; acima de 25.000.000 bytes, 11 arquivos ou formato fora da allowlist são rejeitados no servidor. Upload de outro usuário não pode ser vinculado. |
| A07 | Nota/anexo interno da Septem não aparece para requisitante nem equipe do cliente, inclusive por busca, histórico, notificação e download. |
| A08 | Duas tarefas do mesmo chamado podem ser executadas simultaneamente; cada participante conclui a própria com descrição e minutos; participante distinto não conclui em seu nome. |
| A09 | Conclusão e horas são atômicas; falha não deixa tarefa concluída sem atividade. Duração negativa falha; zero exige justificativa. |
| A10 | Requisitos Septem 120 min + desenvolvimento Septem 90 + cliente 60 + triagem de encaminhamento 15 resultam em 285 executados e 210 cobráveis. Triagem resolutiva de 20 min em outro chamado resulta em 20 cobráveis. |
| A11 | Transferência sem tratar tarefa aberta falha integralmente. Transferência válida remove acesso da equipe anterior e preserva atividades e restrição de notas por organização. |
| A12 | Requisitante vê atividades concluídas e horas, sem receber payload de tarefas internas pendentes/em execução. |
| A13 | Dispensa por triagem/responsável exige motivo; outro papel não dispensa. Sem proposta, horas seguem a mesma classificação de cobrança. |
| A14 | Proposta pendente bloqueia trabalho abrangido; aceite do requisitante libera. Rejeição exige motivo, preserva versão e retorna chamado para análise. Tentativa de decidir versão superada falha. |
| A15 | Estimativa de 480 min admite execução de 600 sem aprovação complementar obrigatória. Se uma complementar for solicitada, o trabalho abrangido aguarda aceite. |
| A16 | Aceite da proposta não aprova automaticamente a solução. Validação exigida bloqueia implementação abrangida; rejeição permite ajustes e nova versão. |
| A17 | Chamado com tarefa aberta não pode ser resolvido. Após tarefas concluídas/canceladas e aprovações necessárias atendidas, resolução é aceita e requisitante pode encerrar. |
| A18 | Em Resolvido, antes de completar 30 dias não há fechamento; no limite ou depois ocorre uma única vez. Nova mensagem/anexo do requisitante reabre e impede fechamento pelo prazo antigo. |
| A19 | Cancelar interrompe tarefas e preserva horas. Autor consegue registrar trabalho anterior pendente sem retomar execução; mensagem comum não reabre Cancelado, ação explícita exige justificativa. |
| A20 | Edição de mensagem preserva versões; correção de duração de 60 para 45 contabiliza 45, não 105. Remoção de anexo impede download também pelo histórico e registra autor/instante. |
| A21 | Evento público gera avisos aos destinatários autorizados no sistema/e-mail; falha de e-mail não desfaz operação. Retry não duplica aviso e transferência não entrega nota a destinatário sem acesso. |
| A22 | Duas decisões concorrentes da mesma aprovação ou transferências com a mesma versão produzem um sucesso e um conflito; retries com idempotência não duplicam trabalho. |
| A23 | Alterar identidade/tenant limpa dados anteriores; URL direta, paginação e cache não revelam chamados sem permissão. Testar usuário com papéis simultâneos. |
| A24 | Fluxo completo: abertura → triagem → requisitos → desenvolvimento → ajustes → validação → implementação → resolução → encerramento → reabertura, com horas, arquivos e histórico íntegros. |

## Verificação de entrega

Testar autorização no backend, sem depender de botões ocultos. Usar relógio controlado nos testes do prazo e concorrência real/simulada em decisões e encerramento. Testes de UI devem cobrir os fluxos críticos e estados de erro, não repetir todos os testes de regra de negócio.

No frontend, executar `npm run typecheck` e `npm run build` quando houver implementação. Executar testes de sessão/navegação existentes se a integração alterar esses fluxos. Registrar evidência de testes do backend, armazenamento privado, processamento de notificações e encerramento automático. A escrita destas specs não demanda executar build nem testes de aplicação.

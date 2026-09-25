# 01 — Domínio, regras e permissões

## SUP-01 — Abertura e consulta

Qualquer usuário autenticado pode abrir um chamado no contexto de sua empresa. Assunto, descrição e natureza são obrigatórios; anexos são opcionais. Naturezas: `bug` (Erro / Bug), `improvement` (Melhoria), `feature` (Nova funcionalidade), `question` (Suporte / Dúvida).

Gerar identificador e protocolo legível no servidor, registrar requisitante e empresa pela sessão e encaminhar à triagem central em Aberto. Não aceitar identidade/empresa arbitrária no corpo da abertura. Requisitantes listam e consultam somente os próprios chamados, inclusive encerrados e cancelados.

## SUP-02 — Permissões e isolamento

| Papel | Alcance e ações |
| --- | --- |
| Requisitante | Próprios chamados: abrir, consultar conteúdo público, enviar mensagens/anexos, aprovar/rejeitar, confirmar encerramento, cancelar e reabrir |
| Triagem central Septem | Fila entre clientes: analisar, priorizar, definir prazo, equipe e responsável, distribuir tarefas, dispensar proposta com motivo |
| Membro da equipe destinatária | Chamados da equipe: acompanhar atendimento, publicar mensagens/notas, trabalhar e concluir suas tarefas |
| Responsável pelo chamado | Gerenciar encaminhamento, responsáveis e tarefas; proposta, dispensa, validação da solução e resolução |
| Administrador | Gerenciar equipes/membros no escopo autorizado e remover anexos de chamados aos quais tenha acesso |

Papéis acumulam capacidades, mas cada capacidade continua limitada por empresa, equipe e visibilidade. Administrador de cliente não ganha acesso global nem consulta automática aos chamados de outros requisitantes. Equipe do cliente só atende chamados da própria empresa. A triagem central requer autorização explícita do backend; trocar `X-Tenant` ou possuir `isInternal` não basta.

Notas internas e anexos associados só são retornados a atendentes autorizados pertencentes à organização autora. O papel de requisitante não concede leitura de notas. Não expor conteúdo restrito em contagens, buscas, versões anteriores, notificações ou URLs de download.

## SUP-03 — Ciclo de vida

| Origem | Ação / destino | Condição |
| --- | --- | --- |
| Aberto | Iniciar análise → Em análise | Triagem |
| Em análise | Iniciar atendimento → Em execução | Equipe e responsável definidos; trabalho não bloqueado por aprovação |
| Em análise / Em execução | Solicitar retorno → Aguardando requisitante | Registrar motivo; pode ser dúvida, proposta ou validação |
| Aguardando requisitante | Retomar → Em análise ou Em execução | Registrar retorno; aprovação ainda pendente mantém bloqueio do trabalho abrangido |
| Estados ativos | Marcar resolvido → Resolvido | Responsável; todas as tarefas concluídas/canceladas, sem aprovação necessária pendente ou rejeitada |
| Resolvido | Confirmar → Encerrado | Requisitante |
| Resolvido | Encerrar automaticamente → Encerrado | 30 dias corridos sem resposta desde a resolução |
| Resolvido / Encerrado | Nova mensagem/anexo público do requisitante → Em análise | Reabrir e registrar evento, sem apagar resolução anterior |
| Estados ativos / Resolvido | Cancelar → Cancelado | Requisitante informa motivo |
| Cancelado | Reabrir explicitamente → Em análise | Requisitante informa justificativa |

Estados ativos: Aberto, Em análise, Em execução, Aguardando requisitante. Rejeição de proposta/solução retorna para Em análise. Mensagens continuam permitidas em todos os estados; mensagem em Cancelado não reabre. Encerrado pode ser reaberto antes de eventual cancelamento.

Estado do chamado não representa cada tarefa. Tarefas independentes podem continuar durante uma espera por aprovação; as abrangidas permanecem bloqueadas. Retomar atendimento não equivale a aprovar proposta.

Cada mudança registra autor, instante, origem, destino e motivo quando exigido. Reabertura invalida o prazo anterior de encerramento automático; nova resolução inicia novo prazo. Considerar 30 períodos de 24 horas a partir do instante de resolução, persistido em UTC.

## SUP-04 — Equipes, tarefas e transferência

Equipes pertencem à Septem ou a uma empresa cliente. Administradores gerenciam membros dentro de seu escopo. Toda tarefa tem descrição, responsável, estado e vínculo ao chamado; tarefas podem ocorrer simultaneamente. Estados propostos: Pendente, Em execução, Concluída, Cancelada.

Triagem e responsável criam, atribuem e cancelam tarefas. O responsável da tarefa deve integrar a equipe destinatária. A conclusão é feita pelo próprio participante e exige descrição do trabalho realizado e duração. Transferir chamado exige escolher equipe/responsável válidos e concluir, cancelar ou reatribuir tarefas abertas da equipe anterior. A transferência inteira é atômica: falha em qualquer tarefa mantém a atribuição anterior.

A equipe anterior perde acesso operacional, sem apagar autoria ou atividades. Mensagens públicas e atividades acompanham o chamado; notas internas continuam vinculadas à organização de origem. Uma nota da Septem não fica disponível à equipe do cliente, nem o inverso.

## SUP-05 — Propostas e validação

A proposta contém texto da solução, anexos opcionais e estimativa de horas. Triagem ou responsável podem dispensar a etapa com motivo registrado. Quando submetida, apenas o requisitante aprova/rejeita. Rejeição exige justificativa. Cada submissão é uma versão imutável com autor e data; decisão referencia a versão exata.

Uma revisão substitui a versão pendente anterior, preservando-a como superada; tentativa de aprovar versão superada falha. Proposta revisada exige novo aceite, salvo dispensa registrada antes de nova submissão. Estimativa pode ser excedida: aprovação complementar é possível, não obrigatória. Quando solicitada, aguardar aprovação para o trabalho abrangido.

Validação da solução é uma aprovação separada, exigida quando o responsável indicar. Contém descrição, anexos, versão e decisão; bloqueia as tarefas de implementação abrangidas até aceite. Rejeição permite novas tarefas de ajuste e nova versão. Não confundir validação da solução com confirmação final de encerramento.

Uma solicitação identifica as tarefas abrangidas; se abranger todo o chamado, tarefas futuras também respeitam o bloqueio. Aprovação não pode ser inferida de uma mensagem comum ou do decurso de prazo.

## SUP-06 — Horas e cancelamento

Armazenar duração em minutos inteiros e exibir em horas/minutos. Valores negativos são inválidos; conclusão sem tempo gasto exige zero explícito e justificativa. Totais são calculados sobre a versão vigente de cada registro, sem duplicar versões anteriores.

| Organização / atividade | Cobrável |
| --- | --- |
| Cliente, qualquer atividade | Não |
| Septem, requisitos ou desenvolvimento | Sim |
| Septem, triagem que resolve o chamado | Sim |
| Septem, triagem apenas de encaminhamento | Não |
| Outras categorias | Não |

Registrar categoria e organização da atividade no momento do trabalho; alteração posterior de equipe não reclassifica o histórico. Proposta dispensada não altera a regra. Estimativa não limita o total executado. Não há tarifas nem valores monetários.

Cancelamento interrompe tarefas abertas e preserva horas cobráveis já executadas. Para não depender da presença de todos os participantes, criar pendência de apontamento para tarefas em execução e permitir ao autor registrar trabalho anterior ao cancelamento. Esse registro não retoma execução. O requisitante vê os apontamentos publicados e totais atualizados.

## SUP-07 — Conversa, arquivos e auditoria

Todo envio possui autor e timestamp atribuído pelo servidor. Ordenar histórico por instante e identificador estável. Mensagens podem conter somente texto, somente anexos ou ambos; envio vazio é inválido. Separar explicitamente mensagem pública de nota interna. Registros de atividade concluída e horas são públicos ao requisitante; tarefas em preparação/execução são internas.

Correções pelo autor preservam versões anteriores. Ajustes de horas exigem motivo. Remoção de anexo pelo autor ou administrador preserva metadados de auditoria e revoga download do conteúdo, inclusive em versões anteriores. Não implementar exclusão definitiva de chamados ou eventos pela interface.

Até 10 arquivos por envio, cada arquivo até 25 MB. Proposta técnica para precisão: 25.000.000 bytes. Categorias autorizadas: imagens, PDF, documentos, planilhas, TXT, ZIP e MP4. Allowlist inicial proposta: jpg/jpeg/png/gif/webp, pdf, doc/docx/odt, xls/xlsx/ods/csv, txt, zip, mp4. Validar extensão, tipo e tamanho no servidor; não extrair ZIP nem executar conteúdo. Download sempre autorizado pelo chamado e pela visibilidade do item pai.

## SUP-08 — Prioridade e comunicação

Prioridades: Baixa, Normal, Alta, Crítica; Normal é o padrão técnico proposto. Requisitante informa impacto, triagem define prioridade e prazo previsto opcional. Não implementar SLA automático.

Notificar no sistema e por e-mail: nova mensagem pública, encaminhamento, solicitação/decisão de aprovação, resolução, encerramento e reabertura. Na abertura, notificar a triagem; no encaminhamento, a equipe destinatária e responsável. Requisitante recebe mudanças públicas; notas internas só notificam atendentes autorizados da organização autora. Não notificar o autor sobre sua própria ação.

Falha no e-mail não desfaz ação de negócio. Reenvios devem evitar duplicação. Revalidar autorização antes de entregar conteúdo; mensagens de e-mail devem preferir referência ao chamado e link autenticado, sem anexos internos ou conteúdo sensível embutido.

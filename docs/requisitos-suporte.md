# Módulo de suporte

Status: levantamento consolidado, aguardando confirmação do entendimento pelo usuário antes da implementação.

Especificações para desenvolvimento: [docs/specs/suporte](specs/suporte/README.md). O pacote detalha regras, contratos propostos e critérios de aceite sem implementar o módulo.

## Requisitos confirmados

- Qualquer usuário pode abrir um chamado com assunto, descrição, natureza e anexos.
- Naturezas: Erro / Bug, Melhoria, Nova funcionalidade, Suporte / Dúvida.
- Todo chamado é encaminhado à triagem, que pode destiná-lo a uma equipe interna do cliente ou da Septem.
- O requisitante acompanha apenas seus próprios chamados, incluindo andamento e histórico.
- O requisitante pode enviar mensagens e anexos a qualquer momento. Todo conteúdo enviado deve possuir timestamp associado.
- Fluxo aceito: Aberto → Em análise → Em execução → Aguardando requisitante → Resolvido → Encerrado, com alternância entre execução e espera.
- A equipe marca como resolvido; o requisitante confirma o encerramento. Resposta posterior reabre o chamado e registra o evento no histórico.
- A etapa de proposta e aprovação pode ser dispensada tanto pela triagem quanto pelo responsável pelo chamado, registrando o motivo. Quando utilizada, a proposta é submetida ao requisitante.
- A aprovação da proposta e estimativa é distinta da validação da solução antes da implementação em produção, quando aplicável.
- A cobrança é pelas horas executadas, que podem ser maiores ou menores que a estimativa. É possível solicitar nova aprovação ao exceder a estimativa, mas isso não é obrigatório.
- O módulo controla apenas horas, sem calcular valores monetários.
- São cobráveis apenas horas da equipe da Septem de requisitos ou desenvolvimento; horas da triagem da Septem são cobráveis apenas quando a própria triagem resolve o chamado. A regra permanece com ou sem proposta. Horas da equipe do cliente não compõem a cobrança da Septem.
- O cliente pode visualizar a proposta, as horas estimadas e as executadas.
- Várias pessoas podem atender um chamado. Ao concluir sua tarefa, cada participante informa horas gastas e descrição da atividade realizada.
- A triagem é central da Septem. A equipe destinatária acessa o chamado; equipes do cliente acessam apenas chamados da própria empresa.
- A restrição aos próprios chamados aplica-se ao papel de requisitante.
- Tarefas são criadas conforme a necessidade e podem ocorrer simultaneamente. Cada tarefa possui responsável, descrição e conclusão com horas gastas. O chamado possui um responsável geral.
- Notas e anexos internos são separados das mensagens públicas. Registros de atividade e suas horas ficam visíveis ao requisitante, com indicação clara para a equipe de que serão publicados ao cliente.
- Na transferência, a equipe anterior perde acesso operacional, preservando autoria e histórico. Notas e anexos internos ficam restritos à organização de origem; mensagens públicas e atividades acompanham o chamado.
- O requisitante pode rejeitar proposta ou solução com justificativa e solicitar ajustes. Cada versão e decisão é preservada; a rejeição retorna o chamado para análise. Proposta revisada exige novo aceite, salvo dispensa registrada.
- Prioridades: Baixa, Normal, Alta e Crítica, definidas pela triagem a partir do impacto informado pelo requisitante. Prazo previsto opcional; prazos contratuais automáticos ficam para etapa posterior.
- Notificações no sistema e por e-mail para o requisitante e responsáveis envolvidos sobre mensagens, encaminhamentos, pedidos de aprovação e resolução, respeitando a visibilidade do conteúdo.
- Administradores cadastram equipes e seus membros. Triagem e responsável pelo chamado gerenciam encaminhamentos, responsável e tarefas. Cada participante conclui suas próprias tarefas.
- Transferências exigem conclusão, cancelamento ou reatribuição de tarefas abertas da equipe anterior, preservando o trabalho registrado.
- A validação da solução antes da implementação é exigida quando o responsável sinaliza essa necessidade.
- O chamado só pode ser marcado como resolvido quando todas as tarefas estiverem concluídas ou canceladas.
- O requisitante pode cancelar o chamado com motivo. O cancelamento interrompe tarefas abertas, exige registro do trabalho já realizado e preserva a regra de cobrança das horas. Chamados cancelados só reabrem por ação explícita do requisitante com justificativa; uma mensagem isolada não os reabre.
- O histórico deve ser preservado: mensagens corrigidas mantêm versões anteriores; ajustes de horas exigem justificativa e registram autor e data. Correções são feitas pelo autor. Anexos podem ser removidos pelo autor ou administrador, deixando registro de quem removeu e quando, sem manter o arquivo disponível. O histórico respeita as mesmas restrições de acesso do conteúdo original.
- Chamados resolvidos são encerrados automaticamente após 30 dias corridos sem resposta do requisitante, com aviso e possibilidade de reabertura por nova mensagem.
- Quando uma aprovação inicial ou complementar é solicitada, o trabalho abrangido deve aguardar aprovação. Solicitar aprovação complementar por aumento de horas continua sendo opcional; uma vez solicitada, deve-se aguardar a resposta.
- Anexos permitidos: imagens, PDF, documentos, planilhas, TXT, ZIP e vídeos MP4, até 25 MB por arquivo e 10 arquivos por envio.
- O requisitante vê andamento geral, mensagens públicas, propostas e atividades concluídas com suas horas. Tarefas em preparação ou execução ficam visíveis apenas à equipe de atendimento.
- Exemplo de percurso apresentado pelo usuário: requisição → triagem → analista de requisitos → desenvolvedor → analista de requisitos → desenvolvedor → solução → aprovação → implementação → conclusão.

## Confirmação final

As rodadas de levantamento foram concluídas. A implementação depende da confirmação do usuário sobre este entendimento consolidado.

## Contexto técnico verificado

- O frontend já exibe Suporte nos menus interno e externo; a rota ainda é um placeholder.
- A sessão existente é vinculada a um tenant e possui permissões e distinção de usuários internos/externos. Isso ainda não define acesso central da Septem entre clientes.
- O upload existente é específico de workflow; sua reutilização para suporte precisa ser avaliada.

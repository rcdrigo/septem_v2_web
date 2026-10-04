# 01 — Domínio, regras e permissões

## ADM-01 — Cliente, ambiente e acesso

Um cliente possui ambientes independentes; seu cadastro inicial sempre cria produção e homologação. Nome do cliente é identificação central da organização; o ambiente apresenta nome e descrição do sistema, cor principal, logo e imagem de destaque. Nome do sistema é diferente da finalidade e do nome físico do banco. Os padrões vêm de appsettings, sem fixar outro padrão na documentação.

| Papel | Alcance |
| --- | --- |
| Super admin interno | Área central; todos os clientes e ambientes; criar ambientes, configurar funcionalidades, credenciais e modos de operação; modelar catálogo |
| Admin do cliente | Todos os ambientes do próprio cliente; administração da aplicação, personalização, atualização opcional e transferência de artefatos; substituir credenciais somente se permitido |
| Demais usuários | Permissões existentes da aplicação; nenhuma permissão administrativa nova implícita |

A área central é exclusiva de super admins. Alterar headers, URLs ou IDs não concede acesso. Validar identidade, papel e vínculo ao cliente no servidor, inclusive em histórico, comparações, jobs e versões anteriores. Acesso do admin a ambientes não revoga restrições específicas de outros domínios, como visibilidade de chamados de suporte.

## ADM-02 — Cadastro e criação conjunta

O cadastro tem três passos definidos em [04-cadastro-simplificado.md](04-cadastro-simplificado.md): cliente e identidade, parametrização do sistema e revisão. Entre os campos de identidade, somente nome do cliente é obrigatório; não permitir dois clientes com o mesmo nome. Criar sempre produção e homologação; remover escolha de finalidade, banco manual, seleção de processos, dados fictícios e preenchimento manual de provedores. Funcionalidades existentes começam todas marcadas. Três permissões independentes de e-mail, armazenamento e IA começam desmarcadas.

Gerar os bancos automaticamente pelo snake_case do nome do cliente, removendo acentos: `nome_do_cliente` em produção e `nome_do_cliente_hml` em homologação, sem edição manual e com nomes imutáveis após criação. Validar unicidade do nome do cliente e de ambos os bancos antes do provisionamento; rejeitar colisão mesmo com nomes de clientes diferentes, informar o conflito e não acrescentar identificadores automaticamente. Garantir unicidade das reservas no servidor sob concorrência. Validar nomes e hosts sem interpolá-los em comandos. Colisão não autoriza reaproveitar recurso de outro ambiente.

Homologação e produção recebem as mesmas escolhas iniciais de identidade, funcionalidades e permissões, preservando configuração própria por ambiente e bancos/dados separados. Instalar somente cadastros essenciais, sem dados fictícios nem processos do catálogo nesse fluxo. Produção não é obtida convertendo outro ambiente.

Administração inicial pela Septem começa marcada e significa somente não criar administrador do cliente. Desmarcar exige nome/e-mail e convite para concluir o cadastro. Quando existir, a identidade administrativa tem alcance nos dois ambientes, sem duplicação de vínculos ou convites em retries. Enviar o convite quando produção estiver pronta, sem aguardar homologação. Se homologação falhar, manter produção disponível, apresentar conclusão parcial e permitir retomar somente homologação.

Estado e município começam vazios e são editados somente nos ambientes, junto do horário de funcionamento. Administradores autorizados do cliente sempre podem editar horário, nome e descrição do sistema, cor principal, logo e imagem; a política de integrações não restringe esses campos. Processos somente podem ser iniciados após configurar estado, município, fuso e pelo menos um período válido de funcionamento; mostrar aviso e validar no servidor. Depois da configuração inicial, rejeitar alterações incompletas, preservando a última configuração válida, processos em andamento e vencimentos já calculados.

## ADM-03 — Provisionamento e prontidão

Executar em segundo plano, persistindo etapas, progresso e erros. Repetir uma tentativa deve reutilizar os recursos pertencentes à mesma operação e não duplicar bancos, seeds, processos ou convites.

Pronto exige subdomínio acessível por HTTPS, base preparada, branding aplicado e funcionalidades configuradas; convite disponível somente quando um administrador foi indicado. Não exigir processos selecionados no cadastro simplificado. Falha de e-mail permite reenvio independente sem recriar o ambiente. Integrações podem apresentar pendências distintas. Prontidão técnica permite acesso para configuração, mas não autoriza iniciar processos com calendário incompleto. Conclusão do cadastro exige os dois ambientes prontos; produção pode ser utilizada durante falha parcial de homologação.

Sugerir subdomínio de produção a partir do cliente e permitir edição; homologação deriva dele com prefixo `hml-`. Verificar e reservar os dois hosts antes do provisionamento. Domínio próprio é adicional: apresentar instruções de DNS, verificar vínculo ao ambiente e HTTPS. Aguardar domínio próprio não impede prontidão pelo subdomínio. Não declarar sucesso de DNS ou certificado apenas porque a configuração foi solicitada.

## ADM-04 — Funcionalidades e integrações

Catálogo de funcionalidades representa capacidades implementadas, como modelos de documentos, assinatura eletrônica, dashboards e agentes de IA. Somente super admins concedem/revogam disponibilidade por ambiente; novas capacidades requerem desenvolvimento. Funcionalidades existentes começam marcadas nos novos cadastros; novas funcionalidades não são concedidas automaticamente aos clientes existentes.

Desabilitação é permitida mesmo com processos dependentes e preserva dados. No ponto de uso, mostrar: “Esta funcionalidade foi desabilitada. Entre em contato com a Septem para resolução.” O backend também impede sua execução. Uma etapa automática para no ponto afetado, registra motivo e pode ser retomada após resolução, sem pular etapas nem repetir efeitos concluídos.

Contas da Septem são o padrão; contas próprias do cliente são substituições opcionais quando autorizadas. Titularidade e custo são independentes da permissão de edição. Quando permitido, admins do cliente podem substituir segredos sem ler valores já salvos. Quando proibido, ocultar a aba e negar edição pela API. Revogação preserva a configuração ativa; retornar ao serviço da Septem exige ação explícita. Configuração ausente pode gerar aviso operacional “Falta configurar”, sem expor segredos. Segredos não integram transferências, logs, comparações ou versões de artefatos.

Aplicar os valores iniciais de appsettings na criação e preservá-los por ambiente: novos padrões afetam somente novos clientes. Recursos isolados dos provedores são provisionados automaticamente conforme o [ADR 0007](../../adr/0007-integracoes-isoladas-com-padroes-iniciais.md).

A política de segurança é fixa e não editável em nenhuma das áreas. O segundo fator é obrigatório para todos os usuários autenticados, incluindo externos e administradores das duas áreas, e usa o SMTP configurado no ambiente. Validar SMTP candidato antes da ativação, mantendo o anterior em falhas; indisponibilidade posterior exige correção pela Septem sem desativar MFA. Confiar no dispositivo após MFA bem-sucedido dispensa novos desafios por um mês; simples uso não renova o prazo. Após expirar, exigir nova autenticação com MFA na próxima ação autenticada, inclusive com sessão ainda aberta.

## ADM-05 — Catálogo e processos do ambiente

Serviço é o nome amigável de processo, não uma entidade separada. Super admins modelam processos no catálogo central; o cadastro simplificado não seleciona nem replica processos. Fluxos posteriores de instalação e atualização continuam distintos do cadastro. O cliente pode personalizar processos disponíveis conforme as permissões da aplicação.

Alterações no catálogo não modificam cópias automaticamente. Oferecer comparação e atualização opcional. Preservar identificação da origem e das versões para identificar mudanças; catálogo e cópia não compartilham registros mutáveis.

## ADM-06 — Promoção, sincronização e conflitos

Promoção leva artefatos selecionados de homologação para produção: processos, formulários, modelos de documentos, dashboards, configurações de agentes e outras configurações compatíveis, incluindo dependências. Sincronização inversa leva definição de processo e dependências de produção para homologação. Ambas ficam restritas ao mesmo cliente.

Excluir dados de teste, solicitações reais, execuções, usuários, senhas e credenciais. Nunca alterar habilitação de funcionalidades por transferência. Referências específicas do ambiente precisam de mapeamento ou indicação de configuração pendente; não copiar IDs de usuários e segredos como se fossem artefatos.

Admin do cliente compara e confirma; não há aprovação do super admin. Mostrar itens incluídos, dependências, diferenças e conflitos. Confirmar conflitos permite sobrescrever no destino os itens selecionados e dependências a partir da origem, preservando a versão anterior para recuperação. Cancelar mantém destino intacto. Conteúdo inválido ou comparação desatualizada exige correção/nova comparação, não é dispensado pelo aceite de sobrescrita.

Cada execução permanece na versão em que começou, incluindo dependências versionadas necessárias à execução. Novas versões valem para novas execuções. Recuperação de uma versão anterior altera a versão para novas execuções; não reescreve histórico nem migra execuções existentes.

## ADM-07 — Modos de operação

| Modo | Acesso cliente | Novas solicitações de serviços | Solicitações existentes |
| --- | --- | --- | --- |
| Ativo | Normal | Permitidas conforme permissões | Continuam |
| Novas requisições bloqueadas | Login e consulta permitidos | Bloqueadas em UI, API, agentes e agendamentos | Continuam, inclusive suas tarefas |
| Inativo | Bloqueado | Bloqueadas | Processos e automações pausados |

Somente super admins alteram o modo. Inativo apresenta tela própria no lugar do login; usuários logados são redirecionados. O servidor bloqueia chamadas de sessões existentes independentemente do redirecionamento. Preservar dados e acesso de gestão dos super admins.

Ao reativar, retomar pendências sem repetir ações concluídas. Agendamentos vencidos aguardam decisão explícita de executar ou descartar ocorrências, com registro da escolha. Não disparar automaticamente todo o atraso. Diferenciar criação de uma nova solicitação de continuidade de uma solicitação existente.

## ADM-08 — Rastreabilidade e consistência

Registrar autor, cliente, ambiente, horário, operação, versões e resultado de provisionamento, mudança de funcionalidades, credenciais (somente metadados), transferências e modos de operação. Falhas apresentam motivo acionável sem expor segredos ou dados de outro cliente. Recuperação deve preservar histórico. Exclusão definitiva de ambiente fica fora desta versão.

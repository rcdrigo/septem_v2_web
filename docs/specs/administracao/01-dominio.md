# 01 — Domínio, regras e permissões

## ADM-01 — Cliente, ambiente e acesso

Um cliente possui um ou mais ambientes independentes: produção, homologação ou demonstração. Nome exibido (Septem por padrão, SGI ou outro) é diferente da finalidade e do nome físico do banco. Logo e URL pertencem à configuração do ambiente.

| Papel | Alcance |
| --- | --- |
| Super admin interno | Área central; todos os clientes e ambientes; criar ambientes, configurar funcionalidades, credenciais e modos de operação; modelar catálogo |
| Admin do cliente | Todos os ambientes do próprio cliente; administração da aplicação, personalização, atualização opcional e transferência de artefatos; substituir credenciais somente se permitido |
| Demais usuários | Permissões existentes da aplicação; nenhuma permissão administrativa nova implícita |

A área central é exclusiva de super admins. Alterar headers, URLs ou IDs não concede acesso. Validar identidade, papel e vínculo ao cliente no servidor, inclusive em histórico, comparações, jobs e versões anteriores. Acesso do admin a ambientes não revoga restrições específicas de outros domínios, como visibilidade de chamados de suporte.

## ADM-02 — Cadastro e criação conjunta

O cadastro informa nome do cliente, nome exibido, finalidade, subdomínio, domínio próprio opcional, logo, nome do banco, funcionalidades, processos do catálogo, política de edição de credenciais e nome/e-mail do primeiro admin. Produção pode ser acompanhada de homologação no mesmo cadastro.

Sugerir nome de banco a partir de cliente e finalidade, com unicidade garantida pelo servidor. Permitir edição antes da criação; depois o nome é imutável. Validar nomes e hosts sem interpolá-los em comandos. Nome exibido continua editável. Colisão de banco ou domínio não autoriza reaproveitar recurso de outro ambiente.

Homologação nasce com as mesmas funcionalidades e processos selecionados para produção, mas banco, URL, dados e credenciais separados. Dados fictícios são opcionais em homologação/demonstração e proibidos em produção, inclusive pela API. Cadastros essenciais são distintos de dados fictícios. Produção não é obtida convertendo outro ambiente.

Criação conjunta gera operações independentes. Sucesso de um ambiente não é revertido pela falha do outro. A identidade inicial do admin deve ter alcance nos ambientes do cliente sem gerar usuários ou convites duplicados a cada retry.

## ADM-03 — Provisionamento e prontidão

Executar em segundo plano, persistindo etapas, progresso e erros. Repetir uma tentativa deve reutilizar os recursos pertencentes à mesma operação e não duplicar bancos, seeds, processos ou convites.

Pronto exige subdomínio acessível por HTTPS, base preparada, branding aplicado, funcionalidades configuradas, processos selecionados instalados e convite disponível. Enviar o convite automaticamente após a verificação; falha de e-mail permite reenvio independente. Integrações sem credenciais podem permanecer pendentes, com aviso explícito.

Todo ambiente recebe subdomínio da plataforma. Domínio próprio é adicional: apresentar instruções de DNS, verificar vínculo ao ambiente e HTTPS. Aguardar domínio próprio não impede prontidão pelo subdomínio. Não declarar sucesso de DNS ou certificado apenas porque a configuração foi solicitada.

## ADM-04 — Funcionalidades e integrações

Catálogo de funcionalidades representa capacidades implementadas, como modelos de documentos, assinatura eletrônica, dashboards e agentes de IA. Somente super admins concedem/revogam disponibilidade por ambiente; novas capacidades requerem desenvolvimento.

Desabilitação é permitida mesmo com processos dependentes e preserva dados. No ponto de uso, mostrar: “Esta funcionalidade foi desabilitada. Entre em contato com a Septem para resolução.” O backend também impede sua execução. Uma etapa automática para no ponto afetado, registra motivo e pode ser retomada após resolução, sem pular etapas nem repetir efeitos concluídos.

Contas de integração podem ser da Septem ou do cliente, configuradas por ambiente. Isso não determina quem pode editar credenciais. Quando permitido, admins do cliente podem substituir segredos sem ler valores já salvos. Quando proibido, o cliente recebe apenas status e orientação de contato, nunca os segredos. Configuração ausente aparece como “Falta configurar”. Segredos não integram transferências, logs, comparações ou versões de artefatos.

## ADM-05 — Catálogo e processos do ambiente

Serviço é o nome amigável de processo, não uma entidade separada. Super admins modelam processos no catálogo central; a criação replica as versões selecionadas para o ambiente. O cliente pode personalizá-las conforme as permissões da aplicação.

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

# Administração de clientes e ambientes

Escopo consolidado a partir das decisões confirmadas na entrevista. Detalhamento para desenvolvimento: [specs de administração](specs/administracao/README.md). Implementação não realizada.

## Decisões confirmadas

- Um cliente pode possuir vários ambientes, com URL, dados, módulos e configuração próprios. Os termos estão definidos no glossário em `../CONTEXT.md`.
- O cadastro tem três passos: cliente e identidade, parametrização do sistema e revisão consolidada. Entre os campos de identidade, somente nome do cliente é obrigatório; nome e descrição do sistema, cor principal, logo e imagem de destaque usam os padrões quando não informados. O nome do cliente é único. Decisões consolidadas em [cadastro simplificado](specs/administracao/04-cadastro-simplificado.md).
- Os módulos/serviços contratados podem ser alterados futuramente.
- A área administrativa da plataforma é acessível apenas aos super admins internos. Super admins têm acesso a tudo. O admin do cliente é funcionário do cliente e acessa apenas a aplicação dele.
- O admin do cliente tem acesso a todos os ambientes do seu cliente, incluindo produção e homologação.
- Ao cadastrar um cliente, sempre criar produção e homologação, mantendo ambientes e bancos separados; não existe opção de omitir homologação.
- Ambos recebem a identidade e as funcionalidades iniciais escolhidas, com configuração própria por ambiente. O cadastro não seleciona processos do catálogo nem permite dados fictícios. As operações são independentes: produção pronta permanece disponível se homologação falhar; apresentar conclusão parcial e permitir retomar homologação. Havendo administrador indicado, enviar seu convite quando produção ficar pronta, sem aguardar homologação.
- Criar ambientes e conceder ou alterar módulos são funcionalidades exclusivas dos super admins. Admins do cliente não possuem essas permissões.
- A hospedagem é central, com aplicação compartilhada e banco separado por ambiente, conforme o ADR `adr/0001-hospedagem-central-banco-por-ambiente.md`.
- As finalidades dos dois ambientes iniciais são fixas: produção e homologação. Ambos começam com os cadastros essenciais, sem dados fictícios.
- Administração pela Septem começa marcada e significa apenas não criar um administrador do cliente inicialmente. Quando desmarcada, exigir nome e e-mail do primeiro administrador e enviar convite para concluir o cadastro, com possibilidade de reenvio pela equipe interna.
- Um ambiente está pronto quando a URL funciona com HTTPS, a base está preparada, a identidade visual está aplicada e as funcionalidades estão configuradas. Convite disponível é exigido somente quando um primeiro administrador foi indicado; não há instalação de processos selecionados no cadastro simplificado.
- Funcionalidades disponíveis são distintas de processos do catálogo. Todas as funcionalidades existentes começam marcadas; funcionalidades novas exigem concessão explícita aos clientes existentes. Remover a seleção de processos deste cadastro. Os exemplos de funcionalidades não constituem um catálogo exaustivo.
- O catálogo de funcionalidades é extensível e representa capacidades implementadas na aplicação. O super admin controla sua disponibilidade por ambiente; novas capacidades exigem implementação. Processos podem ser modelados diretamente na área administrativa.
- Sugerir subdomínio de produção pelo nome do cliente, permitir edição e derivar homologação com prefixo hml-. Verificar e reservar ambos antes do provisionamento. Cada ambiente pode ter domínio próprio adicional, com instruções de DNS e acompanhamento de validação e HTTPS; domínio próprio pendente não impede prontidão pelo subdomínio.
- A criação ocorre em segundo plano, com etapas, erros e retomada visíveis, sem duplicar o ambiente em novas tentativas. Falhas no envio do convite permitem reenvio sem recriar o banco.
- Gerar os bancos automaticamente pelo snake_case do nome do cliente, removendo acentos: nome_do_cliente em produção e nome_do_cliente_hml em homologação, sem edição manual e sem renomeação posterior. Validar unicidade do cliente e dos dois bancos antes de provisionar; rejeitar colisão mesmo com nomes de clientes diferentes, informando conflito e sem acrescentar identificadores automaticamente. Garantir unicidade das reservas no servidor sob concorrência.
- O nome do cliente aparece somente na área central; os ambientes apresentam a identidade do sistema. Administradores autorizados do cliente sempre podem editar horário de funcionamento, nome e descrição do sistema, cor principal, logo e imagem. Estado e município ficam em branco inicialmente e são configurados somente nos ambientes, junto do horário de funcionamento. Processos somente podem ser iniciados após configurar estado, município, fuso e pelo menos um período válido de funcionamento, com aviso no ambiente. Após a configuração inicial, rejeitar alterações incompletas e preservar processos em andamento e vencimentos anteriores, conforme o [ADR 0008](adr/0008-localizacao-configurada-por-ambiente.md).
- Os parâmetros iniciais vêm de appsettings e permanecem preservados nos ambientes; mudanças nos padrões afetam somente novos clientes. Não solicitar parâmetros dos provedores no cadastro. A estratégia de contas centrais e recursos isolados está no [ADR 0007](adr/0007-integracoes-isoladas-com-padroes-iniciais.md).
- A política de segurança não é editável na área central nem no cliente. O segundo fator é obrigatório para todos os usuários autenticados e utiliza o SMTP configurado no ambiente. Testar substituições de SMTP antes da ativação, preservando a configuração anterior em falhas; indisponibilidade posterior exige correção pela Septem sem desativar MFA. Dispositivo confiável dispensa novos desafios por um mês, quando nova autenticação passa a ser necessária; ao expirar, exigir nova autenticação com MFA na próxima ação autenticada, inclusive com sessão ainda aberta; o simples uso não renova o prazo.
- Produção é criada separadamente, sem converter homologação ou demonstração em produção. Alterações de homologação podem ser promovidas para produção conforme as regras abaixo.
- Super admins podem suspender e reativar ambientes, preservando os dados. Exclusão definitiva fica fora da primeira versão.
- Devem existir duas opções distintas: inativar completamente o ambiente ou não permitir novas requisições, conforme as regras de operação abaixo.

## Processos e promoção de alterações

- Serviço é a nomenclatura amigável de processo para o cliente; não representa um agrupamento separado.
- O cliente pode personalizar processos do seu ambiente. Alterações no catálogo central não são propagadas automaticamente; deve existir a opção de atualizar o processo do cliente a partir do catálogo.
- A promoção permite selecionar definições de processos, formulários, modelos de documentos, dashboards, configurações de agentes de IA e outras configurações, incluindo suas dependências.
- Dados de teste, execuções de processos, usuários, senhas e credenciais ficam fora da promoção. A habilitação de funcionalidades permanece exclusiva dos super admins.
- O admin do cliente visualiza uma comparação e confirma a promoção. A execução ocorre automaticamente após as validações, sem aprovação ou intervenção de um super admin.
- Deve ser possível sincronizar a definição do processo e suas dependências de produção para homologação, sem copiar solicitações reais, usuários ou credenciais. A operação apresenta comparação antes da confirmação e preserva uma versão anterior para recuperação.
- Conflitos na sincronização, promoção ou atualização pelo catálogo devem ser apresentados ao usuário, mostrando o que será sobrescrito. Ao seguir, a origem substitui os itens conflitantes no destino, limitada aos itens selecionados e suas dependências, preservando a versão anterior para recuperação. Cancelar mantém o destino intacto.
- Cada execução de processo permanece na versão em que começou. Novas versões são utilizadas por novas execuções; a migração de execuções existentes fica para um fluxo posterior.

## Disponibilidade e credenciais

- Quando uma funcionalidade for desabilitada, os processos dependentes apresentam um aviso no local de uso, informando a desabilitação e orientando o contato com a Septem para resolução. Dependências não impedem a desabilitação.
- Uma etapa automática dependente de funcionalidade desabilitada para na etapa afetada, registra o motivo e permite retomada após resolução, sem pular a etapa. Os dados existentes são preservados.
- No cadastro, três caixas independentes autorizam editar e-mail, armazenamento e provedor de IA; começam desmarcadas. Quando uma estiver desmarcada, ocultar a aba correspondente e impedir edição pela API do cliente.
- Quando faltar configuração de uma integração, a aplicação deve informar que falta configurar.
- O ambiente pode ficar pronto com funcionalidades pendentes de configuração, desde que a pendência seja claramente indicada.
- Quando a edição estiver permitida, somente admins autorizados do cliente podem substituir credenciais, sem visualizar o segredo já salvo. Revogá-la preserva a configuração e o funcionamento; retorno ao serviço da Septem exige ação explícita. Quando bloqueada, a aba fica oculta; avisos operacionais no ponto de uso não expõem segredos.
- Integrações podem utilizar contas da Septem ou do cliente, configuradas por ambiente. A origem da conta é independente da permissão concedida ao cliente para substituir credenciais.

## Operação dos ambientes

- Bloquear novas requisições impede a abertura de novas solicitações de serviços/processos, inclusive por APIs, agentes e agendamentos. Login, consultas e andamento de solicitações existentes permanecem disponíveis.
- Inativar completamente bloqueia o acesso do cliente e pausa processos e automações existentes, preservando dados e acesso dos super admins.
- Um ambiente completamente inativo apresenta uma tela informando sua inatividade no lugar do login. Usuários já logados devem ser redirecionados para essa tela.
- Na reativação, pendências são retomadas sem repetir ações concluídas. Agendamentos vencidos exigem decisão explícita sobre sua execução.

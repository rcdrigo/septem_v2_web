# Administração de clientes e ambientes

Escopo consolidado a partir das decisões confirmadas na entrevista. Detalhamento para desenvolvimento: [specs de administração](specs/administracao/README.md). Implementação não realizada.

## Decisões confirmadas

- Um cliente pode possuir vários ambientes, com URL, dados, módulos e configuração próprios. Os termos estão definidos no glossário em `../CONTEXT.md`.
- O cadastro informa cliente, nome do ambiente (Septem por padrão), URL, logo, nome da base com sugestão padrão, módulos/serviços e opção de dados fictícios.
- Os módulos/serviços contratados podem ser alterados futuramente.
- A área administrativa da plataforma é acessível apenas aos super admins internos. Super admins têm acesso a tudo. O admin do cliente é funcionário do cliente e acessa apenas a aplicação dele.
- O admin do cliente tem acesso a todos os ambientes do seu cliente, incluindo produção e homologação.
- Ao cadastrar o cliente, deve existir a opção de criar homologação junto com produção, mantendo ambientes e bancos separados.
- Na criação conjunta, homologação começa com as mesmas funcionalidades e processos selecionados para produção, com dados e credenciais separados e opção própria de dados fictícios. Cada ambiente tem criação independente: se um falhar, o outro pode permanecer disponível e a criação que falhou pode ser retomada.
- Criar ambientes e conceder ou alterar módulos são funcionalidades exclusivas dos super admins. Admins do cliente não possuem essas permissões.
- A hospedagem é central, com aplicação compartilhada e banco separado por ambiente, conforme o ADR `adr/0001-hospedagem-central-banco-por-ambiente.md`.
- O cadastro informa a finalidade: produção, homologação ou demonstração. Dados fictícios são opcionais apenas para homologação e demonstração; produção começa com os cadastros essenciais.
- O cadastro inclui nome e e-mail do primeiro administrador do cliente. Após verificar a prontidão, o sistema envia automaticamente um convite para definir a senha, com possibilidade de reenvio pela equipe interna.
- Um ambiente está pronto para uso quando a URL funciona com HTTPS, a base está preparada, a identidade visual está aplicada, os módulos estão habilitados e o convite para o primeiro administrador indicado no cadastro está disponível. A criação só é concluída após verificar esses critérios.
- A seleção deve distinguir funcionalidades disponíveis (por exemplo, modelos de documentos, assinatura eletrônica, dashboards e agentes de IA) de processos modelados no catálogo central. Na criação, o super admin seleciona quais processos serão replicados no ambiente. Os exemplos de funcionalidades não constituem um catálogo exaustivo.
- O catálogo de funcionalidades é extensível e representa capacidades implementadas na aplicação. O super admin controla sua disponibilidade por ambiente; novas capacidades exigem implementação. Processos podem ser modelados diretamente na área administrativa.
- Cada ambiente recebe um subdomínio da plataforma e pode ter domínio próprio adicional, com instruções de DNS e acompanhamento de validação e HTTPS. A prontidão pode ser atingida pelo subdomínio enquanto o domínio próprio aguarda configuração.
- A criação ocorre em segundo plano, com etapas, erros e retomada visíveis, sem duplicar o ambiente em novas tentativas. Falhas no envio do convite permitem reenvio sem recriar o banco.
- O nome da base é sugerido a partir do cliente e da finalidade, com garantia de unicidade. Pode ser editado antes da criação e é imutável depois; o nome exibido do ambiente continua editável.
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
- Na criação do ambiente, deve ser definido se o cliente pode alterar credenciais. Se não puder, as credenciais não são exibidas ao cliente.
- Quando faltar configuração de uma integração, a aplicação deve informar que falta configurar.
- O ambiente pode ficar pronto com funcionalidades pendentes de configuração, desde que a pendência seja claramente indicada.
- Quando a edição estiver permitida, somente admins autorizados do cliente podem substituir credenciais, sem visualizar o segredo já salvo. Quando bloqueada, o cliente vê somente o status e a orientação para contatar a Septem.
- Integrações podem utilizar contas da Septem ou do cliente, configuradas por ambiente. A origem da conta é independente da permissão concedida ao cliente para substituir credenciais.

## Operação dos ambientes

- Bloquear novas requisições impede a abertura de novas solicitações de serviços/processos, inclusive por APIs, agentes e agendamentos. Login, consultas e andamento de solicitações existentes permanecem disponíveis.
- Inativar completamente bloqueia o acesso do cliente e pausa processos e automações existentes, preservando dados e acesso dos super admins.
- Um ambiente completamente inativo apresenta uma tela informando sua inatividade no lugar do login. Usuários já logados devem ser redirecionados para essa tela.
- Na reativação, pendências são retomadas sem repetir ações concluídas. Agendamentos vencidos exigem decisão explícita sobre sua execução.

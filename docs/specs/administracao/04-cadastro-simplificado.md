# Cadastro simplificado de clientes

Decisões consolidadas na entrevista de 4 de outubro de 2026. As regras abaixo substituem as regras anteriores de cadastro quando houver conflito. Não há decisões de desenho abertas; a confirmação final do entendimento compartilhado encerrou a entrevista. Implementação concluída nos projetos web e API; resultados e limites da validação estão registrados abaixo.

## Decisões confirmadas

O cadastro deve ter três passos:

1. **Cliente e identidade**: nome do cliente, nome do sistema, descrição do sistema, cor principal, logo e imagem de destaque.
2. **Parametrização do sistema**: subdomínio com verificação de disponibilidade; funcionalidades contratadas inicialmente todas marcadas; três caixas de seleção independentes para permitir configuração de e-mail, armazenamento e provedor de IA; administração pela Septem inicialmente marcada. Quando a administração pela Septem estiver desmarcada, exigir nome e e-mail do administrador e enviar convite para concluir seu cadastro.
3. **Revisão**: apresentar as informações consolidadas antes de criar o cliente.

Somente o nome do cliente é obrigatório entre os campos de identidade. Não permitir dois clientes com o mesmo nome. Nome e descrição do sistema, cor principal, logo e imagem são opcionais; ausência usa os padrões definidos para o novo ambiente.

Cada novo cliente recebe sempre dois ambientes, produção e homologação, com bancos e dados separados. Remover a opção de criar homologação, a seleção de processos do catálogo e os dados fictícios do cadastro. Instalar somente cadastros essenciais; não selecionar nem replicar processos do catálogo nesse fluxo. Gerar os bancos automaticamente pelo snake_case do nome do cliente, removendo acentos: `nome_do_cliente` para produção e `nome_do_cliente_hml` para homologação, sem edição manual. Renomear o cliente depois não renomeia os bancos.

Validar unicidade do nome do cliente e de ambos os bancos derivados antes do provisionamento. Rejeitar o cadastro se qualquer banco já estiver reservado, mesmo com nomes de clientes diferentes, informando o conflito; não acrescentar identificadores automaticamente nem reaproveitar banco de outro cliente. Reservar os nomes dos dois bancos com garantia de unicidade no servidor, incluindo requisições concorrentes. Exemplo de conflito: homologação de “Acme” e produção de “Acme Hml” seriam ambas `acme_hml`.

Sugerir um subdomínio de produção pelo nome do cliente e permitir edição; gerar homologação automaticamente com o prefixo `hml-`. Usar o domínio base da plataforma configurado no backend; exemplos: `cliente.septemcompliance.com` e `hml-cliente.septemcompliance.com`. Verificar e reservar os dois hosts antes do provisionamento, inclusive sob concorrência.

As operações dos dois ambientes são independentes. Se produção ficar pronta e homologação falhar, liberar produção, apresentar o cadastro como parcialmente concluído e permitir retomar apenas homologação. Quando um administrador tiver sido indicado, enviar o convite assim que produção estiver pronta, sem aguardar homologação e sem duplicar o vínculo administrativo. O cadastro completo exige os dois ambientes prontos.

Estado e município são configurados somente nos ambientes do cliente, junto do horário de funcionamento, inicialmente em branco. Remover a exigência de localização no cadastro central. A ausência de localização não deve ser substituída por uma localização genérica.

Informar no ambiente que processos somente podem ser iniciados após a configuração do calendário. Exigir estado, município, fuso e pelo menos um período válido de funcionamento para liberar novos processos em qualquer canal. A prontidão técnica do ambiente permite acesso e configuração, mas não dispensa essa condição. Depois de configurado, impedir salvar alterações que deixem o calendário incompleto, mantendo a última configuração válida. Processos em andamento e vencimentos já calculados permanecem preservados.

Nome do cliente pertence à área central. O ambiente apresenta a identidade do sistema. O cliente deve sempre poder editar horário de funcionamento, nome e descrição do sistema, cor principal, logo e imagem; o alcance por papel autorizado continua sendo uma regra de acesso.

Uma permissão de integração desmarcada oculta a aba correspondente no ambiente do cliente. A política também precisa ser aplicada no servidor; ocultar a aba sozinho não controla chamadas diretas à API. Permissão de edição e uso da integração são conceitos diferentes.

As três permissões de integração começam desmarcadas e são independentes da administração inicial pela Septem. Revogar uma permissão preserva a configuração existente e o funcionamento da integração; voltar ao provedor da Septem exige uma ação explícita. Contas próprias do cliente são substituições opcionais quando autorizadas. Permissão de edição não altera automaticamente a responsabilidade pelos custos.

O cadastro utiliza as configurações iniciais definidas em appsettings, sem solicitar preenchimento manual dos parâmetros dos provedores. Segredos da Septem não devem ser exibidos nem entregues ao navegador.

Os valores iniciais são preservados por ambiente. Mudanças nos padrões de appsettings afetam somente a criação de novos clientes, sem propagar valores aos ambientes existentes. Referências e recursos individuais são provisionados automaticamente quando exigidos pela estratégia de isolamento; alteração explícita posterior e rotação de segredos não se confundem com propagação automática dos padrões.

Administração pela Septem significa apenas que nenhum administrador do cliente será criado inicialmente. Desmarcar exige nome e e-mail para convite. Os dois ambientes pertencem ao mesmo cliente e não exigem duplicação do vínculo administrativo.

Todas as funcionalidades disponíveis começam marcadas no cadastro. Funcionalidades implementadas futuramente exigem concessão explícita para clientes existentes, sem habilitação automática.

A política de segurança não é editável na área central nem no ambiente do cliente. Autenticação em dois fatores permanece obrigatória para todos os usuários autenticados, inclusive usuários externos e administradores das duas áreas.

Os códigos de autenticação continuam utilizando o SMTP configurado no ambiente do cliente. Não adotar um serviço central de autenticação independente desse SMTP. Uma substituição de SMTP deve ser testada antes da ativação; se falhar, manter a configuração anterior. Se o provedor parar posteriormente, a Septem corrige a configuração pela área central, sem desativar MFA.

Manter “confiar neste dispositivo”: após MFA bem-sucedido, a dispensa de novos desafios dura um mês, quando uma nova autenticação passa a ser necessária. Não prolongar a confiança apenas pelo uso do dispositivo. Se a sessão continuar aberta ao expirar, exigir nova autenticação com MFA na próxima ação autenticada; validar o prazo no servidor.

## Estado anterior verificado no frontend

O cadastro atual tem cinco passos e solicita configurações manuais dos provedores. Os padrões de provisionamento são carregados e copiados para um formulário editável; sua aplicação é descrita como inicial, seguida por configurações independentes por ambiente.

O nome do cliente aparece em telas do ambiente, incluindo login, navegação, serviços, validação e título da página. As políticas atuais permitem restringir também identidade e calendário, além de oferecer controle por campo.

O modo de autenticação em dois fatores aceita desativação e alteração no cadastro, na área central e no ambiente. O segundo fator atual utiliza códigos por e-mail dependentes do SMTP configurado, e há opção de confiar no dispositivo. O novo desenho precisa conciliar essa dependência com a edição opcional de e-mail pelo cliente.

A substituição atual do SMTP grava a configuração antes de executar um teste separado. A recuperação de senha também usa e-mail, sem outra recuperação exposta nessa interface. Validação no servidor não pôde ser verificada no frontend. A decisão aceita passa a exigir teste da configuração candidata antes de ativá-la.

O cadastro já inicia com administração pela Septem selecionada, sem criação do primeiro administrador do cliente nesse modo. As regras normativas foram atualizadas para exigir primeiro administrador e convite somente quando essa opção estiver desmarcada.

Esta investigação confirma comportamento e contratos do frontend. Appsettings, autorização efetiva no backend, isolamento dos recursos externos e entrega real dos convites precisam ser conferidos no projeto do servidor durante a implementação.

## Estratégia de provedores aceita

Utilizar contas da Septem por padrão, com substituições opcionais por contas do cliente quando autorizadas. Manter SMTP como transporte de e-mail, com SES SMTP como configuração inicial da Septem.

- **AWS SES**: conta da Septem com tenant SES por cliente, recursos associados e métricas por tenant; enviar por SMTP com credenciais técnicas da Septem protegidas no backend. Informar o tenant no envio via cabeçalho suportado pelo SES. Não criar usuário IAM por cliente apenas para identificá-lo. A interface SMTP não aceita credenciais derivadas de sessões temporárias de IAM roles. Identidade de remetente própria exige verificação do domínio. [Gestão de tenants SES](https://docs.aws.amazon.com/ses/latest/dg/tenants.html), [credenciais SMTP](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html).
- **S3**: bucket privado compartilhado com prefixos por cliente e ambiente e autorização restrita aos prefixos; considerar bucket por ambiente quando houver necessidade de políticas de retenção, recuperação ou isolamento independentes. Prefixos organizam objetos; políticas de acesso efetivam o isolamento. [Padrões de buckets](https://docs.aws.amazon.com/us_en/AmazonS3/latest/userguide/common-bucket-patterns.html), [controle de acesso](https://docs.aws.amazon.com/AmazonS3/latest/user-guide/access-control-overview.html).
- **Turnstile**: widget central para os subdomínios controlados pela Septem. Autorizar um domínio permite seus subdomínios, sem cadastrar um wildcard literal. Validar o token no servidor e conferir o hostname esperado do ambiente. Domínios próprios e necessidades de rotação/telemetria independentes podem justificar widgets separados. [Hostnames](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/), [validação no servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- **OpenRouter**: conta central com chave de inferência por ambiente e limite de consumo; a chave administrativa permanece no backend e serve apenas para gerenciar chaves. Chaves separadas permitem atribuir consumo e revogar acessos, mas continuam vinculadas à conta central. [Gestão programática de chaves](https://openrouter.ai/docs/guides/overview/auth/management-api-keys).

## Relação com documentos existentes

Preservar a distinção entre cliente e ambiente do [glossário](../../../CONTEXT.md). Os [requisitos administrativos](../../requisitos-administracao.md), [domínio](01-dominio.md), [contratos](02-contratos.md) e [aceite](03-entregas-e-aceite.md) seguem as decisões de cadastro aqui confirmadas. A mudança de localização está registrada no [ADR 0008](../../adr/0008-localizacao-configurada-por-ambiente.md); a estratégia de padrões e provedores está no [ADR 0007](../../adr/0007-integracoes-isoladas-com-padroes-iniciais.md).

## Implementação e validação — 4 de outubro de 2026

O frontend e a API implementam o assistente de três etapas, reservas atômicas do par de ambientes, defaults protegidos, três permissões independentes, identidade do sistema, calendário por ambiente e MFA obrigatório. A API testa o SMTP candidato antes de ativá-lo. O backend inclui as migrations `SimplifiedClientProvisioning` e `SimplifiedClientCalendarAndMfa`; os modelos de master e tenant não apresentam mudanças pendentes.

O build TypeScript/Vite passou. No backend, passaram 158 testes relacionados e 55 testes de aplicação. A rodada focal posterior passou 106 de 107; a única falha era uma espera prematura por homologação, corrigida para aguardar os dois jobs. A execução final de provisionamento passou 21 de 21, incluindo convite único. Essas contagens são seleções sobrepostas, não um total cumulativo.

As sondas de cadastro, branding, permissões, calendário, renovação de sessão e MFA central passaram em 1280×900 e 375×812, com inspeção das capturas, ausência de overflow e controles cortados. `client-onboarding-integration` passou novamente nas duas dimensões com as assemblies finais: executa login central e do ambiente com MFA, criação pelo navegador, dois bancos/jobs reais, defaults, recusa de nome/banco conflitante, ausência de administrador e processos iniciais e segurança imutável. O navegador usa HTTP real, sem interceptar respostas; PostgreSQL é descartável e os adapters externos são simulados. Evidências finais: `/private/tmp/septem-onboarding-integration-final.log` e capturas em `/private/tmp/septem-onboarding-integration-final`. Os comandos reproduzíveis estão no [guia de testes](../../../tools/uitest/README.md#cadastro-simplificado-e-mfa-mensal).

A suíte .NET completa anterior às correções finais teve 978 aprovados e 88 falhos, portanto não comprova uma regressão geral verde. As falhas dos contratos alterados foram tratadas pelas seleções acima. Permanecem casos de PFX incompatível com macOS, Docker indisponível, fontes/PdfSharp, fixtures de upload que esperam o nome original em vez da chave interna, acesso externo sem concessão explícita e golden/formulário inválido de relatórios. Não foi repetida toda a suíte .NET após as correções.

A bateria geral de UI terminou com 35 de 140 suítes aprovadas, usando o host isolado e `SUITE_TIMEOUT=45`. Contém sondas históricas com porta 5000 fixa e login que espera token antes do MFA; elas precisam atualizar seus pré-requisitos/contratos. A integração nova concluiu os cenários das duas dimensões, mas seu encerramento excedeu esse teto reduzido; a execução isolada sem esse teto é a evidência correspondente. A intermitência de Escape em `task-tags-session` também foi reproduzida com os arquivos de produção de `HEAD`: o teste pressiona Escape antes de estabilizar o foco da confirmação. Nenhum desses resultados deve ser apresentado como aprovação da bateria completa. Logs desta rodada: `/private/tmp/septem-onboarding-run-all-final.log` e `tools/uitest/falhou-*.log` (arquivos locais, não versionados).

Os testes não verificam entrega externa de e-mail, DNS/TLS publicado ou contas cloud reais. A implantação depende das configurações IAM/STS, ARNs SES e chave de gestão OpenRouter descritas em `doc/administracao-multitenant-implantacao.md` no checkout da API. Clientes antigos preservam integrações e permissões existentes; duplicatas de nome/banco anteriores à migration exigem regularização operacional, sem renomeação automática.

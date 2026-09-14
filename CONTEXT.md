# Domínio Septem

## Linguagem — Clientes e ambientes

**Cliente**:
Organização contratante que pode possuir um ou mais ambientes.
_Evitar_: Ambiente como sinônimo de cliente.

**Ambiente**:
Instância de uso de um cliente, com URL, dados, módulos e configuração próprios, como produção ou homologação.
_Evitar_: Cliente como sinônimo de ambiente.

**Nome do ambiente**:
Nome exibido na aplicação daquele ambiente, como Septem (padrão) ou SGI.

**Área administrativa da plataforma**:
Área acessível apenas aos super admins internos para administrar clientes e criar seus ambientes.

**Super admin**:
Administrador da plataforma com acesso a todos os clientes e ambientes, responsável exclusivo pela criação de ambientes e concessão ou alteração de módulos.

**Admin do cliente**:
Funcionário do cliente que administra sua aplicação e tem acesso a todos os ambientes desse cliente, sem acesso à área administrativa da plataforma nem permissão para criar ambientes ou alterar funcionalidades contratadas.

**Funcionalidade**:
Capacidade da aplicação selecionada para um ambiente, como modelos de documentos, assinatura eletrônica, dashboards ou agentes de IA.

**Processo do catálogo**:
Processo modelado na área administrativa da plataforma que pode ser selecionado para replicação em um ambiente.

**Serviço**:
Nome amigável de processo apresentado ao cliente; representa o mesmo conceito, sem entidade separada.

**Processo do ambiente**:
Processo disponível em um ambiente, personalizável pelo cliente. Quando originado do catálogo, pode receber uma atualização opcional; alterações no original não o modificam automaticamente.

**Promoção de alterações**:
Replicação de alterações de um ambiente de homologação para um ambiente de produção, mantendo os ambientes separados.

**Sincronização para homologação**:
Replicação de um processo do ambiente de produção para o ambiente de homologação do cliente.

**Bloqueio de novas requisições**:
Condição do ambiente que impede abrir novas solicitações de serviços/processos, mantendo acesso, consultas e andamento das solicitações existentes.

**Ambiente inativo**:
Ambiente com acesso do cliente bloqueado e processos e automações pausados, preservando seus dados e a gestão pelos super admins.

**Finalidade do ambiente**:
Classificação do uso do ambiente como produção, homologação ou demonstração, distinta do nome exibido na aplicação.

**Dados fictícios**:
Dados de teste opcionais em ambientes de homologação ou demonstração. Ambientes de produção começam apenas com os cadastros essenciais.
_Evitar_: Dummy data.

## Linguagem — Suporte

**Chamado**:
Solicitação de erro/bug, melhoria, nova funcionalidade ou suporte/dúvida, acompanhada pelo requisitante ao longo do atendimento.
_Evitar_: Ticket.

**Requisitante**:
Usuário que abre o chamado, acompanha seu andamento e aprova propostas quando exigidas.

**Triagem**:
Equipe central da Septem que recebe os chamados e os encaminha para atendimento por uma equipe do cliente ou da Septem.

**Equipe de atendimento**:
Equipe do cliente ou da Septem para a qual o chamado é destinado para atendimento.

**Proposta de solução**:
Proposta submetida à aprovação do requisitante quando essa etapa é utilizada, com estimativa de horas para o atendimento. A cobrança considera as horas efetivamente executadas.

**Responsável pelo chamado**:
Pessoa responsável pelo atendimento geral do chamado, que pode envolver tarefas de vários participantes.

**Tarefa de atendimento**:
Trabalho com responsável e descrição próprios dentro de um chamado, que pode ocorrer em paralelo com outras tarefas.

**Validação da solução**:
Aceite da solução pelo requisitante antes da implementação em produção, quando aplicável, distinto da aprovação da proposta e estimativa.

**Nota interna**:
Comunicação da equipe de atendimento, com eventuais anexos, que não fica visível ao requisitante.

**Horas cobráveis**:
Horas executadas pela equipe da Septem de requisitos ou desenvolvimento, ou pela triagem quando ela própria resolve o chamado, com ou sem proposta. Horas da equipe do cliente não compõem a cobrança da Septem.

**Registro de atividade**:
Descrição do trabalho realizado por um participante do atendimento, acompanhada das horas gastas, informada ao concluir sua tarefa.

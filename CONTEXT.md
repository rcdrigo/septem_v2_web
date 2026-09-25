# Domínio Septem

## Linguagem — Formulários

**Formulário**:
Definição dos campos de um processo, organizada em abas, agrupamentos e campos.

**Aba de formulário**:
Divisão de navegação de um formulário que contém agrupamentos; não contém outras abas.

**Agrupamento**:
Conjunto de campos pertencente a uma aba, do tipo Grupo Padrão ou Tabela; não contém outros agrupamentos.

**Grupo Padrão**:
Agrupamento com uma coleção de campos sem repetição de linhas.

**Tabela de formulário**:
Agrupamento cujos campos definem colunas e cujas linhas são adicionadas por quem preenche o formulário.
_Evitar_: Lista dinâmica para esse conceito no novo modelo.

**Linha de tabela de formulário**:
Ocorrência de respostas aos campos definidos nas colunas de uma Tabela, acrescentada durante o preenchimento pelo usuário ou por automação.

**Campo**:
Elemento de um agrupamento que define uma informação do formulário; em uma Tabela, corresponde a uma coluna.

**Elemento de apresentação**:
Conteúdo visual do formulário que não recebe respostas, como texto estático, imagem ou separador.

## Linguagem — Tags

**Requisição**:
Execução individual de um processo, abrangendo suas etapas até o encerramento.
_Evitar_: Processo quando a distinção entre definição e execução for relevante.

**Tarefa de processo**:
Etapa de trabalho de uma requisição, distinta da tarefa de atendimento de um chamado.

**Participação em uma requisição**:
Conclusão de pelo menos uma tarefa de processo pelo usuário naquela requisição. A mera atribuição ou o recebimento de uma tarefa não caracteriza participação para a listagem pessoal de requisições.

**Substituição por ausência temporária**:
Recebimento de uma tarefa em lugar de seu responsável original durante a ausência temporária dele. O usuário ausente é o responsável original, não o requisitante da requisição.

**Tag de processo**:
Classificação interna pertencente a um processo modelado e reutilizável em suas requisições, inclusive entre versões do processo no mesmo ambiente. Tags de processos diferentes são independentes, mesmo quando possuem o mesmo nome.

**Associação de tag**:
Vínculo entre uma tag de processo e uma requisição específica.

**Exclusão de tag do processo**:
Remoção da tag do catálogo do processo e de todas as requisições associadas, distinta da remoção de uma associação individual.

**Histórico de alterações de tags**:
Registro das alterações de tags, identificando o que mudou, quem fez a alteração e quando, inclusive após o encerramento da requisição.

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

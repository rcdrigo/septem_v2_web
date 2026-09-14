# Visão geral da plataforma

**Manuais técnicos › Primeiros passos › Visão geral da plataforma**

Este manual apresenta a organização do Septem, os perfis de usuário e o caminho percorrido por uma solicitação desde a publicação do serviço até sua conclusão.

> **Acesso restrito**
> Este conteúdo é destinado a administradores e usuários autorizados a consultar manuais técnicos. As opções exibidas no sistema dependem das permissões atribuídas ao usuário.

## O que a plataforma organiza

O Septem conecta a configuração administrativa ao atendimento diário. Um processo modelado e publicado torna-se um serviço; cada envio cria uma requisição; o fluxo distribui tarefas; os dados alimentam documentos, consultas e indicadores.

| Conceito | O que representa | Exemplo |
|---|---|---|
| **Processo** | Regra executável com etapas, responsáveis e decisões. | Licenciamento de funcionamento. |
| **Formulário** | Estrutura dos dados e documentos usados no processo. | CNPJ, atividade, endereço e licença anterior. |
| **Serviço** | Processo publicado e disponível para iniciar uma requisição. | Solicitar renovação de licença. |
| **Requisição** | Uma execução individual do serviço. | Pedido nº 184 feito pelo empreendimento Alfa. |
| **Tarefa** | Trabalho atribuído a uma pessoa durante a requisição. | Analisar documentos do pedido nº 184. |
| **Consulta** | Relatório publicado para leitura operacional. | Licenças por situação e unidade. |
| **Manual** | Orientação publicada no Guide para determinado público. | Como anexar o contrato assinado. |

## Perfis de uso

### Usuário interno

É o servidor ou colaborador do órgão. Conforme suas permissões, pode executar tarefas, acompanhar requisições, consultar relatórios e administrar cadastros.

O menu interno pode apresentar:

- **Dashboard**, quando o usuário possui um painel associado;
- **Tarefas**, com pendências e histórico concluído;
- **Requisições**, com processos iniciados pelo próprio usuário;
- **Consultas**, com relatórios publicados e autorizados;
- **Organograma**, para localizar unidades e posições;
- grupos administrativos de processos, relatórios e configurações.

### Usuário externo

É o solicitante que representa a si próprio ou uma organização, como empreendimento ou fornecedor. O menu é reduzido às atividades necessárias para solicitar, responder e acompanhar serviços.

O usuário externo normalmente utiliza:

- a **Central de serviços** para localizar o serviço;
- **Nova requisição** para iniciar um pedido autenticado;
- **Tarefas** para responder complementações ou executar etapas atribuídas;
- **Requisições** para acompanhar o andamento;
- **Suporte** e o **Guide** para orientação.

### Administrador e perfis especializados

O administrador configura o ambiente e recebe acesso amplo. Perfis especializados devem receber somente as permissões necessárias, por exemplo:

- modelador: `workflow:write` e, quando aplicável, `workflow:publish`;
- criador de relatórios: `reports:write`;
- gestor de manuais: `manuals:write`;
- leitor de manuais técnicos: `manuals:technical`;
- simulador: `workflow:simulate`.

Uma permissão habilita a funcionalidade. Regras de acesso do processo, relatório ou manual ainda podem limitar sobre quais itens o usuário atuará.

## Conhecendo a navegação

### Menu lateral

O menu é montado conforme o modo de acesso e as permissões da sessão. Um grupo administrativo vazio não aparece. Se um item esperado não estiver visível, verifique primeiro o perfil efetivo do usuário.

No topo do menu existem duas ações frequentes:

- **Buscar no Septem:** abre a pesquisa global; também pode ser acionada por `Ctrl+K` ou `⌘K`;
- **Nova requisição:** abre o catálogo de serviços que o usuário pode iniciar.

Os favoritos aparecem no menu e permitem retornar rapidamente a serviços e consultas. O limite e as permissões continuam valendo para um item favoritado.

### Tipo de acesso

Usuários que possuem vínculos internos e externos podem alternar o modo de acesso. A troca modifica o menu e o contexto de uso, sem conceder permissões adicionais.

Antes de executar uma ação administrativa, confirme que o modo **Interno** está ativo. Antes de reproduzir a experiência de um requerente, alterne para o modo externo quando essa opção estiver disponível.

### Navegação em dispositivos móveis

No celular, o menu funciona como uma gaveta lateral. As mesmas funcionalidades permanecem disponíveis, mas tabelas podem ser substituídas por cartões e barras de ações podem exigir rolagem horizontal.

Ao preencher formulários longos no celular:

1. salve o rascunho sempre que a tarefa permitir;
2. confira anexos antes de concluir;
3. revise mensagens de validação próximas aos campos;
4. aguarde a confirmação de sucesso antes de fechar a aba.

## Como uma solicitação percorre o sistema

Considere o serviço **Licenciamento de funcionamento**:

1. um administrador modela o fluxo, o formulário, os responsáveis e o acesso;
2. a versão é testada e publicada;
3. o empreendimento encontra o serviço e envia seus dados;
4. o sistema cria uma requisição numerada;
5. o fluxo atribui a tarefa **Analisar documentação** ao setor responsável;
6. o servidor pode aprovar ou solicitar complementação;
7. se houver complementação, uma nova tarefa é atribuída ao requerente;
8. documentos podem ser gerados e assinados;
9. a requisição termina quando um evento de fim é alcançado;
10. usuários autorizados acompanham o histórico e consultam os resultados.

Os dados pertencem à requisição. Cada tarefa mostra somente os campos definidos como visíveis ou editáveis para aquela etapa.

## Estados que não devem ser confundidos

### Estado da definição

| Estado | Significado |
|---|---|
| **Rascunho** | Definição em preparação, ainda indisponível ao público. |
| **Em homologação** | Nova versão de teste de um processo que já possui produção publicada. |
| **Publicado** | Versão usada por novas requisições de produção. |
| **Inativo** | Não aceita novas requisições; versões e histórico permanecem. |

### Estado da requisição

| Estado | Significado |
|---|---|
| **Em andamento** | Existe trabalho pendente ou espera ativa. |
| **Concluído** | O fluxo alcançou seu encerramento. |
| **Cancelado** | A execução foi interrompida por ação autorizada. |
| **Teste** | A execução foi iniciada como simulação e aparece identificada. |

Salvar uma alteração em um processo publicado cria ou atualiza sua versão de homologação. A versão publicada continua atendendo produção até uma nova publicação.

## Onde executar cada atividade

| Necessidade | Caminho principal |
|---|---|
| Atender uma pendência | **Tarefas › Pendentes** |
| Consultar o que já foi executado | **Tarefas › Concluídas** |
| Acompanhar um pedido iniciado por você | **Requisições** |
| Iniciar um serviço | **Nova requisição** ou **Central de serviços** |
| Desenhar ou publicar um processo | **Admin › Processos › Processos** |
| Construir um relatório | **Admin › Relatórios e Dashboards › Relatórios** |
| Consultar um relatório publicado | **Consultas** |
| Configurar usuários e permissões | **Admin › Configurações** |
| Criar conteúdo de ajuda | **Admin › Configurações › Manuais** |

## Cuidados operacionais

- Não use uma simulação como evidência de produção; ela permanece marcada como teste.
- Não compartilhe links administrativos com usuários sem a permissão necessária.
- Use **Salvar** durante o preenchimento quando precisar continuar depois; salvar não equivale a concluir.
- Leia a descrição dos botões de ação. **Aprovar**, **Devolver** e **Solicitar ajuste** podem conduzir a caminhos diferentes.
- Verifique o número da requisição antes de registrar uma decisão ou anexar um documento.
- Inativar preserva histórico; excluir permanentemente pode ser bloqueado quando já existem solicitações.

## Diagnóstico inicial

### Uma opção não aparece no menu

Confirme o modo de acesso, as permissões do perfil e as regras específicas do item. Saia e entre novamente caso o perfil tenha sido alterado durante a sessão.

### Uma tarefa esperada não aparece

Verifique se a requisição está em andamento, se a etapa anterior foi concluída, se o responsável foi resolvido e se há filtros aplicados na caixa de tarefas.

### Um serviço publicado não aparece

Confirme o status publicado, as opções de acesso externo ou interno e as regras de quem pode ver ou iniciar o processo.

### Uma consulta não aparece

O relatório precisa estar publicado e possuir ao menos uma regra que permita o acesso, salvo para administradores.

## Próximos manuais

- **Operação de tarefas e requisições** para o atendimento diário;
- **Simulação e homologação de processos** para validar alterações;
- **Consultas e visualização de relatórios** para leitura de resultados;
- **Criação e publicação de relatórios** para configuração administrativa;
- **Administração de manuais e Guide** para publicar ajuda contextual.

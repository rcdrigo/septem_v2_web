# Modelador de processos

**Manuais técnicos › Construção de processos › Modelador de processos**

Aprenda a transformar um procedimento do órgão em um fluxo executável, desde o desenho das etapas até os testes e a publicação.

> **Acesso restrito**
> Este manual é destinado a administradores e usuários com permissão para consultar manuais técnicos. A permissão de leitura não concede, por si só, autorização para editar, testar ou publicar processos.

## Visão geral

O modelador reúne quatro partes que funcionam em conjunto:

| Área | O que você define | Exemplo neste manual |
|---|---|---|
| **Fluxo** | Etapas, responsáveis, decisões e caminhos. | Receber solicitação, analisar documentos e pedir complementação. |
| **Formulário** | Dados e documentos usados durante a execução. | Razão social, atividade, parecer e anexos. |
| **Tarefas × Campos** | Quem pode ver ou alterar cada informação em cada etapa. | O requerente informa a razão social; o servidor edita o parecer. |
| **Configurações** | Identificação, apresentação e regras de acesso. | Categoria Licenciamentos e unidade responsável. |

O desenho é baseado em BPMN. A biblioteca **bpmn-js** fornece a área de diagramação e recursos de edição; responsáveis, formulários, permissões, versões e execução são integrações do Septem. Portanto, um elemento que possa ser desenhado não deve ser considerado executável até que seu comportamento esteja disponível e tenha sido testado no sistema.

Neste manual, você construirá o processo fictício **Licenciamento — exercício**:

1. o empreendimento envia a solicitação;
2. um servidor analisa a documentação;
3. se faltar informação, o processo retorna ao requerente;
4. quando a documentação estiver completa, a análise é concluída.

O exemplo serve para aprender a ferramenta. Ele não representa exigências legais de um órgão específico.

## Antes de desenhar o processo

Um fluxo fica mais simples de manter quando suas regras são definidas antes da modelagem. Registre, pelo menos:

- qual evento inicia o procedimento;
- quais ações dependem de uma pessoa;
- quem deve executar cada ação;
- quais decisões alteram o caminho;
- quais informações são produzidas em cada etapa;
- quais resultados encerram o procedimento;
- quem poderá localizar e iniciar o serviço.

Prefira nomes que indiquem uma ação. **Analisar documentação** comunica melhor o trabalho esperado do que **Análise**. Para decisões, formule uma pergunta objetiva, como **Documentação suficiente?**.

> **Dica**
> Modele primeiro o caminho mais frequente, do início ao fim. Depois acrescente retornos, exceções e regras de acesso.

<!-- PRINT: visão geral do modelador, com as quatro abas e a barra de ações. -->

<a id="processos-visao-geral"></a>

## Conhecendo o modelador

Ao abrir um processo novo ou existente, a barra superior concentra o nome, o diagnóstico, as quatro áreas do modelador e as ações que afetam a definição. Embora todos esses controles apareçam na mesma faixa, eles cumprem funções diferentes.

| Controle | Para que serve | Quando utilizar |
|---|---|---|
| **Voltar para Processos** | Fecha o modelador ou retorna à listagem administrativa. | Depois de salvar o trabalho ou quando deseja abandonar a edição. |
| **Nome do processo** | Identifica a definição e permite renomeá-la. | No início da configuração ou quando o nome do serviço mudar. |
| **Tudo certo / avisos / erros** | Abre o diagnóstico automático do diagrama. | Durante a modelagem e obrigatoriamente antes de publicar. |
| **Fluxo** | Abre o desenho BPMN e o painel de propriedades. | Para adicionar etapas, eventos, decisões, responsáveis e automações do fluxo. |
| **Formulário** | Abre o editor visual do formulário. | Para criar os dados, anexos, opções e orientações usados pelas tarefas. |
| **Tarefas × Campos** | Abre a matriz de oculto, visível e editável. | Para definir como cada tarefa utiliza cada campo. |
| **Configurações** | Abre identificação, publicação, permissões e controle de acesso. | Para apresentar o serviço e determinar quem pode utilizá-lo. |
| **Recursos** | Abre importação, exportação, imagem e versionamento. | Para transportar, documentar ou criar uma nova versão da definição. |
| **Salvar** | Grava a versão corrente ou cria a primeira versão de um processo novo. | Ao concluir uma unidade de trabalho e antes de sair. |
| **Publicar** | Salva o conteúdo atual e marca essa versão como publicada. | Somente depois da validação funcional e de acesso. |

### Diagnóstico: Tudo certo, avisos e erros

O diagnóstico não é uma aba. Ele é um indicador permanente da saúde do diagrama:

- **Tudo certo:** nenhuma inconsistência conhecida foi encontrada;
- **N avisos:** existem situações que podem produzir comportamento incompleto, mas nem todas bloqueiam o salvamento;
- **N erros:** existe ao menos uma inconsistência que precisa ser corrigida.

Clique no indicador para abrir a lista. Quando o problema estiver associado a um elemento, clique na mensagem: o modelador muda para **Fluxo**, seleciona o elemento e o posiciona na área visível.

O diagnóstico atual verifica, entre outros casos: ausência de início, ausência de fim, elemento executável sem nome, elemento desconectado, início sem saída, fim sem entrada, gateway condicional com menos de duas saídas, gateway exclusivo sem caminho padrão ou com mais de um caminho padrão, tarefa sem responsável completo e botões com nome vazio ou IDs duplicados.

> **Importante**
> “Tudo certo” significa apenas que as regras automáticas conhecidas foram atendidas. Ainda é necessário testar responsáveis, formulários, fontes, integrações, acessos e todos os caminhos do processo.

### Aba Fluxo

**Fluxo** é a área de desenho do processo. Ela contém:

- a toolbar lateral, com ferramentas e elementos BPMN;
- o canvas, no qual os elementos são posicionados e conectados;
- o menu contextual do elemento selecionado, usado para anexar o próximo elemento;
- o painel de propriedades à direita, que muda de acordo com a seleção;
- os diagnósticos, que podem selecionar diretamente um elemento com problema.

Use essa aba para definir a ordem das ações, os pontos de espera, quem recebe tarefas, quais botões o usuário verá, quais documentos exigem assinatura e quais integrações ou eventos participam do fluxo.

### Aba Formulário

**Formulário** define a estrutura de dados compartilhada pelo processo. A paleta à esquerda adiciona componentes; a área central organiza o formulário; o painel à direita configura o componente selecionado.

Na barra própria do editor você também define se os grupos aparecerão **Empilhados** ou em **Abas** durante a execução, abre a **Pré-visualização**, acessa **JavaScript** quando possuir `forms:javascript`, administra **Máscaras** e importa um formulário quando o processo ainda não possui instâncias.

O formulário define quais dados existem. Ele não define sozinho quem poderá vê-los ou alterá-los. Depois de criar os campos, complete a configuração em **Tarefas × Campos**.

Consulte o [Manual do modelador de formulários](./modelador-formularios.md) para a configuração detalhada dos componentes.

### Aba Tarefas × Campos

Essa aba cruza os campos do formulário com o **Início** e todas as **Tarefas humanas** do diagrama. As linhas são agrupadas conforme a estrutura do formulário; as colunas representam as etapas.

Em cada célula, selecione:

- **Oculto:** o campo não aparece na etapa;
- **Visível:** o valor aparece para consulta;
- **Editável:** o usuário pode preencher ou alterar o valor.

O controle no cabeçalho da coluna aplica um estado a todos os campos da tarefa. O controle na linha do grupo aplica o estado somente aos campos daquele grupo. Use essas ações para acelerar a configuração e revise as exceções em seguida.

Se a aba informar que não há campos, crie-os em **Formulário**. Se não houver colunas, adicione um **Início** ou uma **Tarefa humana** em **Fluxo**.

### Aba Configurações

Essa aba configura o processo como serviço e possui duas áreas internas:

- **Informações gerais:** identificação, descrição, categoria, unidade responsável, resumo da requisição, status e permissões durante a execução;
- **Controle de acesso:** regras que determinam quem pode ver, iniciar, editar, cancelar ou excluir instâncias.

Use-a depois que o fluxo e o público estiverem definidos. Uma boa configuração permite que o usuário encontre o serviço, entenda sua finalidade e receba somente as capacidades autorizadas.

### Menu Recursos

**Importar fluxo** abre um arquivo `.bpmn` ou `.xml` e coloca sua definição no modelador. A importação pode alterar todo o desenho; faça-a em um processo de teste e revise as extensões específicas do Septem.

**Exportar fluxo** grava o BPMN atual. Antes de exportar, o modelador sincroniza o formulário com o XML. O arquivo é adequado para cópia técnica e intercâmbio, mas referências a cadastros do ambiente podem precisar ser revistas no destino.

**Salvar como imagem (PNG)** gera uma representação visual do diagrama. Ela serve para revisão e documentação; não contém uma definição reimportável.

**Versionar processo** cria explicitamente uma nova versão. Use quando precisar preservar a versão atual como um marco separado de evolução, depois de entender quais instâncias e qual versão publicada serão afetadas.

### Nome e estado do processo

O nome deve permitir que servidores e administradores reconheçam o serviço sem abrir o diagrama. Clique no nome para editá-lo. Confirme saindo do campo ou pressionando **Enter**; use **Escape** para abandonar a alteração enquanto ainda estiver editando.

O selo **Em homologação · vN** indica que você está editando uma versão de teste. A produção continua usando a versão publicada até que você clique em **Publicar**.

O aviso **Alterações pendentes** indica mudanças locais ainda não gravadas. Ele aparece depois de alterações no modelo e deve desaparecer após a confirmação do salvamento.

### Salvar e publicar

Em um processo novo, **Salvar** cria a primeira versão como rascunho. Em um processo existente, atualiza a versão corrente. Se a definição estava publicada, salvar uma alteração cria ou mantém uma versão em homologação e preserva a versão de produção.

**Publicar** primeiro salva o XML atual e depois altera o estado da versão para publicado. A mensagem de sucesso informa a versão publicada.

**Versionar processo**, dentro de Recursos, cria uma nova versão explicitamente. Ele não é sinônimo de Salvar: a ação registra outro número de versão.

> **Importante**
> Salvar não equivale a publicar. Antes de publicar, percorra os caminhos em teste e confira a experiência com contas que representem os públicos reais do serviço.

Ao sair com alterações pendentes, o sistema solicita confirmação. Se o salvamento retornar erro de diagrama, falta de permissão ou conflito, corrija a causa apresentada antes de fechar o modelador.

<a id="processos-fluxo"></a>

## Desenhando o primeiro fluxo

Abra **Fluxo** para criar a sequência do procedimento.

### 1. Defina o início

O evento de início representa a entrada no processo. No exemplo, ele corresponde ao envio da solicitação de licenciamento. Mantenha um início claramente conectado à primeira atividade.

### 2. Adicione as tarefas humanas

Uma tarefa humana representa trabalho feito por uma pessoa. Adicione **Analisar documentação** e **Complementar informações**. Posicione-as para que o caminho principal possa ser lido da esquerda para a direita ou de cima para baixo, sem cruzamentos desnecessários.

### 3. Conecte as etapas

Use fluxos de sequência para indicar a ordem de execução. A direção da seta define o próximo elemento. No exemplo:

`Início → Analisar documentação`

Uma conexão visual sem destino correto impede que o processo chegue à etapa planejada. Se uma atividade não receber uma solicitação no teste, confira primeiro suas conexões de entrada e as condições anteriores.

### 4. Inclua a decisão

Depois de **Analisar documentação**, adicione um gateway para representar a pergunta **Documentação suficiente?**. Crie uma saída para a conclusão e outra para **Complementar informações**. Conecte a complementação de volta à análise.

### 5. Encerre os caminhos

Adicione um evento de fim ao caminho de conclusão. Todos os caminhos que devem terminar precisam chegar a um encerramento coerente ou a outra etapa válida.

### 6. Revise o desenho

Selecione os elementos e confirme nomes, responsáveis e configurações. Consulte os diagnósticos do modelador. Corrija elementos desconectados, saídas sem destino e regras incompletas antes de testar.

**Resultado do exercício:** o diagrama mostra um caminho de análise, um retorno para complementação e uma saída de conclusão.

<!-- PRINT: fluxo completo do exercício, com início, tarefas, gateway e fim. -->

## Conhecendo a toolbar do fluxo

A toolbar fica na lateral do canvas. Os primeiros ícones são ferramentas de edição; os demais criam elementos. Para inserir um elemento, clique no ícone e depois no canvas, ou arraste o ícone até a posição desejada.

### Ferramentas de edição

| Ferramenta | Para que serve | Como usar |
|---|---|---|
| **Mover o canvas** | Desloca a área visível sem mover os elementos. | Ative a mão e arraste o canvas até a região desejada. |
| **Selecionar em área (laço)** | Seleciona vários elementos ao mesmo tempo. | Ative o laço e contorne os elementos; depois mova a seleção ou aplique uma ação compatível. |
| **Inserir/remover espaço** | Abre ou fecha espaço entre partes do diagrama. | Ative a ferramenta, marque a linha de corte e arraste na direção necessária. Confira se nenhuma conexão ficou ilegível. |
| **Conectar elementos** | Cria um fluxo de sequência entre dois elementos. | Ative a conexão, clique no elemento de origem e depois no destino. Confirme a direção da seta. |

Ao selecionar um elemento, o menu contextual oferece atalhos para anexar **Tarefa humana**, **Tarefa de script**, **Tarefa de sistema**, **Desvio condicional** ou **Fim**. O novo elemento já é conectado ao selecionado. O menu não é exibido para o Fim nem para tipos que não podem continuar o fluxo.

> **Dica**
> Use o menu contextual para continuar uma sequência simples e a toolbar quando precisar escolher um tipo diferente, como evento de e-mail, timer, marco, subprocesso ou gateway inclusivo.

### Catálogo dos elementos

| Grupo | Elemento na toolbar | Para que serve | Configurações exibidas |
|---|---|---|---|
| Eventos | **Início** | Define a entrada da solicitação. | Informações gerais, formulário, botões, assinaturas e rotinas. |
| Eventos | **Fim** | Marca o encerramento de um caminho. | Informações gerais. |
| Atividades | **Tarefa humana** | Interrompe o avanço até que uma pessoa conclua a etapa. | Informações gerais, formulário, botões, responsáveis e prazos, assinaturas e rotinas. |
| Atividades | **Tarefa de script** | Executa uma fonte de dados de forma automática e segue o fluxo. | Informações gerais e fonte de dados. |
| Atividades | **Atividade de serviço (fonte de dados)** | Representa uma integração automática associada a uma fonte. | Informações gerais, fonte de dados e rotinas. |
| Atividades | **Subprocesso** | Representa a chamada de outro processo. | Informações gerais, processo chamado, sincronia, cópia de valores, mensagens, multi-processos e rotinas. |
| Eventos intermediários | **Evento de e-mail** | Dispara um modelo de e-mail durante o percurso. | Informações gerais, template e rotinas. |
| Eventos intermediários | **Evento de timer** | Representa uma espera por data, dia, horas ou dias. | Informações gerais, temporizador e rotinas. |
| Eventos intermediários | **Evento de marco** | Abre, abre e fecha ou fecha um marco da execução. | Informações gerais, ação, nome do marco e rotinas. |
| Gateways | **Desvio condicional exclusivo** | Escolhe um único caminho. | Informações gerais, destinos e condição de cada saída. |
| Gateways | **Desvio condicional inclusivo** | Pode abrir um ou mais caminhos cujas condições sejam atendidas. | Informações gerais, destinos e condição de cada saída. |
| Gateways | **Desvio de paralelismo** | Abre todos os ramos conectados. | Informações gerais e tarefas de destino. |
| Gateways | **Convergência de paralelismo** | Reúne ramos e aguarda sua conclusão. | Informações gerais e tarefas de origem. |
| Organização | **Piscina (raias/setores)** | Organiza o processo por participantes, unidades ou setores. | Estrutura visual; as raias alimentam o campo Setor do Início e das tarefas humanas. |

### Estado de execução confirmado

A toolbar permite configurar todos os elementos acima, mas a execução atual não trata todos com a mesma profundidade. Esta distinção é necessária para que o manual reflita o código do produto:

| Elemento | Comportamento confirmado no motor atual |
|---|---|
| Início | Entra no fluxo e avança pelas conexões. |
| Tarefa humana | Cria uma tarefa pendente, resolve responsável e prazo e aguarda conclusão. |
| Tarefa de script | Executa a fonte configurada; registra a etapa como concluída; uma fonte ausente ou uma falha interrompe a execução. |
| Evento de e-mail | Resolve o template e os destinatários e tenta enviar a mensagem; uma falha de envio é registrada sem interromper o fluxo. |
| Gateways exclusivo, inclusivo e paralelo | Avaliam caminhos condicionais ou controlam abertura e reunião dos ramos. |
| Fim | Encerra o caminho; a instância é concluída quando não existem tarefas pendentes. |
| Atividade de serviço | A fonte pode ser configurada e persistida, mas o percurso atual apenas atravessa o elemento; a execução da fonte não está confirmada nesse tipo. |
| Subprocesso | As opções podem ser configuradas e persistidas, mas a chamada de outro processo não está confirmada no percurso atual. |
| Timer | As opções podem ser configuradas e persistidas, mas a espera temporal não está confirmada no percurso atual. |
| Marco | As opções podem ser configuradas e persistidas, mas a mudança de estado do marco não está confirmada no percurso atual. |
| Rotinas | Os quatro vínculos são persistidos, mas a execução desses ganchos não foi localizada no motor atual. |

> **Cuidado especial**
> Não publique um processo que dependa de um comportamento marcado como “não confirmado”. Use homologação e valide o resultado com a equipe técnica. Para automação por fonte de dados com execução confirmada, o tipo tratado atualmente pelo motor é **Tarefa de script**.

## Para que serve cada elemento

### Início

Use **Início** como ponto de entrada do processo. Ele representa o formulário enviado pelo requisitante e aparece como a primeira coluna de **Tarefas × Campos**.

O painel permite configurar:

- **Informações gerais:** sigla, nome, setor e descrição;
- **Configuração do formulário:** campos ocultos, visíveis ou editáveis e fontes por campo;
- **Botões de ação:** o primeiro botão sugerido é **Enviar requisição**;
- **Assinaturas:** documentos que precisam ser assinados antes do envio;
- **Rotinas:** fontes vinculadas aos momentos de criação e finalização.

O Início precisa ter ao menos uma conexão de saída. Em um serviço externo, confira se os campos necessários ao protocolo estão editáveis nessa etapa e se dados internos estão ocultos.

### Fim

Use **Fim** para tornar explícito onde um caminho se encerra. Ele oferece apenas **Informações gerais**. Um Fim sem conexão de entrada gera aviso porque não pode ser alcançado.

O motor conclui a instância quando não restam tarefas pendentes. Portanto, em fluxos paralelos, confira se todos os ramos esperados foram reunidos ou encerrados adequadamente.

### Tarefa humana

Use **Tarefa humana** quando uma pessoa precisar analisar, decidir, preencher, assinar ou complementar informações. A execução para nessa etapa até que o responsável use um botão de conclusão.

Configure, nesta ordem:

1. nome e sigla que identifiquem a ação;
2. setor, quando o diagrama usar raias;
3. campos que o executor consulta ou edita;
4. botões e a validação exigida por cada resultado;
5. responsável e prazo;
6. anexos que exigem assinatura;
7. rotinas relacionadas ao ciclo da tarefa.

Depois, teste com o responsável real ou com um perfil equivalente. Na simulação, todas as tarefas são concentradas na pessoa que iniciou o teste, portanto ela não comprova a distribuição em produção.

### Tarefa de script

Use **Tarefa de script** para executar automaticamente uma fonte de dados no meio do fluxo. Apesar do nome BPMN, a interface não recebe código diretamente: ela solicita uma **Fonte de dados a ser executada**.

Selecione uma fonte cadastrada, atualize a lista se ela tiver sido criada em outra aba e salve. O servidor exige uma fonte para esse tipo e impede a publicação quando ela não está configurada. Durante a execução, o motor monta o contexto do processo, executa a fonte e só então avança. Se a fonte não existir ou falhar, a execução é interrompida com erro.

Exemplo: depois da análise, executar uma fonte que registra o resultado em um sistema integrado. Teste sucesso, indisponibilidade, resposta inválida e repetição para avaliar idempotência.

### Atividade de serviço

Use **Atividade de serviço (fonte de dados)** para representar visualmente uma integração automática. O painel oferece **Fonte de dados** e **Rotinas**.

Na versão de código inspecionada, o motor percorre esse elemento sem executar sua fonte específica. A configuração pode ser preparada, mas um processo que dependa da integração deve usar uma alternativa com execução validada ou aguardar a conclusão funcional desse tipo.

### Subprocesso

Use **Subprocesso** quando um processo precisar chamar outro fluxo reutilizável. Seu painel possui:

- **Processo:** chave da definição chamada;
- **Síncrono:** o processo principal deveria aguardar o subprocesso terminar;
- **Assíncrono:** o processo principal deveria disparar a chamada e continuar;
- **Copiar valores do formulário:** replica valores do pai para o filho;
- **Visualizar mensagens do processo-pai:** disponibiliza as mensagens relacionadas;
- **Multi-processos:** usa um agrupamento do formulário para disparar uma instância por item;
- **Rotinas:** vínculos de fonte nos momentos do elemento.

Exemplo: para cada item de uma lista de unidades, abrir um subprocesso de vistoria. A chave do processo e a chave do agrupamento precisam existir e permanecer estáveis.

Na execução atual inspecionada, a chamada ainda não está confirmada. Trate esse elemento como configuração pendente de validação técnica.

### Evento de e-mail

Use **Evento de e-mail** quando o processo precisar enviar uma comunicação sem criar uma tarefa humana. Selecione o **Template a ser executado**. O modelo cadastrado define assunto, conteúdo e destinatários e pode usar os dados disponíveis no contexto do processo.

O envio ocorre quando o fluxo atravessa o evento. Endereços são deduplicados e, se nenhum destinatário for resolvido, a mensagem não é enviada. Falhas de e-mail não abortam o processo, por isso consulte os registros de envio durante a homologação.

Exemplo: depois que a análise solicitar complementação, enviar ao requerente um e-mail com número da solicitação e orientação de acesso.

### Evento de timer

Use **Evento de timer** para representar uma espera. Escolha um tipo:

- **Aguardar até uma data específica**, no formato indicado `DD/MM/AAAA`;
- **Aguardar até um dia específico**, com dia do mês entre 1 e 31;
- **Aguardar um número específico de horas**;
- **Aguardar um número específico de dias**.

Em **Origem do valor**, escolha **Fixa** para digitar o valor ou **Dinâmica** para informar a chave de um campo do formulário. Ao alternar a origem, o editor limpa o valor da outra modalidade para evitar duas fontes concorrentes.

Na execução atual, o motor apenas atravessa o timer. Não use essa configuração como garantia de espera até que o comportamento seja implementado e validado.

### Evento de marco

Um marco representa um ponto de acompanhamento da execução. Escolha a ação **Abrir**, **Abrir e fechar** ou **Fechar**. Depois selecione um marco já usado no processo ou escolha **Outro…** para informar um novo nome.

Para fechar um marco, use exatamente o mesmo nome usado em sua abertura. Nomes diferentes criam referências distintas. A execução dessa mudança de estado ainda não está confirmada no motor atual.

### Desvio condicional exclusivo

Use o gateway exclusivo quando apenas um caminho deve continuar. Cada conexão de saída aparece em **Tarefas de destino** e possui o botão **Configurar**.

Defina condições que não se sobreponham e configure uma única saída como **Quando nenhuma das demais regras for atendida**. Sem caminho padrão, uma solicitação que não corresponda a nenhuma regra pode ficar sem destino; com mais de um padrão, o diagrama contém erro.

### Desvio condicional inclusivo

Use o gateway inclusivo quando uma ou mais saídas podem ser verdadeiras ao mesmo tempo. O motor percorre todas as saídas cujas regras forem atendidas.

> **Limitação da versão inspecionada**
> A saída marcada como **Quando nenhuma das demais regras for atendida** também é percorrida quando outras regras do gateway inclusivo são verdadeiras. Portanto, não use uma saída padrão nesse tipo de gateway em processo produtivo até que esse comportamento seja corrigido e homologado. Se o processo precisar de uma alternativa exclusiva, modele a decisão com um gateway exclusivo ou garanta por teste que as regras cobrem todos os casos.

Exemplo: uma solicitação pode exigir simultaneamente análise ambiental e análise urbanística. Modele cada ramo e defina como eles serão reunidos antes da conclusão.

### Paralelismo e convergência

Use **Desvio de paralelismo** para abrir todas as saídas sem avaliar condições. Use **Convergência de paralelismo** para reunir ramos.

O mesmo tipo BPMN representa abertura e reunião. O painel identifica uma convergência quando o elemento tem mais de uma entrada e ao menos tantas entradas quanto saídas. Na reunião, o motor aguarda as tarefas humanas dos ramos anteriores; o último ramo concluído libera a continuidade.

Não configure condições em um gateway paralelo. Se a abertura depender de dados, use um gateway exclusivo ou inclusivo.

### Piscina e raias

Use **Piscina (raias/setores)** para organizar visualmente responsabilidades. Depois de criar a piscina, selecione-a e use as ações padrão do bpmn-js para adicionar uma raia acima, abaixo ou dividir a estrutura.

Nomeie cada raia com o setor correspondente, como **Requerente**, **Protocolo** e **Licenciamento**. No painel do **Início** e da **Tarefa humana**, clique em atualizar ao lado de **Setor** e selecione a raia.

Mover uma tarefa para dentro de uma raia ajuda a leitura, mas a atribuição efetiva também depende de **Responsáveis e prazos**. Não use a posição visual como única regra de distribuição.

### Conexões

As setas definem a direção do fluxo. Selecione uma conexão para editar suas informações gerais; quando ela sair de gateway condicional, abra o gateway e configure a regra pelo destino correspondente.

Um rótulo como **Aprovado** ou **Precisa complementar** explica o desenho, mas não cria a condição operacional.

<a id="processos-botoes"></a>

## Configurando uma tarefa humana

Selecione **Analisar documentação** no canvas. O painel à direita apresenta seis seções. As alterações em campos de texto são confirmadas quando você sai do campo; seletores, opções e chaves de alternância são aplicados imediatamente. O indicador **Alterações pendentes** permanece até o processo ser salvo no servidor.

<a id="processos-informacoes-elemento"></a>

### Informações gerais

Essa seção é reutilizada pela maioria dos elementos.

| Campo | Finalidade | Como preencher |
|---|---|---|
| **Sigla** | Identificador curto usado em integrações e relatórios. | Use um valor estável e reconhecível, como `analise_documental`. |
| **Nome** | Texto exibido no diagrama e nas tarefas. | Escreva uma ação, como **Analisar documentação**. |
| **Setor** | Relaciona o Início ou a tarefa humana a uma raia do processo. | Selecione uma raia existente; use atualizar se acabou de criá-la. |
| **Descrição** | Registra uma explicação opcional sobre o elemento. | Informe objetivo, critério de conclusão ou orientação para manutenção do fluxo. |

A sigla não deve ser alterada sem verificar referências externas. O nome pode ser mais legível para usuários, enquanto a sigla permanece estável para integrações.

<a id="processos-formulario-elemento"></a>

### Configuração do formulário

Essa seção aparece no **Início** e nas **Tarefas humanas**. Ela lista os campos agrupados como no editor de formulário e permite configurar cada um separadamente.

1. Localize o campo.
2. Selecione **Oculto**, **Visível** ou **Editável**.
3. Se o campo precisar ser alimentado por uma fonte nesta etapa, clique no ícone de banco de dados.
4. Selecione a fonte e clique em **Confirmar**. Use **Cancelar** para fechar sem aplicar a nova seleção.

A fonte é opcional e só pode ser vinculada quando o campo não está oculto. Para campos de seleção, ela fornece opções. Para outros campos, a execução pode usar o primeiro valor retornado para preencher o dado quando ele estiver vazio ou não estiver editável.

> **Exemplo**
> Na tarefa **Analisar documentação**, deixe **Razão social** visível, **Parecer técnico** editável e **CNPJ** visível. Uma fonte de consulta pode preencher uma classificação auxiliar sem permitir que o servidor sobrescreva o resultado.

Essa configuração por elemento e a aba **Tarefas × Campos** editam a mesma relação. Use o painel quando estiver concentrado em uma tarefa e a matriz quando quiser comparar várias etapas.

<a id="processos-responsaveis-prazos"></a>

### Responsáveis e prazos

Essa seção aparece somente em **Tarefas humanas**. Ela define a pessoa que receberá a tarefa, o prazo e as mensagens relacionadas.

#### Respeitar horas úteis

Quando ativado, o prazo conta somente as horas contidas no expediente e nos dias úteis configurados nos parâmetros do tenant. Quando desativado, o prazo é somado em horas corridas a partir da criação da tarefa.

Exemplo: uma tarefa com 8 horas pode vencer no mesmo dia ou no próximo, conforme o horário de criação e o expediente configurado. Não presuma o resultado sem consultar esses parâmetros.

#### Mensagem de recebimento

**Enviar mensagem de recebimento** solicita o envio de uma notificação ao responsável quando a tarefa é criada. O envio depende de responsável resolvido, endereço disponível e configuração de e-mail do ambiente. A falha de comunicação não deve ser confundida com falha de criação da tarefa.

#### Mensagem de prazo a expirar

Ao ativar **Enviar mensagem de prazo a expirar**, aparece o **Cronograma de alertas**. Clique em **Adicionar alerta** e configure:

| Campo | Opções | Efeito |
|---|---|---|
| **Tipo** | Único ou Repetido. | Define se o alerta acontece uma vez ou volta a ocorrer em intervalo. |
| **Disparo** | Depois de N horas; depois de N dias; faltando N horas; faltando N dias. | Define o ponto usado para calcular o envio. |
| **Quantidade (N)** | Número inteiro igual ou maior que zero. | Informa a quantidade usada pelo disparo. |
| **Intervalo (horas)** | Exibido somente no tipo Repetido; mínimo de 1. | Define a distância entre repetições. |

Use alertas “faltando” somente quando a tarefa tiver prazo calculável. Para evitar excesso de mensagens, escolha um intervalo proporcional ao prazo total.

#### Responsável

Escolha uma das modalidades:

| Modalidade | Como é resolvida | Quando usar |
|---|---|---|
| **Requisitante** | A tarefa é atribuída à pessoa que iniciou a solicitação. | Complementação de dados pelo solicitante. |
| **Outro — unidade organizacional e posição** | Primeiro selecione a unidade; depois a posição disponível nela. | Trabalho de um cargo ou função interna. |
| **Usuário selecionado em campo do formulário** | O valor do campo deve identificar um usuário reconhecido pelo sistema. | Quando o responsável é escolhido durante o preenchimento. |
| **Utilizar fonte de dados** | A configuração referencia uma fonte de dados. | Quando a atribuição depende de uma consulta controlada. |

Na execução atual, unidade/posição e campo do formulário possuem resolução confirmada. Se uma posição não encontrar usuário ou o campo não contiver um identificador válido, o motor usa o requisitante como alternativa. A atribuição por fonte de dados aparece na interface, mas a resolução atual também recai no requisitante; valide antes de depender dela.

#### Prazo fixo ou por campo

Em **Prazo (horas)**, informe um valor fixo. O controle aceita passos de 0,5 hora. Em **…OU CAMPO**, selecione o campo que fornecerá o prazo. Ao escolher um campo, o prazo fixo é limpo para que apenas uma origem permaneça.

Use um campo numérico e documente sua unidade. Um campo chamado apenas **Prazo** pode ser interpretado como dias, horas ou data; prefira **Prazo de análise em horas**.

Depois de salvar, verifique:

1. uma conta que deve receber a tarefa consegue encontrá-la;
2. uma conta sem a atribuição não recebe a mesma tarefa;
3. o vencimento calculado corresponde às horas úteis ou corridas esperadas;
4. alertas não são disparados antes da criação nem depois da conclusão;
5. a alternativa usada quando o responsável não é localizado é aceitável para o processo.

### Botões de ação

Os botões representam os resultados disponíveis ao usuário. O Início sugere **Enviar requisição** e a tarefa humana sugere **Concluir**, mas você pode criar vários botões. Na análise do exercício:

| Botão | Quando usar | Encaminhamento esperado |
|---|---|---|
| **Concluir análise** | A documentação está suficiente para seguir. | Caminho de conclusão. |
| **Solicitar complementação** | Faltam dados ou anexos. | Tarefa Complementar informações. |

Cada botão possui:

| Campo | Finalidade | Regra de uso |
|---|---|---|
| **Nome** | Texto apresentado ao executor. | Descreva a consequência, como **Solicitar complementação**. |
| **Id** | Valor técnico usado nas condições do gateway. | É derivado do nome até ser personalizado; mantenha-o único na tarefa. |
| **Cor primária** | Cor de fundo do botão. | Use a paleta ou uma cor personalizada sem perder contraste. |
| **Cor do texto** | Cor do rótulo e do ícone. | Confira legibilidade sobre a cor primária. |
| **Ícone** | Reforça visualmente a ação. | Escolha um símbolo coerente; o texto continua obrigatório para clareza. |
| **Orientações** | Aviso rico exibido ao executor ao passar o cursor. | Explique quando usar e qual será o efeito. Não dependa apenas do hover para informação essencial. |
| **Validar campos** | Impede conclusão quando os campos obrigatórios estão incompletos ou inválidos. | Mantenha ativo nas ações que efetivam a etapa. |
| **Obrigar justificativa** | Exige que o executor detalhe o motivo da escolha. | Use em rejeição, cancelamento, devolução ou decisão que precise de registro. |

O Id é atualizado automaticamente se ainda correspondia ao nome anterior. Depois de uma personalização manual, ele permanece estável quando o Nome muda. Alterar um Id já usado exige revisar todas as condições que o referenciam.

O primeiro botão não pode ser removido; botões adicionais podem. As regras de validação e justificativa são conferidas pelo servidor, não apenas pela tela.

> **Importante**
> Criar um botão não cria uma tarefa nem vincula automaticamente uma saída do gateway. Configure também a condição da conexão.

Evite **OK**, **Avançar** e **Confirmar** quando esses termos não informarem a consequência. O usuário deve entender o que acontecerá antes de clicar.

<a id="processos-assinaturas"></a>

### Assinaturas

A seção aparece no **Início** e nas **Tarefas humanas**. Escolha **Não utilizar assinatura** ou **Utilizar assinatura eletrônica**.

Ao ativar a assinatura:

1. abra **Campos a serem assinados**;
2. pesquise e selecione um ou mais campos de upload;
3. confira a lista de campos escolhidos;
4. remova referências incorretas pelo botão de remoção;
5. defina se a assinatura é obrigatória;
6. defina se os documentos podem ser assinados em lote.

Somente campos do tipo anexo aparecem como opções. Se um campo gravado anteriormente não existir mais no formulário, ele permanece visível com o aviso **campo não encontrado no formulário** para permitir correção sem apagar a configuração silenciosamente.

**Assinatura obrigatória** bloqueia os botões que possuem **Validar campos** enquanto existir documento configurado ainda não assinado. Um botão sem validação, como uma devolução, pode continuar disponível. **Permitir que os documentos sejam assinados em lote** acrescenta a ação **Assinar documentos em lote** antes dos botões de conclusão.

Na execução, somente o responsável pela tarefa ativa pode assinar. Teste campo sem arquivo, documento já assinado, alteração do arquivo depois da assinatura, assinatura individual e assinatura em lote.

<a id="processos-rotinas"></a>

### Rotinas

Rotinas associam fontes de dados a quatro momentos do ciclo do elemento:

| Rotina | Momento pretendido | Exemplo de uso |
|---|---|---|
| **Pré-criação da tarefa** | Antes de criar a etapa. | Preparar dados usados na criação ou atribuição. |
| **Pós-criação da tarefa** | Depois que a etapa foi criada. | Registrar a abertura em uma integração. |
| **Pré-finalização da tarefa** | Antes de concluir a etapa. | Validar ou enviar os dados antes do avanço. |
| **Pós-finalização da tarefa** | Depois da conclusão. | Notificar outro sistema sobre o resultado. |

Clique em **Nova fonte de dados** para abrir o cadastro em outra aba. Depois retorne, atualize a lista do seletor e escolha a fonte em cada momento necessário. Use **Nenhuma** para remover o vínculo.

Evite configurar a mesma operação em dois momentos sem uma razão explícita. Uma rotina pode ser executada novamente após repetição ou retomada de uma etapa; a fonte deve tratar duplicidade quando a operação externa não puder se repetir.

Na versão atual inspecionada, os vínculos são salvos na definição, mas sua chamada não foi localizada no motor. Eles devem permanecer fora de processos produtivos até a execução ser confirmada.

### Fontes de dados

O mesmo seletor de fonte aparece em contextos diferentes, mas a consequência muda conforme o local da configuração. Antes de escolher uma fonte, identifique quem vai consumi-la.

| Onde a fonte é selecionada | Finalidade pretendida | Estado confirmado na versão inspecionada |
|---|---|---|
| **Tarefa de script** | Executar a consulta ou integração como uma etapa automática do fluxo. | O motor executa a fonte e impede o avanço se a referência estiver ausente ou a execução falhar. |
| **Atividade de serviço** | Representar uma chamada de sistema vinculada à fonte. | A seleção é salva, mas o motor atual apenas atravessa o elemento. |
| **Configuração do formulário** do Início ou de uma tarefa humana | Carregar opções ou preencher um campo naquela etapa. | A execução consulta a fonte; campos de opções recebem pares de valor e rótulo e outros campos podem receber o primeiro resultado. |
| **Responsáveis e prazos — Utilizar fonte de dados** | Resolver dinamicamente o responsável pela tarefa. | A opção é salva, mas a resolução atual usa o requisitante como alternativa. |
| **Rotinas** | Chamar uma fonte antes ou depois da criação ou conclusão do elemento. | O vínculo é salvo; a chamada não foi localizada no motor. |

O seletor permite pesquisar pelo nome, escolher **Nenhuma**, atualizar a lista e, quando autorizado, abrir **Nova fonte de dados** em outra aba. Fontes existentes também podem oferecer uma ação de edição. Se você criar ou alterar uma fonte em outra aba, retorne ao modelador e atualize a lista antes de selecioná-la.

Ao configurar uma fonte:

1. confira se está no contexto correto — tarefa automática, campo, responsável ou rotina;
2. pesquise pelo nome e selecione a fonte desejada;
3. salve o processo para persistir a referência;
4. teste com dados que retornem resultado, nenhum resultado e erro;
5. altere a fonte somente depois de localizar todos os elementos e campos que a referenciam.

Para um campo de seleção, a fonte precisa devolver valores que a execução consiga transformar em opção. Confira tanto o valor armazenado quanto o rótulo apresentado ao usuário. Para preenchimento de campo comum, confirme qual coluna do primeiro registro é usada e se um valor que o usuário já informou pode ser preservado. Para tarefa de script, trate uma resposta vazia como um caso diferente de falha técnica.

> **Exemplo**
> Uma fonte chamada **Consultar atividades econômicas** pode fornecer as opções do campo **Atividade principal**. Teste uma consulta com opções, outra sem resultados e uma indisponibilidade. O formulário deve permitir distinguir “não há atividades para este critério” de “não foi possível consultar a fonte”.

Alterar o nome visível da fonte não deveria exigir remodelar o processo quando sua referência técnica permanece a mesma. Excluir ou substituir a fonte pode deixar referências inválidas. Faça essa manutenção primeiro em homologação e confira o diagnóstico, a simulação e uma execução representativa.

<a id="processos-condicoes"></a>

## Configurando decisões e condições

Selecione uma conexão de saída do gateway e abra o editor de condições. Cada saída pode depender da ação usada na tarefa, de valores do formulário ou da combinação desses critérios.

### Condição baseada em botão

No caminho para **Complementar informações**, selecione o botão **Solicitar complementação**. Essa configuração associa a escolha feita pelo servidor ao encaminhamento esperado.

### Condição baseada em campo

Quando a decisão depender de um dado, selecione o campo, o operador e o valor de comparação. Confirme que a chave corresponde ao dado desejado e que o valor comparado tem o mesmo significado do valor armazenado.

Exemplo: uma saída pode ser usada quando **decisao_analise** possuir o valor associado a **Aprovado**. O texto mostrado e o valor gravado podem ser diferentes quando as opções vêm de uma fonte de dados; teste com o dado efetivamente armazenado.

Os operadores disponíveis são:

| Operador | Avaliação | Exemplo |
|---|---|---|
| **igual a** | Os valores precisam ser idênticos. | `situacao` igual a `aprovado`. |
| **diferente de** | O valor armazenado não pode ser igual ao informado. | `situacao` diferente de `cancelado`. |
| **maior que** | Compara dois valores numéricos. | `valor` maior que `1000`. |
| **menor que** | Compara dois valores numéricos. | `dias` menor que `30`. |
| **maior ou igual a** | Aceita o limite e valores superiores. | `pontuacao` maior ou igual a `70`. |
| **menor ou igual a** | Aceita o limite e valores inferiores. | `risco` menor ou igual a `2`. |
| **contém** | Procura o texto informado dentro do valor, sem diferenciar maiúsculas e minúsculas. | `atividade` contém `cerâmica`. |
| **começa com** | Verifica o início do texto, sem diferenciar maiúsculas e minúsculas. | `protocolo` começa com `LIC-`. |

As comparações numéricas usam formato invariável no motor. Para valores decimais, confirme em homologação qual representação é enviada pelo campo e evite inserir símbolos monetários no valor da regra.

### Combinação de regras

Use **E** quando todas as condições precisarem ser verdadeiras. Use **OU** quando qualquer uma for suficiente.

- **E:** o servidor clicou em Concluir análise **e** o parecer está favorável.
- **OU:** a solicitação exige complementação por decisão do servidor **ou** por ausência de um documento determinante.

Quanto mais regras forem combinadas, mais importante será testar valores vazios, opções não previstas e condições que possam ser verdadeiras ao mesmo tempo.

O editor permite abrir e fechar grupos com parênteses. Sem parênteses, **E** é avaliado antes de **OU**. Por exemplo:

`botão Concluir E (parecer = favorável OU dispensa = sim)`

Agrupe expressões sempre que houver combinação de **E** e **OU** e registre o cenário esperado na descrição do gateway.

### Caminho padrão

O caminho padrão, também chamado **else**, recebe os casos que não atendem às demais regras. Configure apenas uma saída padrão para o mesmo ponto de decisão.

No gateway exclusivo, o motor procura primeiro uma regra correspondente e depois o caminho padrão. Existe ainda uma saída de segurança para a primeira conexão quando nenhum caminho é encontrado, mas o modelador não deve depender desse comportamento: mantenha as regras completas e um único **else**.

**Teste mínimo da decisão:**

1. um caso que deve seguir para conclusão;
2. um caso que deve solicitar complementação;
3. um caso com o campo relevante vazio;
4. um caso em que duas regras poderiam coincidir.

<!-- PRINT: editor de condições mostrando botão, regra de campo e caminho padrão. -->

<a id="processos-acesso"></a>

## Configurando a apresentação e o acesso

Abra **Configurações** para definir como o processo será identificado e quem poderá utilizá-lo.

### Informações gerais — Identificação

| Campo | Onde aparece ou para que serve | Orientação |
|---|---|---|
| **Nome** | Barra do modelador, listagens e identificação do serviço. | Use o mesmo nome pelo qual o público reconhece o procedimento. |
| **Categoria** | Agrupa o processo nas áreas de navegação e serviço. | Escolha uma categoria cadastrada e coerente com o catálogo do órgão. |
| **Unidade organizacional responsável** | Identifica a secretaria, órgão ou unidade dona do processo. | Selecione quem responde pela manutenção e pelo atendimento. |
| **URL da documentação** | Direciona para orientações específicas do processo. | Informe endereço completo com `https://` e mantenha o conteúdo atualizado. |
| **Ícone** | Representa visualmente o serviço. | Selecione um ícone reconhecível e mantenha um nome que funcione sem ele. |
| **Descrição** | Aparece nas listagens e aceita texto formatado, listas e links. | Explique finalidade, público, informações necessárias e resultado esperado. |
| **Inbox / resumo da requisição** | Cria a identificação curta da instância nas listagens. | Combine texto e variáveis que diferenciem solicitações. |

O resumo aceita variáveis qualificadas como:

- `{{formulario.titulo}}` para um campo do formulário;
- `{{requisitante.nome}}` e `{{requisitante.email}}`;
- `{{processo.nome}}` e `{{processo.numero}}`.

Exemplo:

```html
<strong>{{formulario.razao_social}}</strong> — processo {{processo.numero}}
```

Use somente chaves existentes. Depois de alterar a chave de um campo, revise o resumo.

O resumo aceita formatação HTML básica, como negrito, itálico, listas e quebras de linha. Ao salvar uma alteração nesse resumo, ela passa a valer para as requisições de todas as versões do mesmo processo, inclusive as já abertas ou concluídas. Limpar o resumo também remove sua exibição nessas requisições. Essa configuração de apresentação é compartilhada; o fluxo, o formulário e as permissões da execução continuam vinculados à versão em que ela começou. Os valores preenchidos nos campos são exibidos como texto, mesmo quando contêm caracteres de HTML.

### Informações gerais — Publicação e permissões

O campo **Status** possui três opções:

- **Rascunho:** permanece em construção e não aparece para usuários finais;
- **Publicado:** fica disponível para novas solicitações de acordo com o acesso e a Central de serviços;
- **Inativo:** preserva o histórico e bloqueia novas instâncias.

As permissões durante a execução controlam recursos da instância:

| Opção | Efeito |
|---|---|
| **Permitir inserção de mensagens nas execuções** | Habilita mensagens relacionadas à solicitação. |
| **Permitir cancelamento do processo** | Permite cancelar a instância conforme a autorização do usuário. |
| **Publicar na Central de serviços (exige login)** | Exibe o serviço na vitrine pública, mas exige autenticação para enviar. |
| **Permitir requisições anônimas (portal)** | Também publica na Central e permite envio sem login, com verificação anti-robô. |

Ative o envio anônimo somente quando o procedimento admitir solicitante sem conta e quando a equipe tiver definido identificação, acompanhamento, proteção contra abuso e tratamento de dados.

### Controle de acesso

Cada regra combina quatro decisões:

1. **Aplicar a:** Todos os usuários, Usuário específico, Perfil de acesso, Unidade organizacional, Posição ou Unidade + posição;
2. **Valor:** pessoa, perfil, unidade e/ou posição correspondente;
3. **Capacidade:** Ver / iniciar, Editar, Cancelar ou Excluir;
4. **Ação:** Permitir ou Bloquear.

Sem regras, ninguém vê o processo, exceto administradores. **Bloquear** funciona como exceção e vence **Permitir**. Administradores sempre acessam.

| Necessidade | Regra sugerida |
|---|---|
| Serviço disponível a qualquer usuário autenticado | Todos os usuários + Ver / iniciar + Permitir. |
| Licenciamento disponível apenas a um perfil externo | Perfil de acesso correspondente + Ver / iniciar + Permitir. |
| Servidores de uma unidade podem editar instâncias | Unidade organizacional + Editar + Permitir. |
| Uma posição não pode cancelar | Unidade + posição + Cancelar + Bloquear. |

Ao trocar o tipo de uma regra, os valores específicos anteriores são limpos. Se a opção depender de posição, selecione primeiro a unidade. Remova regras obsoletas em vez de deixá-las com valor incompleto. Valide com contas não administrativas.

> **Exemplo**
> O processo pode ser visível para o público externo previsto, enquanto a edição do modelo continua restrita à equipe do órgão. A capacidade de iniciar o serviço não concede acesso ao modelador.

<a id="processos-matriz"></a>

## Definindo o uso dos campos em cada tarefa

Abra **Tarefas × Campos** para controlar a exposição dos dados. As linhas representam campos do formulário e as colunas representam o início e as tarefas humanas.

| Estado | Comportamento esperado |
|---|---|
| **Oculto** | O campo não é apresentado naquela etapa. |
| **Visível** | O usuário consulta o valor, sem alterá-lo. |
| **Editável** | O usuário pode preencher ou modificar o valor. |

No exercício:

- **Razão social** é editável no início e visível na análise;
- **Parecer técnico** fica oculto no início e editável em Analisar documentação;
- o requerente consulta o motivo da complementação, mas não altera o parecer interno.

Use ações em lote quando vários campos tiverem a mesma regra, mas revise as exceções antes de salvar. Um campo visível em relatório ou para o requisitante pode participar de outras regras; confirme o resultado na execução e não avalie a privacidade somente pela matriz.

> **Cuidado especial**
> Informações internas, dados pessoais e documentos restritos precisam ser verificados em todas as etapas, relatórios e visões do requisitante.

<a id="processos-publicacao"></a>

## Salvando, testando e publicando

### Entenda o ciclo das versões

| Situação | O que acontece ao salvar | O que os usuários finais utilizam |
|---|---|---|
| Processo novo | É criada a primeira versão como rascunho. | Nada, enquanto não houver publicação. |
| Rascunho existente | A versão corrente é atualizada. | Nada, enquanto permanecer rascunho. |
| Processo publicado sem alterações | A produção continua na versão publicada. | Versão publicada. |
| Processo publicado que recebeu alterações | O salvamento cria ou atualiza uma versão em homologação. | A produção permanece na versão publicada anterior. |
| Publicação | O conteúdo atual é salvo e a versão retornada é marcada como publicada. | Nova versão publicada. |

O selo **Em homologação · vN** informa que você está editando uma versão de teste. Passe o cursor sobre o selo para consultar a explicação. A versão publicada continua atendendo a produção até o uso de **Publicar**.

### Salve o trabalho

Clique em **Salvar** e aguarde a confirmação. Se ocorrer falha, preserve o contexto exibido, confira a conexão e tente novamente. Não feche a página enquanto houver alterações pendentes.

As confirmações distinguem rascunho, conteúdo publicado e homologação. O servidor também pode retornar avisos; leia a quantidade informada e consulte o diagnóstico.

> **Cuidado especial**
> No código atual, `Ctrl/Cmd + S` exporta o arquivo BPMN; ele não aciona o botão **Salvar**. Para gravar no servidor, use o botão visível na barra superior.

### Teste os caminhos

Use a ação de teste disponível no modelador. Quando houver escolha entre produção e homologação, confirme qual definição será executada. Uma instância de teste deve estar identificada para não ser confundida com atendimento real.

Percorra:

- preenchimento completo e conclusão;
- solicitação de complementação;
- retorno da complementação para análise;
- tentativa com campo obrigatório vazio;
- usuário sem acesso ou sem atribuição;
- dados usados no resumo, nas condições e em documentos.

O teste feito pela conta administrativa não comprova a experiência do público externo nem a distribuição de tarefas. Repita os cenários com perfis representativos.

### Publique a versão

Publique somente depois de revisar fluxo, formulário, matriz e acesso. Confirme a versão disponibilizada e faça uma verificação curta na Central de serviços e nas caixas de trabalho.

Se um processo publicado for alterado, trate a mudança como uma nova versão em homologação. Avalie também o efeito sobre solicitações em andamento.

Erros de validação retornados pelo servidor impedem a operação. Falta de permissão é apresentada separadamente; conflito de versão retorna a descrição informada pela API. Corrija a causa em vez de repetir a publicação sem revisar o estado.

<a id="processos-recursos"></a>

## Importando, exportando e consultando versões

### Importar

**Importar fluxo** aceita arquivos `.bpmn` e `.xml`. Faça a importação em um processo de teste, confira o arquivo e leia o aviso antes de confirmar. Depois, revise configurações específicas do Septem, como responsáveis, formulário, acesso e condições. A mensagem **Fluxo “nome-do-arquivo” importado** confirma a leitura; falha de conteúdo produz **Não foi possível importar este arquivo BPMN**.

### Exportar BPMN

**Exportar fluxo** sincroniza o formulário com o XML e baixa a definição BPMN. O arquivo representa o modelo e suas extensões, mas as referências apontam para cadastros do ambiente, como fontes, usuários, unidades, templates e processos. Transportar o XML não transporta esses cadastros.

### Exportar PNG

**Salvar como imagem (PNG)** gera uma representação visual para revisão ou documentação. O PNG não pode ser reimportado e não substitui o arquivo BPMN.

### Versões

**Versionar processo** cria explicitamente uma nova versão com o conteúdo atual. Use quando precisar preservar um ponto identificável de evolução, e não como substituto do salvamento rotineiro. Consulte o histórico para identificar a definição publicada e a versão em edição. Antes de restaurar ou substituir conteúdo, verifique qual trabalho será afetado.

### Atalhos de teclado

Os atalhos são ignorados enquanto o foco estiver em campos de texto, seletores editáveis ou áreas de texto.

| Windows/Linux | macOS | Ação |
|---|---|---|
| `Ctrl + 1` | `Cmd + 1` | Abrir Fluxo. |
| `Ctrl + 2` | `Cmd + 2` | Abrir Formulário. |
| `Ctrl + 3` | `Cmd + 3` | Abrir Tarefas × Campos. |
| `Ctrl + 4` | `Cmd + 4` | Abrir Configurações. |
| `Ctrl + O` | `Cmd + O` | Importar fluxo. |
| `Ctrl + S` | `Cmd + S` | Exportar fluxo BPMN. |
| `Ctrl + Shift + S` | `Cmd + Shift + S` | Salvar como PNG. |

## Erros comuns

### A solicitação não chega à tarefa

Confira a conexão de entrada, as condições anteriores e os responsáveis. Repita o teste com uma conta que satisfaça a atribuição.

### Dois botões levam ao mesmo caminho

Confirme se cada saída referencia o botão correto e se uma regra genérica ou o caminho padrão está capturando os dois casos.

### O gateway sempre usa o caminho padrão

Confira a chave e o valor real do campo, o botão selecionado e os conectores **E/OU**. Teste um valor manual e um proveniente de fonte de dados.

### O processo foi salvo, mas o público não o encontra

Confirme a publicação, a exibição na Central de serviços e as regras de acesso com uma conta externa autorizada.

### Um dado interno aparece para o requerente

Revise **Tarefas × Campos**, a visibilidade para o requisitante, relatórios e documentos. Valide uma nova instância com o perfil externo.

### O modelador indica problemas no diagrama

Abra os diagnósticos, localize o elemento informado e corrija a causa. Salve e valide novamente antes de publicar.

## Demonstração prática sugerida

Para revisar o aprendizado:

1. desenhe início, análise, decisão, complementação e fim;
2. crie os botões Concluir análise e Solicitar complementação;
3. associe cada botão à saída correta;
4. configure uma única saída padrão, quando necessária;
5. defina a razão social no resumo da solicitação;
6. restrinja o parecer técnico na matriz;
7. salve e teste os dois caminhos;
8. verifique o serviço com uma conta externa e a tarefa com uma conta interna;
9. publique apenas no ambiente e no momento autorizados pelo órgão.

O exercício está concluído quando cada perfil encontra somente o que precisa, os caminhos chegam ao resultado planejado e a versão publicada corresponde ao conteúdo validado.

## Assuntos relacionados

- [Modelador de formulários](./modelador-formularios.md)
- Configuração de tarefas e campos
- Automação de formulários
- Controle de acesso à Central de serviços
- Versionamento e publicação de processos

---

**Próximo manual:** [Modelador de formulários](./modelador-formularios.md)

**Atualizado em:** 13/09/2026

**Estado:** protótipo editorial baseado no código; validação em ambiente e imagens pendentes.

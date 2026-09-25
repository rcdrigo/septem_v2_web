# Modelador de formulários

**Manuais técnicos › Construção de processos › Modelador de formulários**

Aprenda a criar formulários claros, validar os dados recebidos e controlar como cada informação será usada durante o processo.

> **Acesso restrito**
> Este manual é destinado a administradores e usuários com permissão para consultar manuais técnicos. As permissões para editar processos, fontes de dados, máscaras ou automações são verificadas separadamente pelo sistema.

## Visão geral

O formulário reúne as informações que entram e circulam pelo processo. Ele pode atender tanto o público externo, que solicita um licenciamento ou acompanha um contrato, quanto os servidores que analisam, complementam e decidem sobre a solicitação.

O editor nativo organiza cada formulário em **Abas → Agrupamentos → Campos**. Cada aba contém ao menos um agrupamento, do tipo **Grupo Padrão** ou **Tabela**. A matriz **Tarefas × Campos**, fontes, máscaras, documentos e automações continuam sendo integrações do Septem.

> A implantação nativa está em andamento. Consulte as pendências de integração e os critérios ainda não demonstrados no [registro da etapa 7](../specs/formularios-nativos-e7.md).

Neste manual, você criará o formulário do processo fictício **Licenciamento — exercício** com quatro conjuntos de informações:

| Grupo | Conteúdo | Principal responsável pelo preenchimento |
|---|---|---|
| Dados do empreendimento | Razão social, CNPJ e descrição da atividade. | Requerente. |
| Responsáveis | Nome, função e contato de uma ou mais pessoas. | Requerente. |
| Documentos | Anexos exigidos para o exercício. | Requerente. |
| Análise interna | Decisão, parecer e pedido de complementação. | Servidor. |

O exemplo é apenas didático. A equipe responsável pelo serviço deve definir os dados necessários, sua base legal, o período de retenção e quem pode consultá-los.

## Antes de criar o formulário

Liste os dados usados em cada etapa e elimine solicitações sem finalidade clara. Para cada informação, responda:

- por que o dado é necessário;
- quem o fornece e quem o consulta;
- em qual tarefa ele pode ser alterado;
- se existe formato ou limite válido;
- se o dado pode aparecer para o requisitante ou em relatórios;
- se será usado em condições, documentos, integrações ou automações.

Defina também quais informações se repetem. Uma lista de responsáveis, equipamentos ou itens contratuais deve ser modelada como conjunto repetido, em vez de vários campos numerados manualmente.

> **Dica**
> Comece com o menor formulário capaz de conduzir o processo. Campos excessivos aumentam erros de preenchimento e o esforço de análise.

<!-- PRINT: visão geral do editor, identificando paleta, área do formulário e painel de configuração. -->

<a id="formularios-visao-geral"></a>

## Conhecendo o editor

Abra o processo e selecione **Formulário**. O editor é dividido em três áreas principais.

### Catálogo de campos

A paleta agrupa os elementos disponíveis:

| Categoria | Componentes disponíveis | Uso principal |
|---|---|---|
| **Entrada** | Texto, Área de texto, Número, Data / Hora e Upload de arquivo. | Receber dados digitados ou anexados. |
| **Seleção** | Lista, Opções, Caixa de seleção, Múltipla escolha e Tags. | Permitir escolhas previamente definidas. |
| **Apresentação** | Texto estático, HTML, Imagem, Separador e Espaçador. | Explicar, contextualizar e organizar visualmente. |

Selecione o agrupamento de destino e use **Adicionar campo** para abrir o catálogo. Crie estruturas pelas ações **Nova aba** e **Novo agrupamento**. Arrastar serve para reordenar ou mover campos existentes; transferências entre Grupo Padrão e Tabela usam uma ação explícita.

### Área do formulário

A área central mostra a estrutura em edição. Selecione um elemento para configurá-lo, mova-o para corrigir a ordem e organize campos em grupos ou tabelas quando houver relação entre eles.

### Configurações do campo

O painel de configuração apresenta as opções compatíveis com o elemento selecionado. As abas podem incluir **Geral**, **Aparência**, **Validação** e **Eventos**. Um texto de orientação não possui as mesmas regras de um campo numérico; por isso, a quantidade de opções muda conforme o tipo.

Se o painel estiver vazio, selecione um elemento na área central.

### Ações do cabeçalho do formulário

| Controle | Para que serve | Comportamento |
|---|---|---|
| **Pré-visualizar** | Abre uma simulação visual do schema atual. | Ajuda a conferir campos e layout, mas não aplica regras de tarefa e acesso. |
| **Máscaras** | Lista, cria, edita e remove máscaras reutilizáveis. | As máscaras cadastradas passam a ficar disponíveis em campos compatíveis. |
| **Importar** | Lê um JSON nativo e valida sua estrutura. | Aplica ao rascunho; não converte schemas antigos. |
| **Exportar** | Baixa a definição nativa em JSON. | Inclui identidades, abas, agrupamentos e configurações. |

### O que é configurado em cada aba do campo

As abas exibidas dependem do componente selecionado.

| Aba | Para que serve | Onde aparece |
|---|---|---|
| **Geral** | Conteúdo, nome, chave, ajuda, fonte de dados, obrigatoriedade e visibilidade. | Todos os componentes, com opções compatíveis ao tipo. |
| **Aparência** | Documento, máscara, tipo de data, adornos, grade, largura e limites de caracteres. | Todos os componentes; algumas opções aparecem somente para entradas. |
| **Validação** | Mínimo/máximo numérico e restrição de data. | Somente Número e Data / Hora. |
| **Eventos** | Ações associadas a alteração, clique, saída de foco ou foco. | Entradas que possuem chave e não são containers ou apresentação. |

#### Aba Geral

Os controles mais comuns são:

- **Nome:** rótulo apresentado ao usuário. Em Data / Hora, o editor sincroniza também os rótulos próprios de data e hora;
- **Chave (identificador):** referência estável usada pelo processo. Ela acompanha o Nome enquanto não for personalizada;
- **Tipo de ajuda:** **Inline** mostra a orientação abaixo do campo; **Popover** abre conteúdo rico sob demanda;
- **Fonte de dados:** aparece para Texto, Número, Data / Hora, Lista, Opções, Múltipla escolha, Tags, Texto estático e Imagem;
- **Obrigatório:** exige preenchimento nos componentes de entrada;
- **Visível no relatório:** controla a inclusão do campo ou container na visão de relatório;
- **Visível ao requisitante:** controla se quem iniciou a solicitação pode consultar o conteúdo.

Grupos e listas dinâmicas também permitem escolher um ícone. Grupos oferecem **Exibir contador de pendências**. Texto estático usa **Conteúdo (Markdown)**; HTML usa **Conteúdo (HTML)**; Imagem usa **Origem (URL ou expressão)** e **Texto alternativo**.

No Upload, a aba Geral também contém extensões permitidas, **Gera documento?**, **Permitir anexar documento manualmente?** e a parametrização do modelo de documento.

#### Aba Aparência

| Controle | Aplicação | Observação |
|---|---|---|
| **Documento** | Texto. | Configura CPF ou CNPJ com máscara dinâmica e verificação dos dígitos. |
| **Tipo** | Data / Hora. | Escolhe Data e hora, somente data ou somente hora. |
| **Máscara** | Texto, Número e Área de texto; Data / Hora usa configuração própria. | Não aparece quando o campo Texto já está configurado como CPF/CNPJ. |
| **Prefixo / Sufixo** | Campos de entrada. | São adornos visuais; confirme o valor efetivamente armazenado. |
| **Colunas (no container)** | Todos os componentes. | Define a parcela da grade ocupada pelo componente. |
| **Largura (px)** | Todos os componentes. | Vazio permite acompanhar a largura da coluna. |
| **Mín. caracteres / Máx. caracteres** | Texto, Área de texto, Número e Data / Hora. | Teste os limites no navegador e na validação do servidor. |

#### Aba Validação

Em **Número**, informe **Valor mínimo** e **Valor máximo**. Em **Data / Hora**, escolha a **Restrição de data** disponível. A regra temporal é conferida com a data do servidor ao salvar ou concluir, portanto o relógio do dispositivo do usuário não é a autoridade.

#### Aba Eventos

Clique em **Adicionar evento**, escolha **Alteração (change)**, **Clique (click)**, **Saída de foco (blur)** ou **Foco (focus)** e escreva a ação. Mais de um evento pode ser associado ao campo; use **Remover** para excluir uma regra.

Eventos são configuração avançada. Documente a finalidade da ação, evite efeitos silenciosos e teste abertura repetida da tarefa, navegação por teclado e retorno após erro. A existência da configuração no schema não substitui a validação do comportamento na execução.

### Matriz de componentes e configurações

| Componente | Dados principais | Configurações específicas |
|---|---|---|
| **Grupo** | Nome e ajuda. | Ícone, contador de pendências, visibilidade, colunas e largura. |
| **Tabela** | Nome do agrupamento e tipos de coluna. | Cada coluna é um campo de resposta; linhas são criadas durante o preenchimento. |
| **Texto** | Nome, chave, ajuda e valor. | Fonte, obrigatório, CPF/CNPJ, máscara, prefixo/sufixo e limites. |
| **Área de texto** | Nome, chave, ajuda e texto multilinha. | Obrigatório, máscara, prefixo/sufixo e limites. |
| **Número** | Nome, chave e valor numérico. | Fonte, obrigatório, adornos, mínimo/máximo e limites. |
| **Data / Hora** | Nome, chave e valor temporal. | Fonte, obrigatório, tipo, restrição de data e limites. |
| **Upload** | Nome, chave e arquivo. | Extensões, obrigatório, geração de documento e anexo manual. |
| **Lista** | Nome, chave e uma opção. | Fonte de dados, obrigatório, visibilidade e eventos. |
| **Opções** | Nome, chave e uma opção visível. | Fonte de dados, obrigatório, visibilidade e eventos. |
| **Caixa de seleção** | Nome, chave e estado marcado/desmarcado. | Obrigatório, visibilidade, aparência e eventos. |
| **Múltipla escolha** | Nome, chave e várias opções. | Fonte de dados, obrigatório, visibilidade e eventos. |
| **Tags** | Nome, chave e várias opções compactas. | Fonte de dados, obrigatório, visibilidade e eventos. |
| **Texto estático** | Conteúdo Markdown. | Fonte de dados, colunas e largura. |
| **HTML** | Conteúdo HTML. | Colunas e largura. |
| **Imagem** | Origem e texto alternativo. | Fonte de dados, colunas e largura. |
| **Separador / Espaçador** | Não recebem dados. | Colunas e largura. |

## Criando o primeiro formulário

### 1. Adicione o grupo principal

Na categoria **Container**, adicione um **Grupo** e dê a ele o nome **Dados do empreendimento**. Grupos ajudam o usuário a entender o assunto de cada bloco e facilitam o controle do formulário durante a execução.

### 2. Adicione os campos básicos

Dentro do grupo, adicione:

- um campo **Texto** chamado **Razão social**;
- um campo **Texto** chamado **CNPJ**;
- uma **Área de texto** chamada **Descrição da atividade**.

Selecione cada campo e confira seu nome e sua chave. Ative a obrigatoriedade somente para os dados que realmente precisam existir antes de concluir a tarefa inicial.

### 3. Acrescente orientações

Use a ajuda do campo para informar formato, origem ou exemplo. Para a descrição da atividade, uma orientação útil seria: “Resuma a atividade realizada no local, incluindo produtos, serviços e capacidade quando aplicável.”

### 4. Pré-visualize

Abra **Pré-visualizar** e preencha o formulário como um requerente. Confira a ordem de leitura, o tamanho dos textos, a clareza das opções e as mensagens de validação.

### 5. Salve no processo

Feche a prévia, corrija o necessário e use **Salvar** na barra do modelador. A prévia ajuda a revisar a apresentação, mas não substitui o teste do processo, das permissões e das regras por tarefa.

**Resultado do exercício:** o grupo apresenta três campos compreensíveis, com chaves únicas e instruções suficientes para o preenchimento.

<a id="formularios-grupos"></a>

## Organizando o formulário

### Grupos

Use grupos para reunir campos do mesmo assunto. No exercício, separe **Dados do empreendimento**, **Documentos** e **Análise interna**. Evite criar um grupo para cada campo ou um único grupo com dezenas de informações sem relação visual.

Crie abas para dividir formulários longos. Na execução, abas sem conteúdo visível ficam ocultas; se apenas uma permanecer visível, seus agrupamentos aparecem empilhados, sem navegação de abas. É possível mudar de aba sem completar a atual.

Os contadores mostram obrigatórios vazios e respostas inválidas, inclusive por célula de tabela. Campos ocultos ou sem edição não contam. Ao enviar, o formulário abre a primeira aba com erro.

### Colunas e largura

A grade de execução usa 16 colunas. Dois campos com 8 colunas podem dividir uma linha em telas amplas. Um campo de 16 colunas ocupa a linha completa.

Use a grade para aproximar informações relacionadas, como Município e UF. Deixe a largura fixa em pixels vazia quando o campo puder acompanhar o espaço do container. Larguras rígidas tendem a prejudicar textos longos e telas menores.

> **Cuidado especial**
> Uma composição lado a lado no desktop deve continuar utilizável em tela estreita. Confira rótulos, mensagens, seletores e uploads em diferentes larguras.

### Tabelas

Crie um agrupamento **Tabela**, informe a quantidade de colunas e escolha seus tipos. Cada campo é uma coluna e seu rótulo é o cabeçalho. Para **Responsáveis**, use as colunas **Nome**, **Função** e **E-mail**.

No preenchimento, cada linha representa uma ocorrência. A tabela começa com uma linha; a última pode ser limpa, mas não excluída pela interface. Linhas inteiramente vazias são descartadas ao salvar depois da validação de obrigatórios. Zero numérico e falso são preservados conforme o tipo.

Converter Grupo Padrão em Tabela preserva as identidades dos campos. Elementos de apresentação precisam ser movidos para outro Grupo Padrão antes da conversão. Alterações estruturais pertencem ao rascunho e não convertem respostas de requisições anteriores.

Ocultar campos preserva seus valores. Scripts podem criar campos visuais, mas somente respostas de campos definidos na versão vinculada à requisição são persistidas, incluindo novas linhas de tabelas existentes.

## Conheça os tipos de campo

### Texto e área de texto

Use **Texto** para valores curtos, como razão social, número de referência ou nome. Use **Área de texto** para conteúdo de várias linhas, como justificativa, descrição e parecer.

Quando disponível, configure limites de caracteres coerentes com o conteúdo. Um limite deve impedir entradas inadequadas sem cortar respostas necessárias. Teste o valor exato do limite, um caractere abaixo e um acima.

### Número

Use **Número** quando o valor precisar ser tratado numericamente. Configure mínimo e máximo quando houver uma regra confirmada. Prefixo e sufixo ajudam a leitura, mas não devem ser confundidos com transformação do valor armazenado.

Exemplo: para **Quantidade de funcionários**, um mínimo de zero pode ser adequado; para **Quantidade de responsáveis**, o mínimo pode ser um, caso o procedimento exija ao menos um registro.

### Data / Hora

Escolha o modo compatível com o dado esperado: data, hora ou combinação, conforme as opções oferecidas pelo campo. Use as restrições disponíveis para impedir períodos inválidos e confirme qual referência de data é usada pelo ambiente.

Exemplo: **Data de início da atividade** não deve aceitar uma regra arbitrária de futuro ou passado sem que essa exigência pertença ao procedimento.

### Upload de arquivo

Use o upload quando o usuário precisar enviar um documento. Informe no rótulo e na ajuda qual conteúdo é esperado. Configure extensões aceitas apenas com base nos formatos realmente suportados pelo procedimento e pelo ambiente.

Não invente limite de tamanho no texto do manual. Quando o ambiente aplicar um limite, informe o valor confirmado e mostre ao usuário como corrigir uma rejeição.

### Campos de seleção

Escolha o componente pela quantidade de respostas esperada e pela forma de apresentação:

| Componente | Use quando | Exemplo |
|---|---|---|
| **Lista** | Uma opção deve ser escolhida e há várias alternativas. | Município. |
| **Opções** | Uma opção deve ficar visível entre poucas alternativas. | Tipo de solicitante. |
| **Caixa de seleção** | Uma confirmação independente deve ser marcada ou desmarcada. | Declaro ciência. |
| **Múltipla escolha** | Mais de uma opção pode ser selecionada. | Atividades exercidas. |
| **Tags** | Várias opções são escolhidas em formato compacto. | Categorias relacionadas. |

Explique no rótulo quando o usuário pode selecionar mais de uma opção. Confira o valor armazenado, especialmente quando as opções vierem de uma fonte de dados.

### Elementos de apresentação

**Texto estático**, **HTML**, **Imagem**, **Separador** e **Espaçador** orientam a leitura e não devem ser tratados como respostas do formulário.

Use texto estático para instruções curtas. Use HTML apenas quando houver necessidade e conteúdo confiável. Toda imagem informativa precisa de descrição alternativa. Separadores e espaços ajudam a criar ritmo visual, mas não substituem títulos e grupos claros.

> **Dica**
> Coloque a orientação perto da decisão que ela explica. Um bloco longo no início dificilmente resolve dúvidas que surgem no meio do preenchimento.

<a id="formularios-identificadores"></a>

## Configurando nome e chave

O **Nome** é o rótulo que o usuário lê. A **Chave** identifica o dado em condições, documentos, fontes, integrações e automações.

Ao criar **Razão social**, o editor pode derivar uma chave enquanto ela ainda não tiver sido personalizada. Se você editar a chave manualmente, ela deixa de acompanhar alterações posteriores do nome. Saia do campo para confirmar e aguarde a verificação de unicidade.

No editor nativo, a chave de um campo novo começa vazia. Ao digitar o nome pela primeira vez, ela é gerada em `snake_case` durante a digitação e deixa de acompanhar o nome quando você sai desse controle. Preencha as chaves que ainda estiverem vazias antes de publicar.

Uma chave deve ser estável, única e significativa. Antes de alterar uma chave já usada, localize suas referências no processo. A mudança pode afetar condições, resumos, documentos, relatórios e código de automação.

> **Exemplo**
> O usuário lê **Descrição da atividade**. A equipe pode manter a chave `atividade` para usá-la nas regras, desde que ela seja única e represente o mesmo dado ao longo do tempo.

Se a chave for recusada, verifique o formato normalizado e se outro campo já utiliza o mesmo identificador. Se o nome mudar e a chave permanecer igual, confirme se ela havia sido personalizada anteriormente.

<a id="formularios-orientacoes"></a>

## Escrevendo orientações para o usuário

A ajuda do campo pode aparecer de forma **inline**, próxima ao controle, ou em **popover**, aberta sob demanda. Use o modo inline quando a instrução for curta e necessária para quase todos. Use o popover para uma explicação complementar que não precise ocupar espaço permanentemente.

Uma boa orientação explica a dúvida concreta:

- **Formato:** “Informe somente os 14 dígitos do CNPJ.”
- **Origem:** “Use a razão social constante no cadastro da Receita Federal.”
- **Critério:** “Descreva apenas as atividades realizadas nesta unidade.”
- **Exemplo:** “Ex.: fabricação de produtos cerâmicos.”

Evite mensagens como “Preencha corretamente” ou “Campo obrigatório”, pois elas não ensinam o que é considerado correto.

A ajuda de preenchimento faz parte do formulário apresentado ao usuário. Ela é diferente do helper técnico que abre este manual para administradores e modeladores autorizados.

<a id="formularios-validacao"></a>

## Configurando validações e aparência

### Obrigatoriedade

Ative **Obrigatório** quando a tarefa não puder ser concluída sem o dado. A obrigatoriedade pode interagir com o botão utilizado para encerrar a etapa e com a matriz por tarefa; teste a combinação no processo.

Um campo obrigatório que permanece oculto na tarefa pode impedir a conclusão ou criar comportamento confuso. Confira sempre visibilidade, editabilidade e validação juntas.

### CPF e CNPJ

Para campos compatíveis, use a opção de documento disponível para CPF ou CNPJ. Uma máscara altera a apresentação; uma validação verifica se o valor atende à regra configurada. Confirme os dois comportamentos separadamente.

Teste um documento válido, um com quantidade incorreta de dígitos e um com formatação incompleta. A mensagem deve ajudar o usuário a corrigir o valor.

### Máscaras

Use uma máscara cadastrada para orientar formatos recorrentes, como protocolo, telefone ou código interno. Antes de aplicá-la, confira seu padrão, o tipo de campo compatível e se existe validação associada.

Uma máscara pode apenas formatar a entrada. Não presuma que ela garante a validade administrativa do conteúdo.

### Prefixo, sufixo, colunas e largura

Prefixo e sufixo acrescentam contexto visual, como uma unidade de medida. Colunas controlam o espaço na grade, e largura define uma dimensão fixa quando necessária. Pré-visualize valores curtos, longos, vazios e inválidos.

### Restrições por tipo

Campos de texto podem oferecer limites de caracteres; números, valores mínimo e máximo; datas, restrições de período. Configure apenas regras que o usuário consiga compreender e que o processo realmente exija.

**Teste mínimo de uma validação:**

1. valor válido;
2. campo vazio;
3. valor imediatamente abaixo do limite;
4. valor no limite;
5. valor imediatamente acima;
6. conclusão por cada botão disponível na tarefa.

<a id="formularios-fontes"></a>

## Usando opções e fontes de dados

Campos de seleção podem receber opções definidas no próprio formulário ou carregadas de uma fonte de dados cadastrada. Use uma fonte quando as alternativas precisarem ser mantidas de forma centralizada ou obtidas de outro conjunto controlado.

Ao selecionar uma fonte, confira:

- se ela é compatível com o tipo do campo;
- qual propriedade será mostrada como rótulo;
- qual valor será armazenado;
- o que acontece quando a consulta não retorna opções;
- quem tem permissão para acessar os dados;
- como uma indisponibilidade é apresentada ao usuário.

> **Exemplo**
> Uma lista de unidades organizacionais pode mostrar o nome completo e armazenar o identificador da unidade. Condições e documentos devem usar o valor armazenado, não presumir que ele é igual ao texto visível.

Teste a fonte no editor e na execução, com resultado normal, vazio e indisponível. Não publique um formulário cuja etapa obrigatória dependa de uma fonte sem comportamento de recuperação compreensível.

<a id="formularios-anexos"></a>

## Configurando anexos e documentos gerados

Selecione o campo **Upload de arquivo** para definir os formatos aceitos, a obrigatoriedade e as opções de documento oferecidas pelo editor.

### Envio manual

Use o envio manual quando o usuário já possui o arquivo. Escreva um rótulo que identifique o documento e uma ajuda que explique conteúdo e formato. Valide também remoção, substituição, arquivo incompatível e falha de envio.

### Geração por modelo

Quando a opção de documento gerado estiver disponível, escolha o modelo e configure os dados necessários. O resultado depende dos campos e das chaves referenciadas pelo modelo; uma renomeação pode exigir revisão.

Se houver assinatura relacionada, descreva quem assina, em qual momento e o que acontece quando a assinatura falha. Esse comportamento pertence à integração de documentos do Septem.

### Visibilidade do documento

Confirme em quais tarefas o campo aparece, se o requisitante pode vê-lo e se participa de relatórios. Um documento interno não deve ser exposto apenas porque foi produzido por um campo do formulário.

<a id="formularios-visibilidade"></a>

## Controlando a visibilidade ao longo do processo

Depois de criar os campos, abra **Tarefas × Campos** no modelador. O formulário define quais dados existem; a matriz define como cada tarefa os utiliza.

No exercício:

| Campo | Início | Analisar documentação | Complementar informações |
|---|---|---|---|
| Razão social | Editável | Visível | Visível |
| Documentos | Editável | Visível | Editável |
| Parecer técnico | Oculto | Editável | Oculto |
| Motivo da complementação | Oculto | Editável | Visível |

Confira também as opções de visibilidade em relatório e para o requisitante. Essas regras atendem contextos diferentes e precisam ser testadas em conjunto.

## Configurando eventos e JavaScript

A aba **Eventos** permite associar ações oferecidas pelo editor a acontecimentos do campo. Planeje o comportamento para que o usuário compreenda a mudança e consiga se recuperar de falhas.

A área **JavaScript** é um recurso avançado com permissão própria. Ela pode manipular dados e estrutura do formulário, reagir a eventos e validar o envio conforme os recursos integrados pelo Septem. O código comum e o código específico da tarefa podem ter momentos e escopos diferentes.

Antes de publicar uma automação:

- use um processo salvo e uma versão de teste;
- confira as chaves utilizadas;
- trate valores vazios e erros de fonte;
- remova listeners ou temporizadores que não devam persistir;
- teste todas as tarefas em que o código será executado;
- diferencie aplicar ao editor, salvar rascunho e publicar;
- verifique o histórico e possíveis conflitos de edição.

Consulte a [documentação local de automação](../form-automation.md) para a API integrada, permissões, versionamento e tratamento de falhas. Use os contratos nativos do Septem nos scripts.

<a id="formularios-testar"></a>

## Pré-visualizando, importando e testando

### Pré-visualizar

Use **Pré-visualizar** para conferir aparência, preenchimento básico e mensagens. Teste com conteúdo curto e longo, opções vazias e mais de um item em listas dinâmicas.

### Importar

A importação de formulário pode substituir a estrutura atual e pode estar bloqueada quando o processo já possui instâncias. Leia o aviso, confirme a origem do arquivo e use um processo de teste. Depois, revise componentes personalizados, fontes, máscaras, matriz e automações.

### Testar no processo

Execute o processo para validar o que a prévia não cobre:

- campos ocultos, visíveis e editáveis por tarefa;
- botões que validam ou dispensam validação;
- regras de acesso e perfis diferentes;
- documentos e uploads;
- fontes de dados e automações;
- exibição ao requisitante e em relatórios;
- comportamento em desktop e celular.

Salve apenas depois de conferir os indicadores de erro do editor. Publique o processo somente após validar o formulário junto com fluxo, matriz e configurações.

## Erros comuns

### A chave já está em uso

Selecione outra chave ou localize o campo que já usa o identificador. Não resolva a colisão alterando uma chave publicada sem avaliar suas referências.

### O campo obrigatório não deixa concluir a tarefa

Confira se ele está visível e editável naquela tarefa, se o botão exige validação e se alguma automação altera seu estado.

### A máscara formata, mas aceita um dado inválido

Verifique se a configuração inclui validação. Formatação e validade são comportamentos diferentes.

### A fonte de dados não apresenta opções

Confirme a fonte selecionada, as permissões, os campos de rótulo e valor e a disponibilidade da consulta. Teste também o comportamento quando a resposta estiver vazia.

### O grupo configurado como abas continua empilhado no editor

A opção afeta a execução. Confira a prévia ou uma instância de teste.

### O arquivo é recusado

Confira a extensão configurada, o limite confirmado no ambiente, a sessão e a conexão. Oriente o usuário com base na mensagem real apresentada.

### Um campo interno aparece para o solicitante

Revise a matriz, a visibilidade para o requisitante, relatórios e documentos. Teste novamente com uma conta externa.

## Demonstração prática sugerida

Para revisar o aprendizado:

1. crie os grupos Dados do empreendimento, Responsáveis, Documentos e Análise interna;
2. adicione razão social, CNPJ e descrição da atividade;
3. configure nome, chave, ajuda e validação;
4. crie uma lista dinâmica de responsáveis;
5. inclua um upload com orientação clara;
6. adicione uma decisão por opções e uma área de parecer;
7. organize a grade sem depender de larguras fixas;
8. defina a matriz para requerente e servidor;
9. teste valores válidos, inválidos, vazios e extensos;
10. percorra o processo com uma conta externa e outra interna.

O exercício está concluído quando o requerente entende o que preencher, o servidor recebe as informações necessárias e nenhum perfil visualiza ou altera dados indevidos.

## Assuntos relacionados

- [Modelador de processos](./modelador-processos.md)
- [Automação de formulários](../form-automation.md)
- Configuração de tarefas e campos
- Fontes de dados
- Máscaras de entrada
- Geração e assinatura de documentos

---

**Manual anterior:** [Modelador de processos](./modelador-processos.md)

**Atualizado em:** 13/09/2026

**Estado:** protótipo editorial baseado no código; validação em ambiente e imagens pendentes.


### Layout e identificação dos campos nativos

Nas propriedades do campo, **Colunas (no container)** define a largura no grid de 16 colunas. Campos consecutivos de 8 colunas aparecem lado a lado; campos sem largura definida ocupam a linha inteira. No celular, os campos ficam empilhados. Ajuda, descrição, contador e erros só ocupam espaço quando há conteúdo para exibir.

Em **Configurar aba → Ícone da aba**, pesquise por nome no catálogo completo de ícones disponíveis (sólidos e regulares), escolha ou remova um ícone. A seleção é salva na definição e aparece no editor e no preenchimento. Os ícones já configurados continuam funcionando.

Nas tabelas, **Adicionar linha** fica no rodapé do card. A lixeira na base de cada linha remove a linha ou limpa os valores quando resta apenas uma.

A matriz **Tarefas × Campos** associa cada campo ao seu ID interno (`fieldId`) dentro da tarefa BPMN. Alterar a chave mantém a visibilidade, a edição e a fonte de dados configuradas. O modelador converte vínculos anteriores por chave antes da renomeação e mantém `fieldRef` atualizado para as APIs de execução. Excluir e recriar um campo produz outra identidade; as configurações anteriores não são transferidas para o novo campo. Referências em scripts e outras regras que usam chaves continuam exigindo revisão ao renomear.

### Exclusão e arquivamento de campos

Ao excluir um campo pelo ícone de lixeira na sua linha, ou excluir um agrupamento ou aba de um processo salvo, o editor consulta se seus campos têm respostas em requisições de qualquer versão. Valores `0` e `false` contam como respostas. Se houver execuções, a exclusão é impedida, os campos são arquivados no rascunho e uma mensagem informa o resultado. Se a consulta falhar, nada é excluído; tente novamente.

O arquivamento fica no rascunho até a publicação. Após publicar, os campos arquivados deixam de aparecer nas tarefas, inclusive de requisições vinculadas a versões anteriores, e nas colunas, detalhes e exportações dos relatórios por processo. As definições anteriores e as respostas armazenadas são preservadas. Relatórios que dependam desses campos em filtros ou cálculos exigem revisão da configuração antes de executar; resultados antigos em cache não são reutilizados.

Campos sem respostas podem ser excluídos. Suas entradas na matriz da tarefa são removidas; outras dependências, como condições de saída, continuam exigindo revisão. Os avisos de referências e usos conhecidos não repetem ocorrências idênticas.

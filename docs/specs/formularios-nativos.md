# Formulários nativos — decisões de desenho

Desenho confirmado pelo usuário em 18/09/2026, após as rodadas Q1–Q24. Execução organizada em [requisitos de desenvolvimento por etapas](formularios-nativos-etapas.md). Decisões arquiteturais e escopo de substituição: [ADR 0004](../adr/0004-formularios-nativos-sem-form-js.md). Requisitos de interação de origem: SGI-V2-Redesenho-Formulario-Passo-a-Passo-2.md, fornecido pelo usuário.

## Estrutura e criação

- Cada processo possui um único formulário, organizado em Formulário → Aba → Agrupamento → Campo. Abas e agrupamentos não se aninham em si mesmos.
- O formulário nasce com uma aba e um Grupo Padrão. Cada nova aba nasce com um agrupamento. Nomes sugeridos são editáveis pelo painel lateral.
- Todo campo pertence a um agrupamento, e todo agrupamento pertence a uma aba. A interface impede excluir a última aba ou o último agrupamento de uma aba.
- Criar campos ocorre por seleção do agrupamento e escolha de tipo no catálogo, sem arrastar. Configurações do agrupamento permanecem no painel lateral.
- Criar uma Tabela permite escolher o número de colunas e o tipo de cada uma. O rótulo do campo é o cabeçalho, sem configuração duplicada. O editor permite adicionar e remover colunas e trocar seus tipos.
- A matriz Tarefas × Campos permanece como configuração separada do formulário.

## Decisões confirmadas

- Arrastar permite reordenar campos e movê-los entre Grupos Padrão, inclusive de abas diferentes.
- Dentro de uma Tabela, arrastar permite reordenar colunas.
- Transferir campos entre tabelas ou entre Grupo Padrão e Tabela requer uma ação explícita que informe a mudança de cardinalidade.
- A primeira versão mantém os sete tipos do anexo e também checkbox, múltipla escolha, tags, texto estático, HTML, imagem, separador e espaçador; mantém validações, fontes de dados e automações.
- Textos, imagens e separadores são elementos de apresentação, distintos dos campos de resposta.
- Campos possuem identidade interna permanente, independente do rótulo e da posição, e uma chave legível para scripts. Renomear o rótulo não altera a chave; alterar a chave exige verificar referências. Duplicação ainda não é uma funcionalidade acordada.
- Automações são independentes da versão do formulário.
- A estratégia inicial combina um script adaptável, com consulta de existência de campos, e verificação de referências e testes com versões em uso antes da publicação. Verificações não garantem todos os comportamentos de JavaScript livre. Novas publicações passam a valer na próxima abertura da tarefa; sessões abertas mantêm os scripts carregados. Revisões selecionadas por compatibilidade ficam para uma necessidade futura.
- Scripts mantêm a capacidade de alterar a estrutura durante o preenchimento; não será aplicada a restrição proposta de limitar criação de campos, colunas, agrupamentos e abas ao editor.
- Scripts têm prioridade sobre a configuração inicial dos campos na tarefa. Se um script habilitar um campo inicialmente somente leitura, seu novo valor pode ser salvo. O servidor continua verificando acesso à requisição, execução da tarefa e integridade dos dados.
- A navegação entre abas é livre. No envio, todos os campos aplicáveis à tarefa são validados, abas com erros são marcadas e a primeira que precisa de correção é aberta.
- Abas sem conteúdo visível são omitidas; com uma única aba visível, a navegação é escondida.
- Cada título de aba na navegação exibe um contador de respostas que precisam de correção: obrigatórios vazios ou valores preenchidos inválidos. Em tabelas, cada célula pendente conta separadamente. Campos opcionais vazios, ocultos ou sem edição não contam. O contador acompanha as regras finais aplicadas pelos scripts e exibe zero quando a aba está completa.
- Respostas de campos novos criados somente por script, ausentes da definição do formulário da requisição, não são salvas. A estrutura dinâmica não se torna automaticamente parte da definição persistida.
- Scripts podem acrescentar linhas a tabelas existentes; valores dessas linhas podem ser salvos quando correspondem aos campos definidos nas colunas. Acrescentar uma linha repete os campos existentes e não cria uma nova definição de campo.
- Toda tabela começa com pelo menos uma linha, cujos campos podem ser obrigatórios ou opcionais. A interface mantém uma linha, oferecendo limpar seus valores em vez de excluir a última. Scripts continuam livres para manipular as linhas.
- Linhas inteiramente vazias não são persistidas. Ao reabrir uma tabela sem respostas, uma linha inicial é exibida. Campos obrigatórios vazios continuam gerando pendências antes desse descarte; ele não contorna a validação.
- Na matriz Tarefas × Campos, a configuração de uma coluna se aplica inicialmente a todas as linhas, inclusive às acrescentadas depois. Scripts podem sobrescrever o comportamento de uma célula específica.
- Trocar o tipo de um campo preserva identidade, chave, rótulo e configurações compatíveis. Configurações incompatíveis são removidas automaticamente, sem aviso ou confirmação adicional. A verificação de referências para publicação continua aplicável.
- Elementos de apresentação ficam em Grupos Padrão. Para converter um grupo que os contenha em Tabela, o editor solicita movê-los para outro Grupo Padrão e oferece criar o destino. A conversão preserva os campos de resposta, sem descartar conteúdo silenciosamente.
- Ao excluir ou alterar um campo, o editor mostra seus usos conhecidos. Rascunhos podem ser salvos com referências declarativas inválidas, mas a publicação fica bloqueada até a correção. Para JavaScript, são apresentados problemas detectáveis e testes; referências construídas dinamicamente podem escapar da análise.
- Ocultar ou retirar visualmente um campo por script preserva sua resposta anterior. A limpeza do valor precisa ser explícita. Remover uma linha de tabela remove as respostas daquela linha ao salvar.

## Situação

Entrevista encerrada e desenho confirmado. A base de contratos e persistência de E1 foi implementada e testada em 20/09/2026; veja o [registro da entrega e inventário](formularios-nativos-e1.md). O editor estrutural de E2 foi implementado em 20/09/2026; veja o [registro de E2 e suas verificações](formularios-nativos-e2.md). A E3 foi implementada em 20/09/2026; veja o [registro de tabelas, movimentação e conversão](formularios-nativos-e3.md). E4–E7, incluindo preenchimento, publicação integrada e limpeza do ambiente, permanecem pendentes. A especificação por etapas é a referência para planejar e aceitar as entregas; este documento preserva as decisões do desenho.

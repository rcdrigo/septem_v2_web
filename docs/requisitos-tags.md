# Tags em processos

Status: entendimento confirmado pelo usuário; implementação local concluída no frontend e no backend, com migração incluída. Publicação e aplicação da migração em ambientes não fazem parte desta execução.

## Requisitos confirmados

- Tags, filtros e histórico são exclusivos de usuários internos.
- A funcionalidade fica disponível apenas no modo interno e respeita o acesso existente do usuário à requisição.
- Usuários internos podem adicionar, editar e remover tags adicionadas por outros usuários.
- O acesso ao modal de tags deve ser discreto, no rodapé à direita, próximo de Salvar e Cancelar.
- O modal exibe as tags associadas e permite adicionar, editar e remover.
- Alterações são confirmadas por um botão próprio no modal, independentemente do formulário da tarefa. Cancelar o formulário depois não desfaz alterações já confirmadas no modal.
- O histórico é registrado ao confirmar a alteração e identifica o que mudou, quem alterou e quando.
- É possível alterar tags também após a conclusão ou o cancelamento do processo; todas as alterações devem ser registradas.
- Deve ser possível filtrar tarefas por tags.
- O filtro retorna tarefas cujas requisições possuam todas as tags selecionadas (E), em conjunto com os demais filtros existentes.
- Cards e tabelas exibem uma linha de tags como pills, com popover “Adicionado por {{usuario}} em {{timestamp}}”.
- Muitas tags devem ficar em uma linha com overflow oculto e seta para rolagem horizontal.
- Tags pertencem ao processo modelado e são compartilhadas entre suas requisições. Processos diferentes possuem tags independentes, mesmo com nomes iguais.
- As tags são compartilhadas entre versões do mesmo processo, dentro do mesmo ambiente.
- Renomear ou alterar a cor de uma tag afeta todas as requisições daquele processo associadas a ela, inclusive encerradas. Esse impacto deve ficar claro ao usuário.
- O usuário pode renomear uma tag mesmo quando não tem acesso a todas as requisições afetadas. O aviso informa o alcance global, sem revelar dados de requisições sem acesso.
- É possível remover somente a associação da tag com uma execução e também excluir a tag do processo. Ao solicitar a exclusão global, o usuário deve ser avisado de que ela será removida de todas as execuções associadas daquele processo.
- “Excluir tag do processo” fica no modal da tarefa, separada de “Remover desta execução” e disponível aos mesmos usuários que podem renomear. Antes de salvar, uma confirmação informa que a exclusão afeta também execuções encerradas e sem acesso pelo usuário, sem revelar seus dados.
- A exclusão preserva integralmente o histórico e aparece no histórico de cada execução afetada. Criar posteriormente uma tag com o mesmo nome cria uma nova tag, sem restaurar associações anteriores.
- Um botão no modal de tags abre um segundo modal para consultar o histórico, da alteração mais recente para a mais antiga.
- Nas tarefas, o histórico exibe apenas alterações da execução aberta. O histórico por execução também pode ser consultado pelo relatório da execução.
- Na página de configuração do processo (`flows/edit`), a área de configurações recebe uma aba com o histórico geral do catálogo de tags: criação, edição e exclusão, com autor e data/hora. Essa aba não lista associações ou remoções por execução.
- A aba de histórico geral segue a permissão existente de acesso às configurações e exige usuário interno em modo interno. Reúne alterações do catálogo entre todas as versões do processo no ambiente.
- Na tela do relatório da execução, um botão abre o mesmo modal de histórico por execução utilizado nas tarefas. Exportação desse histórico fica fora desta entrega.
- O popover preserva quem adicionou a tag à execução e quando, mesmo após renomeações ou alterações de cor. Remover e adicionar novamente exibe a nova adição. Cada evento de histórico identifica seu próprio autor e, em personificações, também quem operou em nome dele.
- Tags possuem nome, com limite de 50 caracteres, e cor definida pelo mesmo seletor utilizado nas categorias de processos. A cor é compartilhada pelo catálogo do processo e aplicada às pills, com contraste de texto automático. Tags existentes sem cor usam o padrão `#0ea5e9`. Alterações de cor ficam registradas com o valor anterior e o novo, autor e data/hora, no histórico geral e nas execuções associadas. Nomes são únicos por processo, ignorando maiúsculas/minúsculas e espaços nas extremidades. Adicionar nome existente reutiliza a tag; renomear para nome existente é bloqueado.
- Filtros de tag e processo são independentes e seus critérios são combinados com todos os demais filtros aplicados. Não é obrigatório selecionar um processo para filtrar por tag.
- O filtro de tags busca pelo nome em todos os processos, mesmo que as tags sejam entidades independentes. Selecionar “Urgente” encontra execuções com essa tag em qualquer processo permitido pelos demais critérios.
- Ao selecionar um filtro, os demais filtros ajustam suas opções para exibir apenas opções válidas para a seleção.
- Esse ajuste se aplica a todos os filtros com opções selecionáveis da listagem de tarefas. Texto e datas também restringem as opções disponíveis, considerando apenas tarefas acessíveis ao usuário.
- Se uma atualização dos dados invalidar uma seleção existente, ela é preservada, com indicação de ausência de resultados e possibilidade de remoção pelo usuário. Novas opções incompatíveis ficam indisponíveis; a busca não é alterada silenciosamente.
- Edições concorrentes conflitantes são bloqueadas, informando a atualização e solicitando revisão dos dados atuais antes de salvar novamente.
- O acompanhamento da requisição também permite acessar Tags, inclusive após encerramento. No celular, o acesso fica no menu de ações existente; tocar na pill exibe autoria e data. A linha admite deslizar horizontalmente e setas quando houver conteúdo oculto.

## Validação final

As decisões levantadas na entrevista foram respondidas e o entendimento consolidado foi confirmado pelo usuário, que autorizou a implementação com subagentes.

A implementação foi validada com build de produção, 45 verificações de interface desktop/mobile, quatro verificações de abertura direta da tarefa e sete testes de integração de tags, incluindo cores. Na validação anterior à adição de cores, a execução combinada com as regressões existentes de execuções, passaram 20 de 21 testes; a única falha, relativa à criação/listagem por usuário externo, foi reproduzida no código original sem as alterações de tags.

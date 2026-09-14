# Operação de tarefas e requisições

**Manuais técnicos › Operação de processos › Operação de tarefas e requisições**

Este manual explica como localizar, executar e concluir tarefas e como acompanhar o histórico completo de uma requisição.

> **Acesso restrito**
> O conteúdo é destinado a usuários internos autorizados. A lista apresenta somente tarefas e requisições permitidas para a identidade e o modo de acesso atuais.

## Entenda a diferença

Uma **requisição** é o processo completo iniciado por alguém. Uma **tarefa** é uma etapa desse processo atribuída a um responsável.

Exemplo: o empreendimento envia o pedido nº 184. Esse pedido é a requisição. **Analisar documentos**, **Emitir parecer** e **Complementar informações** são tarefas criadas ao longo dela.

Concluir uma tarefa não significa necessariamente concluir a requisição. A ação pode criar outra tarefa, aguardar um evento ou encerrar o fluxo.

## Localizando tarefas

Acesse **Tarefas** no menu lateral. A tela possui duas áreas de status:

- **Pendentes:** itens que aguardam sua ação;
- **Concluídas:** histórico de tarefas que você já executou.

As pílulas de processo restringem a lista a um serviço específico e exibem sua quantidade. **Todos** remove essa restrição.

Escolha a visualização de cartões ou tabela. Em telas menores a interface utiliza cartões, preservando processo, número, tarefa, resumo, requerente e prazo.

### Informações apresentadas

| Informação | Como utilizar |
|---|---|
| **Processo** | Confirma o serviço ao qual a tarefa pertence. |
| **Número** | Identifica a requisição. Use-o ao comunicar uma decisão. |
| **Tarefa** | Indica a ação esperada nesta etapa. |
| **Resumo** | Apresenta dados configurados para reconhecer rapidamente o caso. |
| **Requisitante** | Identifica quem iniciou a solicitação. |
| **Prazo** | Mostra vencimento, atraso ou tempo decorrido. |
| **Teste** | Indica que a execução é uma simulação. |

Nos cartões, o processo aparece no canto superior esquerdo e o número da requisição é um botão discreto à direita. O nome da tarefa fica em negrito, seguido do resumo com até três linhas. Requisitante e prazo ficam abaixo, à esquerda e à direita, respectivamente.

O rodapé reúne o indicador de teste, quando aplicável, e as tags disponíveis no modo interno. Quando o conteúdo excede a largura, use as setas ou deslize horizontalmente. Ao passar o mouse sobre o cartão, a indicação **Acessar →** aparece sobre um gradiente. O número abre o acompanhamento da requisição; o cartão abre a tarefa ou seu histórico, conforme a lista selecionada.

## Usando os filtros

Clique em **Filtros** para abrir os critérios avançados.

### Processo, tarefa ou palavra-chave

Pesquisa nomes e textos relevantes. Exemplo: digite `compra de material` para localizar tarefas relacionadas. A pesquisa é aplicada alguns instantes após a digitação.

### Número do processo

Use quando conhecer o número da requisição. Digite somente o valor exibido na interface, por exemplo `184`.

### Data de requisição

Filtra pela data em que a solicitação foi iniciada. Informe somente **De**, somente **Até** ou um intervalo completo.

### Data de recebimento

Filtra pela data em que a tarefa chegou à sua caixa. Esse critério é útil para medir fila de trabalho sem confundir a criação do pedido com a distribuição da etapa atual.

### Ordenação

É possível ordenar por:

- **Prazo**;
- **Nº do processo**;
- padrão de mais recentes quando nenhum critério é escolhido.

O botão ao lado inverte entre ordem crescente e decrescente. Os filtros ativos aparecem como marcadores; remova um individualmente ou use **Limpar tudo**.

## Abrindo e conferindo uma tarefa

Clique no cartão ou na linha. A tarefa abre em uma aba própria. Antes de editar, confirme:

1. nome da tarefa em destaque;
2. processo de origem;
3. número da requisição;
4. setor ou raia, quando informado;
5. selo de teste, quando presente.

O cabeçalho permite abrir o acompanhamento da requisição em outra aba. Use essa opção quando precisar compreender etapas anteriores antes de decidir.

## Preenchendo o formulário

Os campos aparecem conforme a configuração de **Tarefas × Campos**:

- **editável:** aceita inclusão ou alteração;
- **visível:** mostra o valor sem permitir edição;
- **oculto:** não aparece nesta etapa.

Campos obrigatórios possuem indicação visual. Máscaras ajudam a formatar CPF, CNPJ, telefone e outros dados, mas a validação final também ocorre no servidor.

### Anexos

Observe tipo e tamanho permitidos. Aguarde o término do envio antes de concluir. Se o documento foi gerado pelo sistema, confira o conteúdo antes de assiná-lo.

### Fontes de dados

Alguns campos carregam opções de cadastros ou integrações. Se as opções não aparecerem, confirme os filtros preenchidos anteriormente e tente novamente. Não digite um valor alternativo em outro campo para contornar uma lista obrigatória.

### Mensagens

Quando a requisição permite comunicação, uma área adicional mostra mensagens e possibilita novos registros. Utilize texto objetivo e evite inserir informação sensível além do necessário ao processo.

## Salvar e concluir são ações diferentes

### Salvar

**Salvar** grava o estado atual como rascunho e mantém a tarefa pendente. Ele não exige o preenchimento de todos os campos obrigatórios e não executa o próximo caminho do processo.

Use para:

- continuar o trabalho mais tarde;
- preservar um preenchimento longo;
- aguardar uma conferência antes da decisão.

Depois da confirmação **Rascunho salvo**, a aba pode ser fechada. Se aparecer uma mensagem de falha, mantenha a aba aberta e tente novamente.

### Botões de conclusão

Os botões são definidos pelo processo. Podem ter nomes como **Aprovar**, **Solicitar complementação**, **Rejeitar** ou **Encaminhar para parecer**.

Antes de clicar:

1. confira o texto e a orientação do botão;
2. revise campos alterados;
3. verifique documentos e assinaturas;
4. confirme que o caminho escolhido representa sua decisão.

Quando nenhum botão específico foi configurado, a interface apresenta **Concluir**.

### Validação do formulário

Botões que validam o formulário bloqueiam a conclusão quando existe campo obrigatório ou valor inválido. A interface destaca os campos informados pelo servidor.

Alguns botões de devolução podem ser configurados para não validar todos os campos. Isso permite devolver uma solicitação incompleta sem inventar dados apenas para passar pela validação.

### Justificativa obrigatória

Ao usar um botão configurado com justificativa, o sistema abre a janela **Justificar**. Descreva o motivo de forma suficiente para auditoria.

Exemplo adequado:

> Documento de regularidade fiscal vencido em 30/06. Solicitar nova certidão dentro da validade.

Evite justificativas genéricas como `documento errado`.

## Assinando documentos

Quando a tarefa exige assinatura, botões que validam o formulário permanecem bloqueados até que todos os documentos obrigatórios estejam assinados.

### Assinatura individual

Abra a ação do documento, confira o arquivo e conclua a assinatura. Retorne à tarefa e aguarde a atualização do estado.

### Assinar documentos em lote

Quando habilitado, o botão aparece antes das ações de conclusão. Ele assina os documentos elegíveis de uma só vez.

O botão fica desativado quando todos já estão assinados. Ações de devolução que não validam o formulário podem permanecer disponíveis mesmo com assinatura pendente.

## Depois da conclusão

O sistema apresenta uma confirmação. Podem ocorrer dois caminhos:

- se a próxima tarefa também for sua, ela será carregada automaticamente após alguns segundos;
- caso contrário, você poderá fechar ou escolher **Acompanhar processo**.

Não clique repetidamente durante a mensagem **Concluindo…**. A ação já está em processamento.

## Acompanhando requisições

Acesse **Requisições** para ver processos iniciados por você. Filtre por:

- **Em andamento**;
- **Concluídos**;
- **Cancelados**;
- **Todos**.

A busca localiza pelo processo. A paginação exibe vinte itens por página e a visualização pode alternar entre cartões e tabela.

Os cartões mantêm processo e número no topo, status em destaque e resumo com até três linhas. Abaixo ficam as datas de início e conclusão; os indicadores e tags ficam no rodapé. Essa listagem apresenta a execução como um todo, sem acrescentar nomes ou prazos de tarefas ativas. Nas tabelas, as mesmas informações são agrupadas em colunas, com o número acessível por um botão próprio.

## Entendendo o detalhamento

Ao abrir uma requisição, confira o número, o processo, o status e o selo de teste. O detalhamento reúne:

### Visão geral

Apresenta identificação, datas, requerente, situação e dados consolidados do formulário.

### Tramitação

Mostra as etapas percorridas, responsáveis, recebimento, conclusão, prazo e decisão registrada. Use-a para responder perguntas como “em qual setor está?” ou “quando a complementação foi enviada?”.

### Histórico de campos

Quando disponível, permite verificar alterações de um campo, incluindo valor anterior, novo valor, data e responsável. O histórico auxilia auditoria, mas não substitui documentos oficiais anexados ao processo.

### Mensagens e documentos

Mensagens registram a comunicação permitida pelo processo. Documentos podem incluir arquivos enviados, gerados e assinados.

## Ações administrativas sobre a requisição

Usuários com permissões e capacidade no processo podem encontrar ações como:

- **Cancelar:** encerra a execução antes do fim normal;
- **Reabrir:** retoma uma requisição encerrada quando permitido;
- **Devolver:** retorna a uma tarefa já executada;
- **Encaminhar:** cria uma nova etapa conforme a opção disponível;
- **Realocar:** troca o responsável pela tarefa ativa.

Essas ações exigem cuidado porque alteram a tramitação. Registre uma justificativa concreta e confirme o número da requisição antes de prosseguir.

## Exemplo completo

Um fornecedor recebe a tarefa **Apresentar garantia contratual**:

1. abre **Tarefas › Pendentes**;
2. filtra pelo número `184`;
3. confere que a execução não possui selo de teste;
4. anexa o documento no formato solicitado;
5. usa **Salvar** enquanto confere os dados;
6. reabre a tarefa e verifica o anexo;
7. clica em **Enviar garantia**;
8. informa uma justificativa, se solicitada;
9. abre **Acompanhar processo** para confirmar a nova etapa.

## Erros comuns

### A lista ficou vazia

Remova os filtros aplicados, confirme a aba **Pendentes** ou **Concluídas** e verifique o modo de acesso.

### A tarefa não permite concluir

Revise campos destacados, automações, anexos e assinaturas obrigatórias. Se o botão mostrar uma orientação, leia-a antes de tentar novamente.

### Salvei, mas a tarefa continua pendente

Esse é o comportamento esperado. **Salvar** preserva o rascunho; somente um botão de conclusão avança o fluxo.

### O botão escolhido levou a outro caminho

Os botões podem controlar condições do fluxo. Consulte a tramitação e comunique o administrador do processo se o comportamento divergir da regra aprovada.

### O prazo parece incorreto

Confirme a data de recebimento, a configuração de horas úteis e se o prazo é fixo ou derivado de um campo do formulário.

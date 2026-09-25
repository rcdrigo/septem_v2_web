> Atualização de 23/09/2026: a conversão com preservação substitui todas as referências históricas abaixo a limpeza/reinício do ambiente.

# Formulários nativos — requisitos de desenvolvimento por etapas

Status em 20/09/2026: E1–E4 implementadas. E5–E7 receberam validação de referências/publicação, autorização e persistência de automações, prévia por versão, integração de fontes/documentos e remoção da dependência form-js. Build, suíte de formulários/automação e 69 testes backend passaram. O usuário optou por executar a limpeza manualmente; o procedimento foi entregue e testado em banco descartável. A conclusão integral permanece condicionada aos limites registrados em [E7](formularios-nativos-e7.md). Consulte também [E5](formularios-nativos-e5.md), [E6](formularios-nativos-e6.md) e o [guia de limpeza](formularios-nativos-limpeza.md).

Fontes: [decisões do desenho](formularios-nativos.md), [ADR 0004](../adr/0004-formularios-nativos-sem-form-js.md), [glossário](../../CONTEXT.md) e anexo SGI-V2-Redesenho-Formulario-Passo-a-Passo-2.md. As decisões da entrevista prevalecem sobre o anexo, especialmente no descarte do legado, nas automações e nas regras de tabelas.

## Objetivo e limites

Substituir completamente o form-js por editor, renderização e definição de formulário próprios. Bibliotecas auxiliares são permitidas. Reaproveitar o runtime React existente quando compatível com os requisitos. A primeira versão completa inclui todas as etapas abaixo; a divisão não autoriza retirar capacidades acordadas da entrega final.

Decisão revista em 23/09/2026: preservar e converter formulários antigos, mantendo requisições, respostas, versões, histórico e anexos. A migração não transfere requisições para outra versão. Casos sem representação equivalente devem bloquear a conversão com diagnóstico, sem perda silenciosa. Consulte o [procedimento de migração](formularios-nativos-migracao.md).

Não fazem parte desta entrega: ação de duplicar campos, migração de requisições entre versões ou seleção automática de revisões de automação por compatibilidade. Automações continuam publicadas independentemente do formulário.

## Sequência de entregas

| Etapa | Resultado verificável | Dependências |
| --- | --- | --- |
| E1 — Contratos e persistência | Definição nativa e respostas com identidade e versionamento | Nenhuma |
| E2 — Editor estrutural | Criar abas, grupos e campos sem form-js | E1 |
| E3 — Tabelas e transformações | Editar colunas, converter grupos e reposicionar campos | E2 |
| E4 — Preenchimento e validação | Formulário utilizável, com tabelas e contadores | E1–E3 |
| E5 — Tarefas e publicação | Matriz, referências e publicação integradas | E1–E4 |
| E6 — Automações | Scripts livres, independentes e integrados ao modelo nativo | E4–E5 |
| E7 — Integração e retirada do legado | Ambiente reiniciado e aplicação sem form-js | E1–E6 |

Cada etapa inclui frontend, backend quando necessário e verificação do comportamento entregue. A especificação não fixa endpoints ou tabelas de banco que ainda não foram verificados. Entregas intermediárias não devem ser apresentadas como substituição concluída.

## E1 — Contratos, identidade e persistência

### Requisitos

- **RF01:** definir um formato nativo versionado com a hierarquia Formulário → Aba → Agrupamento → Campo. Cada processo possui um formulário. Aba representa navegação; agrupamento representa organização dos campos, do tipo Grupo Padrão ou Tabela. Elementos de apresentação não são respostas.
- **RF02:** a definição criada pelo editor possui ao menos uma aba e um agrupamento por aba, sem campos soltos, agrupamentos soltos ou aninhamento de abas e agrupamentos em si mesmos. Criar um formulário gera a aba e o Grupo Padrão iniciais.
- **RF03:** cada campo possui identidade interna permanente e chave legível para scripts. Renomear e reposicionar preserva identidade e chave. Alterar a chave exige verificar referências. O contrato deve impedir identidades ambíguas e definir o escopo de unicidade das chaves.
- **RF04:** separar definição, respostas e estado de execução. Salvar respostas apenas de campos pertencentes à definição da versão vinculada à requisição. Campos adicionados somente por script não ampliam essa definição persistida. Novas linhas de uma tabela existente são respostas válidas aos campos de suas colunas.
- **RF05:** alterações estruturais são feitas em rascunho e publicadas em nova versão. Após o reinício inicial, requisições continuam na versão em que começaram; novas requisições utilizam a publicação vigente. Esse vínculo não fixa a revisão da automação.
- **RF06:** inventariar os consumidores atuais do schema e registrar sua adaptação: editor, prévia, preenchimento, persistência no processo, matriz, condições de gateway, seletores de campos, fontes, documentos e automações, conforme os usos encontrados. Registrar também as dependências de dados que a limpeza final atingirá.

### Critérios de aceite

- **CA01:** salvar e reabrir uma definição com duas abas, Grupo Padrão e Tabela preserva identidades, ordem, tipos e configurações; renomear e mover um campo não cria outra identidade.
- **CA02:** salvar uma resposta contendo campo criado apenas por script não persiste esse campo; linhas novas de tabela existente persistem seus campos definidos.
- **CA03:** publicar V2 mantém uma requisição iniciada em V1 na definição V1; uma nova requisição usa V2. Mudanças no rascunho não alteram a definição publicada.

**Entrega:** contrato de definição e respostas, persistência funcional e inventário de consumidores e dependências. Testes de contrato devem demonstrar identidade, filtragem de campos desconhecidos e vínculo de versão.

## E2 — Editor estrutural e catálogo

### Requisitos

- **RF07:** substituir o editor form-js por edição nativa. Selecionar um agrupamento destaca o destino; “Adicionar campo” abre o catálogo e insere o tipo escolhido nesse agrupamento, sem arrastar para criar.
- **RF08:** implementar “Nova aba”, já com agrupamento, e “Novo agrupamento”, com escolha Padrão/Tabela. Permitir editar nomes sugeridos, descrição e visibilidade pertinentes pelo painel lateral. O catálogo de campos não oferece Aba nem Agrupamento.
- **RF09:** bloquear a exclusão da última aba e do último agrupamento de uma aba. Oferecer conversão do tipo de agrupamento, implementada em E3, para atender à mudança de estrutura sem violar esses mínimos.
- **RF10:** manter Texto, Área de texto, Número, Data/Hora, Upload, Lista, Opções, checkbox, múltipla escolha e tags. Preservar texto estático, HTML, imagem, separador e espaçador como elementos de apresentação em Grupos Padrão. Manter configurações existentes aplicáveis, incluindo validações e fontes de dados.
- **RF11:** ao trocar o tipo de um campo, preservar identidade, chave, rótulo e configurações compatíveis; remover automaticamente configurações incompatíveis, sem aviso ou confirmação adicional. A verificação de referências de E5 continua aplicável.

### Critérios de aceite

- **CA04:** um processo novo abre com aba e grupo prontos para edição; criar campo exige apenas selecionar o grupo e escolher o tipo, e não permite deixá-lo fora de agrupamento.
- **CA05:** criar outra aba inclui um agrupamento; tentar excluir a última estrutura é bloqueado. Configurações de agrupamento permanecem separadas da ação de adicionar campo.
- **CA06:** o catálogo cobre todos os tipos de RF10. Transformar Lista em Número conserva identidade e rótulo e remove opções incompatíveis sem diálogo de confirmação.

**Entrega:** editor nativo de rascunhos com catálogo completo e persistência de E1. Validar os fluxos de criação e edição pela interface, incluindo seleção inequívoca do destino e operação por teclado.

## E3 — Tabelas, conversão e movimentação

### Requisitos

- **RF12:** ao criar Tabela, solicitar a quantidade de colunas e escolher o tipo de cada uma no catálogo de campos de resposta. O rótulo do campo é seu cabeçalho, sem um segundo atributo de cabeçalho. Linhas são instâncias de preenchimento, não componentes criados no editor.
- **RF13:** permitir adicionar/remover colunas, trocar seus tipos e reordená-las por arrastar. Aplicar RF11 à troca de tipo e a verificação de referências de E5 às alterações.
- **RF14:** permitir reordenar campos e movê-los entre Grupos Padrão, inclusive em abas diferentes, por arrastar. Transferir entre tabelas ou entre Grupo Padrão e Tabela exige ação explícita informando a mudança de cardinalidade. Preservar identidades.
- **RF15:** permitir converter Grupo Padrão ↔ Tabela no rascunho, preservando os campos. Antes de converter um grupo com elementos de apresentação em Tabela, solicitar movê-los para outro Grupo Padrão e oferecer criar esse destino. Não descartar esses elementos nem convertê-los em colunas.

### Critérios de aceite

- **CA07:** criar Tabela com Texto e Número, renomear cabeçalhos, adicionar coluna, reordenar e trocar tipo funciona sem recriar a tabela.
- **CA08:** mover um campo entre grupos de abas distintas preserva sua identidade. A transferência para Tabela usa a ação explícita, não um arraste ambíguo.
- **CA09:** converter Padrão → Tabela → Padrão preserva os campos. Quando houver texto estático ou imagem, a conversão exige seu destino e preserva o conteúdo. Requisições da versão anterior não são convertidas.

**Entrega:** edição completa de agrupamentos e colunas com verificações de identidade e preservação de conteúdo.

## E4 — Preenchimento, abas e pendências

### Requisitos

- **RF16:** adaptar o runtime React e a prévia à definição nativa. Exibir uma aba por vez quando houver múltiplas abas visíveis; ocultar abas sem conteúdo visível e esconder a navegação quando restar uma só, apresentando seus agrupamentos empilhados. Permitir navegar sem completar a aba atual.
- **RF17:** exibir junto a cada título de aba um contador de respostas pendentes, inclusive zero. Contar obrigatórios vazios e valores preenchidos inválidos; cada célula pendente de tabela conta separadamente. Excluir opcionais vazios, campos ocultos e campos sem edição. Recalcular após mudanças de valores ou das regras finais, inclusive por scripts.
- **RF18:** no envio, validar todos os campos aplicáveis à tarefa, inclusive em abas não selecionadas; marcar abas com erros e abrir a primeira que exige correção. A contagem e o bloqueio por validação devem usar o mesmo estado efetivo dos campos.
- **RF19:** uma tabela começa com ao menos uma linha, com campos obrigatórios ou opcionais. A interface mantém a última linha e oferece limpar seus valores em vez de excluí-la. Acrescentar linhas cria novas ocorrências das mesmas colunas. Scripts continuam livres para manipular linhas.
- **RF20:** não persistir linhas inteiramente vazias; reabrir uma tabela sem respostas exibe uma linha inicial. Validar obrigatórios antes desse descarte, sem usá-lo para contornar erros. A implementação deve distinguir ausência de resposta de valores válidos como zero e falso conforme o tipo de campo.
- **RF21:** ocultar ou retirar visualmente um campo preserva seu valor anterior; limpar exige ação explícita. Remover uma linha exclui suas respostas ao salvar. Preservar as capacidades de anexos, fontes de dados e validações no runtime.

### Critérios de aceite

- **CA10:** alternar entre uma, duas e nenhuma aba com conteúdo visível atualiza a navegação sem mostrar abas vazias; com uma aba visível, os agrupamentos aparecem sem cabeçalho de navegação.
- **CA11:** três linhas com CPF obrigatório vazio geram três pendências; preencher uma reduz para duas. Ocultar ou bloquear uma célula a retira da contagem. Campo opcional preenchido com valor inválido conta como pendência.
- **CA12:** enviar a partir da última aba abre a primeira com erro. Corrigir todos os campos mostra zero nos contadores e permite continuar.
- **CA13:** tabela opcional vazia não persiste linha e reabre com uma linha inicial. Uma célula obrigatória vazia bloqueia o envio antes do descarte; zero numérico válido não é descartado como vazio.
- **CA14:** ocultar e reexibir campo mantém a resposta. Remover uma linha intermediária e salvar remove somente suas respostas, preservando as demais linhas.

**Entrega:** prévia e preenchimento nativos com persistência real, contagem e validação coerentes. A integração com scripts fica concluída em E6.

## E5 — Matriz, referências e publicação

### Requisitos

- **RF22:** manter a matriz Tarefas × Campos separada do editor e adaptar a descoberta de campos à hierarquia nativa. Na tabela, a configuração da coluna vale inicialmente para todas as linhas, inclusive futuras. Abas e elementos de apresentação não devem ser confundidos com campos de resposta.
- **RF23:** adaptar os consumidores identificados em E1 para referenciar campos estáveis e resolver o contexto de agrupamento e tabela. Renomear grupos não pode fundir identidades de agrupamentos homônimos.
- **RF24:** apresentar usos conhecidos ao excluir/alterar campos ou modificar chaves. Permitir salvar rascunho com referências declarativas inválidas, mas bloquear publicação até corrigir essas referências. A remoção automática de configurações incompatíveis de RF11 não ganha uma confirmação adicional.
- **RF25:** manter imutável a definição estrutural de uma publicação utilizada por requisições. Publicar alterações como nova versão, sem reescrever respostas anteriores. Validar a estrutura e suas referências também no servidor.

### Critérios de aceite

- **CA15:** campos de grupos em diferentes abas e colunas de tabelas aparecem na matriz e nos seletores pertinentes. Dois agrupamentos com o mesmo nome permanecem distintos.
- **CA16:** excluir campo utilizado em condição de gateway mostra o uso; o rascunho salva e a publicação falha com indicação do problema. Corrigir a referência permite publicar.
- **CA17:** configuração de coluna por tarefa aplica-se às linhas existentes e às novas. Publicar nova estrutura mantém íntegra a execução de uma requisição anterior.

**Entrega:** fluxo editar → configurar tarefas → verificar referências → publicar → abrir requisição integrado, sem dependência de adaptação manual do schema.

## E6 — Automações independentes

### Requisitos

- **RF26:** preservar edição, rascunho, publicação, histórico, prévia e capacidades atuais de automação, adaptando os contratos ao modelo nativo. Scripts continuam podendo alterar estrutura, valores e comportamento. Não introduzir restrição que limite criação de campos, colunas, grupos ou abas ao editor.
- **RF27:** publicar automações independentemente da versão do formulário. Adotar inicialmente scripts adaptáveis, com consulta de existência de campos, verificação de referências detectáveis e testes com versões de formulário em uso. A análise de JavaScript livre não deve ser apresentada como garantia de compatibilidade.
- **RF28:** aplicar a nova publicação na próxima abertura da tarefa; sessões abertas conservam os scripts carregados. Preservar os escopos atuais de código comum e código de tarefa, com código comum executado primeiro.
- **RF29:** carregar configuração inicial da tarefa e aplicar scripts com prioridade sobre ela. Um script pode habilitar campo inicialmente somente leitura, e o valor alterado pode ser salvo. Pode também modificar uma célula sem necessariamente modificar toda a coluna. O servidor continua verificando acesso à requisição, execução da tarefa e integridade dos dados.
- **RF30:** persistir somente respostas de campos definidos, incluindo novas linhas de tabelas existentes. Manipulação visual do schema não altera automaticamente a definição publicada. Recalcular validações e contadores conforme o estado final produzido pelos scripts.

### Critérios de aceite

- **CA18:** publicar automação sem publicar formulário altera a próxima abertura e não a sessão já aberta. Testar o script com duas versões estruturais e usar consulta de existência para tratar um campo ausente.
- **CA19:** script habilita um campo inicialmente somente leitura; alterar, salvar e reabrir mantém o valor. Um usuário sem acesso à tarefa continua impedido de salvar via API.
- **CA20:** script cria “Último sobrenome do usuário” ausente da definição e acrescenta linhas a uma tabela existente. O novo campo não é persistido; as linhas válidas são. Uma célula pode ser bloqueada por script sem bloquear as demais.
- **CA21:** script muda visibilidade, obrigatoriedade ou edição; contador e validação refletem o resultado. Script ocultando um campo já respondido não apaga sua resposta.

**Entrega:** automações integradas ao editor, runtime, prévia e backend, com testes de regressão de publicação independente, persistência e prioridade de comportamento.

## E7 — Integração, limpeza e remoção do form-js

### Requisitos

- **RF31:** integrar todos os pontos de entrada: modelador, prévia, preenchimento público/autenticado, tarefas, anexos, fontes, automações e consumidores de campos inventariados. Não considerar a entrega concluída apenas porque o editor principal foi substituído.
- **RF32 (revisto em 23/09/2026):** converter snapshots antigos para a estrutura nativa com backup, plano revisável e transação, preservando requisições, respostas, vínculos, versões, histórico e anexos. Rejeitar casos incompatíveis antes da escrita. O operador escolhe o ambiente e executa a migração manualmente.
- **RF33:** remover dependências diretas e usos transitivos evitáveis de form-js, wrappers antigos, imports, estilos, contratos exclusivos do legado e dados de exemplo incompatíveis. Verificar o lockfile e os caminhos realmente usados; excluir um import isolado não comprova a retirada completa.
- **RF34:** atualizar manuais e documentação de automações, formato nativo, publicação, tabelas e persistência de campos dinâmicos. Concluir o inventário de E1 com a situação final de cada consumidor.

### Critérios de aceite

- **CA22:** em ambiente reiniciado, criar processo → montar duas abas com grupo e tabela → configurar tarefa → publicar → abrir requisição → preencher manualmente e por script → salvar/reabrir → concluir tarefa funciona de ponta a ponta.
- **CA23 (revisto):** o inventário demonstra conversão dos snapshots compatíveis e preservação das requisições, respostas, versões, vínculos e histórico; bloqueios incompatíveis são explícitos. Reexecutar o plano após migração não reconverte snapshots nativos.
- **CA24:** instalação e build funcionam sem form-js; análise das dependências, imports e estilos não encontra uso operacional remanescente. Prévia e preenchimento funcionam em todos os pontos de entrada encontrados.
- **CA25:** todos os critérios CA01–CA24 estão verificados; limitações e integrações simuladas estão identificadas, sem confundir mocks com persistência ou autorização implementadas.

**Entrega:** aplicação integrada sem form-js, ambiente reiniciado e documentação operacional atualizada.

## Verificação e conclusão

Priorizar testes de contrato para identidade, versões e filtragem de respostas; testes de integração para persistência, publicação, referências e automações; testes de interface para criação guiada, movimentação, conversão, navegação, contadores e linhas. Cobrir os cenários de ausência, erro e reabertura descritos nos critérios.

Na implementação, executar os comandos de tipos, build e regressão disponíveis no projeto, incluindo os testes de formulários e automações aplicáveis e os testes do backend alterado. Descobrir os comandos no checkout usado, sem presumir que a documentação substitui a configuração executável.

Uma etapa está concluída quando seus requisitos foram implementados, seus critérios demonstrados e suas integrações persistem e recarregam os dados corretamente. A substituição completa exige E7 e todos os critérios anteriores; a limpeza inicial não substitui a verificação de versionamento para as novas requisições.

# Simulação e homologação de processos

**Manuais técnicos › Construção de processos › Simulação e homologação de processos**

Este manual explica como testar um processo sem misturar os resultados com a operação normal e como promover uma nova versão para produção.

> **Acesso restrito**
> Para iniciar testes é necessária a permissão `workflow:simulate`. Editar e publicar dependem, respectivamente, de `workflow:write` e `workflow:publish`.

## Conceitos principais

**Simulação** é uma requisição marcada como teste. Durante a simulação, todas as tarefas são direcionadas ao usuário que iniciou o teste, permitindo percorrer o fluxo sem depender dos responsáveis reais.

**Homologação** é uma versão de teste criada ao salvar alterações em um processo que já possui uma versão publicada. A produção continua usando a versão publicada até uma nova publicação.

Esses conceitos são complementares:

- uma simulação pode testar a versão publicada;
- quando existe homologação, a simulação pode testar a nova versão;
- uma requisição normal nunca deve usar a homologação;
- publicar promove a versão preparada para novas requisições de produção.

## Estados da definição

| Estado | Uso recomendado |
|---|---|
| **Rascunho** | Construção inicial antes da primeira publicação. |
| **Publicado** | Operação oficial usada por novas solicitações. |
| **Em homologação** | Alteração de um processo publicado, ainda em teste. |
| **Inativo** | Processo preservado para histórico, sem novos envios. |

Requisições já iniciadas conservam a versão com a qual foram criadas. Publicar uma versão nova afeta novas solicitações.

## Preparando a homologação

1. acesse **Admin › Processos › Processos**;
2. localize a definição publicada;
3. clique no nome ou em **Editar no modelador**;
4. faça as alterações necessárias;
5. execute o diagnóstico do modelador;
6. clique em **Salvar**.

Ao salvar um processo publicado, a mensagem informa que o conteúdo foi salvo em homologação e que produção permanece na versão publicada. O selo **Em homologação** também aparece no modelador e na listagem.

> **Atenção**
> Não use **Publicar** apenas para “salvar melhor”. Publicar muda a versão usada por novas requisições reais.

## Iniciando uma simulação

Abra o serviço como faria um solicitante autenticado. Usuários com `workflow:simulate` veem a opção **Iniciar como teste** no rodapé.

1. marque **Iniciar como teste**;
2. se existir uma versão em homologação, escolha qual versão testar;
3. preencha os dados de teste;
4. clique no botão de início configurado ou em **Iniciar**.

### Produção publicada

Escolha **Produção (publicada)** para verificar o comportamento atualmente disponível aos usuários. Esse teste é útil antes de investigar um incidente relatado.

### Em homologação

Escolha **Em homologação** para validar as alterações salvas. O formulário carregado também vem da homologação, garantindo que campos novos ou modificados sejam realmente exercitados.

## Comportamento das tarefas de teste

Todas as tarefas ficam com o simulador, mesmo quando o fluxo configura área, posição, usuário, campo ou fonte de dados como responsável. Isso facilita o percurso completo, mas não comprova que o responsável real será resolvido em produção.

As tarefas e requisições de teste recebem identificação visual. O cabeçalho, a caixa de tarefas e o detalhamento apresentam o selo de teste.

Dados de teste devem ser reconhecíveis. Use exemplos como:

- razão social: `Empresa de Teste — não protocolar`;
- assunto: `HOMOLOGAÇÃO fluxo de licenciamento`;
- anexo: arquivo sem dados pessoais reais;
- justificativa: `Teste do caminho de complementação`.

## Roteiro mínimo de validação

### 1. Caminho principal

Percorra o cenário mais frequente do início ao fim. Confirme formulários, responsáveis, botões, documentos, mensagens e encerramento.

### 2. Cada decisão

Teste todas as saídas de gateways. Para uma decisão **Documentação suficiente?**, execute ao menos:

- resposta positiva até a aprovação;
- resposta negativa até a complementação;
- retorno da complementação à análise.

### 3. Visibilidade dos campos

Em cada tarefa, confira quais dados estão ocultos, visíveis e editáveis. Verifique especialmente informações internas que não devem aparecer ao requerente.

### 4. Validações

Tente concluir com campos obrigatórios vazios, valores inválidos e anexos incompatíveis. Depois confirme o cenário válido.

### 5. Botões e justificativas

Acione cada botão. Confirme o caminho, a exigência de justificativa, a validação do formulário e o registro na tramitação.

### 6. Documentos e assinaturas

Verifique geração, variáveis, acesso ao arquivo, assinatura individual, lote e bloqueio de conclusão quando obrigatório.

### 7. Eventos e rotinas

Confirme e-mails, timers, marcos, scripts, serviços e fontes de dados. Uma simulação concluída sem observar integrações não valida o processo inteiro.

### 8. Acesso real

Como a simulação concentra tarefas no simulador, faça uma validação complementar com perfis representativos ou personificação autorizada para confirmar acesso e responsáveis.

## Matriz de testes sugerida

| Cenário | Entrada | Resultado esperado |
|---|---|---|
| Aprovação direta | Documentos completos | Processo segue para emissão. |
| Complementação | Certidão ausente | Botão cria tarefa para o requerente. |
| Rejeição | Atividade incompatível | Caminho de indeferimento e justificativa. |
| Prazo | Tarefa com prazo curto | Indicador e alerta no momento esperado. |
| Assinatura | Documento gerado | Conclusão bloqueada até assinatura. |
| Acesso | Usuário sem regra de início | Serviço não disponível para iniciar. |

Registre número da execução de teste, versão utilizada, cenário e resultado. Isso permite repetir o teste depois de uma correção.

## Publicando a versão homologada

Publique somente quando:

- o diagnóstico não apresentar erros relevantes;
- todos os caminhos tiverem sido exercitados;
- dados internos e externos estiverem separados;
- responsáveis e prazos tiverem sido verificados;
- documentos e integrações tiverem sido validados;
- a aprovação administrativa necessária estiver registrada fora ou dentro do procedimento definido pelo órgão.

No modelador, clique em **Publicar**. Na listagem administrativa, um rascunho também pode apresentar a ação **Publicar**, mas erros que exigem decisão detalhada devem ser resolvidos no modelador.

Depois da publicação:

1. confirme o estado **Publicado**;
2. abra o serviço sem marcar teste;
3. confira título, descrição e formulário inicial;
4. inicie uma requisição real somente se houver autorização para o teste pós-publicação.

## Inativar e excluir

**Inativar** impede novas solicitações e preserva versões e histórico. Use quando um serviço deixa de ser oferecido ou precisa ser suspenso.

**Excluir permanentemente** remove as versões e só é permitido quando não existem solicitações. Se já houver histórico, o caminho adequado é inativar.

## Erros comuns

### Alterei o processo, mas a produção não mudou

Se o estado é **Em homologação**, isso é esperado. A alteração precisa ser testada e publicada.

### A simulação abriu o formulário antigo

Confirme se **Iniciar como teste** estava marcado e se foi escolhida a opção **Em homologação**.

### Todas as tarefas vieram para mim

Esse é o comportamento da simulação. Valide responsáveis separadamente antes da publicação.

### A execução de teste apareceu nos relatórios

Verifique se o relatório ou fonte filtra execuções de teste conforme a finalidade. O selo identifica a execução, mas a exclusão analítica depende da configuração da consulta.

### Não aparece a opção de teste

Confirme a autenticação e a permissão `workflow:simulate`. A opção não é exibida para usuários sem essa autorização.

### Publiquei antes de terminar os testes

Interrompa novas solicitações se necessário, corrija o processo e prepare outra versão. Não apague requisições reais para esconder o problema; preserve o histórico e registre a correção.

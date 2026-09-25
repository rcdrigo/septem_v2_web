# Requisitos dos manuais técnicos do Septem

Data: 13/09/2026. Status: especificação e manuais aprofundados com base no código para revisão técnica; protótipo inicial dos helpers implementado; sem publicação e sem homologação funcional completa.

## 1. Objetivo e entregáveis

Permitir que um administrador ou configurador autorizado utilize os modeladores sem depender de explicações verbais. A documentação deve ensinar a realizar uma tarefa, explicar suas consequências e permitir conferir o resultado.

Entregáveis iniciais:

- [Manual do modelador de processos](modelador-processos.md).
- [Manual do modelador de formulários](modelador-formularios.md).
- Este documento de requisitos para aprofundamento, integração e aceite.

Prints não fazem parte da entrega atual. Sua ausência não pode impedir a compreensão dos passos. Os rascunhos indicam pontos de inserção futura, sem imagens fictícias apresentadas como capturas reais.

## 2. Fontes e compatibilidade

Versões resolvidas no `package-lock.json` inspecionado:

| Dependência | Versão | Papel |
|---|---|---|
| bpmn-js | 18.16.1 | Modelagem e visualização BPMN |
| @bpmn-io/form-js | 1.21.3 | Edição da estrutura de formulários |
| @bpmn-io/form-js-viewer | 1.21.3 | Dependência do ecossistema de formulários; sua presença não determina o comportamento da execução customizada |
| bpmn-js-properties-panel | 5.54.0 | Infraestrutura de painel de propriedades |

A documentação oficial corrente pode descrever funcionalidades posteriores ou específicas da Camunda. A disponibilidade no Septem deve ser confirmada no componente e na execução local antes de entrar no manual como fato.

Referências consultadas:

- [Zeev: Desenhador de processos](https://kb.stoque.com.br/zeev/como-construir-processos/como-desenhar-processos/desenhador-de-processos): referência editorial para hierarquia, progressão do conteúdo e navegação entre assuntos; nenhum texto foi reproduzido.
- [bpmn-js: walkthrough oficial](https://bpmn.io/toolkit/bpmn-js/walkthrough/): estrutura do modelador, diagrama, XML, paleta e extensibilidade.
- [form-js: README oficial](https://github.com/bpmn-io/form-js/blob/main/README.md): distinção entre editor, viewer, playground, schema e dados.
- [Camunda Forms: lista dinâmica](https://docs.camunda.io/docs/components/modeler/forms/form-element-library/forms-element-library-dynamiclist/): referência conceitual para conjuntos repetidos. As opções exibidas no Septem devem ser verificadas separadamente.
- [Documentação local das automações](../form-automation.md): API, permissões, publicação e tratamento de falhas específicos do Septem.

### Regra de precedência

1. O código integrado determina os controles e comportamentos documentados como disponíveis.
2. A documentação local explica decisões e contratos, sujeitos à conferência com o código.
3. A documentação oficial das bibliotecas fundamenta conceitos e capacidades de origem.
4. Uma melhoria proposta deve estar identificada como requisito futuro, nunca escrita como instrução de uma função existente.

Não atribuir ao bpmn-js a execução de processos, nem deduzir suporte a todos os elementos executáveis de BPMN apenas porque podem ser desenhados. Não atribuir ao form-js as regras de autorização, upload, assinatura ou automação do Septem.

## 3. Acesso e autorização

### REQ-AC-01 — Público autorizado

O conteúdo técnico deve ser acessível a quem possuir `manuals:technical` ou a permissão global `*`, conforme a regra existente no backend. Ser usuário interno, ter acesso ao menu Admin ou possuir um perfil com nome “Administrador” não deve substituir a verificação das permissões efetivas.

Evidências: `src/lib/api/manuals.ts`, `src/pages/GuidePage.tsx`; no repositório irmão, `GuideEndpoints.cs` e `ManualsEndpoints.cs`.

### REQ-AC-02 — Autorização no servidor

Filtrar lista, busca, detalhe, links diretos e anexos técnicos no servidor. Esconder a aba Técnico é apenas uma parte da experiência. Não enviar conteúdo técnico nas respostas públicas para depois ocultá-lo no navegador.

As operações de escrita devem continuar exigindo as permissões administrativas já previstas nas APIs, além da restrição técnica aplicável. O manual de leitura não deve conceder implicitamente edição de conteúdo.

### REQ-AC-03 — Coerência de acesso

Helpers, resultados de busca e links relacionados devem seguir a mesma autorização. Uma sessão expirada ou uma permissão revogada deve resultar em estado de acesso apropriado; nunca mostrar conteúdo antigo de outra sessão por cache compartilhado.

O acesso ao manual não concede editar/publicar processos, simular, configurar fontes ou editar JavaScript. Cada artigo deve informar suas permissões operacionais separadamente.

### Critérios de aceite de acesso

- Administrador com `*`: recebe os dois manuais.
- Usuário com `manuals:technical`: recebe os dois manuais, independentemente de ser administrador.
- Usuário interno sem a permissão: não recebe conteúdo técnico.
- Usuário externo sem a permissão e visitante: não recebem conteúdo técnico.
- Acesso direto a capítulo, busca e imagem obedece à mesma regra.
- Logout/troca de conta remove conteúdo técnico do estado e do cache visível.

## 4. Contrato editorial dos manuais

### REQ-ED-01 — Progressão do conteúdo

Cada manual deve começar por uma explicação curta do resultado que ensina a alcançar. Em seguida, deve apresentar: visão geral; preparação; reconhecimento da interface; primeira tarefa completa; aprofundamento por conceito ou recurso; validação; erros comuns; demonstração prática; assuntos relacionados e navegação anterior/próxima.

Essa é uma sequência editorial, não um formulário repetido em toda seção. Cada assunto deve receber somente os blocos úteis para compreendê-lo: conceito, momento de uso, passos, tabela comparativa, exemplo, dica, cuidado ou resolução de erro.

### REQ-ED-02 — Instruções orientadas a tarefas

Uma tarefa deve identificar o controle pelo texto da interface, descrever a ação e informar o resultado observável. Antes dos passos, o texto deve explicar por que e quando a pessoa executaria aquela tarefa. “Configure conforme necessário” não é uma instrução suficiente.

Use um exemplo contínuo de licenciamento fictício para conectar fluxo, formulário, matriz e acesso. Separe claramente o exercício das regras legais de qualquer órgão.

### REQ-ED-03 — Referência de campos

Para cada controle, registrar:

| Informação | Exigência |
|---|---|
| Rótulo e localização | Mesmo nome usado no sistema; aba/seção onde aparece |
| Finalidade | Qual decisão o usuário está tomando |
| Aplicabilidade | Tipos de elemento ou situações em que aparece |
| Valor inicial | Somente quando confirmado no código |
| Valores aceitos | Opções, formato, unidade e limites confirmados |
| Obrigatoriedade | Quando precisa ser preenchido e o efeito de deixar vazio |
| Dependências | Outras opções, cadastros ou permissões necessários |
| Efeito | O que muda no editor, na execução ou na publicação |
| Exemplo | Valor fictício acompanhado da explicação |
| Falha | Mensagem real, causa provável e ação de recuperação |

Quando o comportamento depender do ambiente, dizer como consultar a configuração, sem inventar limites de arquivo, prazos ou exigências administrativas.

### REQ-ED-04 — Exemplos verificáveis

Usar um exemplo contínuo de licenciamento fictício. Distinguir o modelo de exercício das regras legais de qualquer órgão. Incluir pelo menos um caso válido, um inválido e uma exceção por funcionalidade que envolva decisão ou validação.

### REQ-ED-05 — Recursos editoriais

- Usar tabelas para comparação de elementos, estados ou escolhas, e não para transformar toda configuração em ficha técnica.
- Posicionar dicas e cuidados imediatamente depois da regra que qualificam.
- Reunir falhas previsíveis em **Erros comuns**, com causa provável e recuperação.
- Manter IDs de helper, critérios de autorização e detalhes de implementação neste documento de requisitos, sem expô-los no corpo didático.
- Reservar comentários HTML nos pontos de imagem para que os prints sejam incluídos posteriormente sem interromper a leitura atual.
- Encerrar com demonstração prática, assuntos relacionados, anterior/próximo, data e estado de validação.

### REQ-ED-06 — Estado de validação

Registrar versão do manual, revisão do código, autor/revisor e estado: rascunho, revisado tecnicamente ou validado em execução. Os documentos atuais são rascunhos baseados no código, não uma homologação funcional completa.

## 5. Cobertura do modelador de processos

| ID | Funcionalidade | Detalhamento exigido | Exemplo e verificação |
|---|---|---|---|
| PROC-01 | Abrir/criar/renomear | Caminho administrativo; processo novo/existente; confirmar e cancelar nome; identificar alterações pendentes | Salvar exercício e retomar pela listagem |
| PROC-02 | Navegar no diagrama | Selecionar elementos e conexões; mover; zoom; desfazer/refazer e atalhos efetivamente habilitados | Corrigir uma posição e desfazer; atalhos só após confirmação da integração |
| PROC-03 | Elementos BPMN | Nome, finalidade e configurações de cada elemento realmente suportado; distinguir desenho de execução | Início, tarefa humana, decisão e fim; marcar como não comprovados os demais elementos até validar suporte |
| PROC-04 | Conexões | Direção, nome visual e condição operacional; caminhos sem destino; retorno para etapa anterior | Complementação retorna à análise |
| PROC-05 | Responsáveis | Todos os seletores oferecidos pelo painel; origem dos cadastros; condições de atribuição; efeito de ausência de responsável | Testar recebimento com perfil representativo, além da simulação administrativa |
| PROC-06 | Botões | Adicionar, editar, remover; rótulo, ajuda, ícone, cores, validação e vínculo com condições quando disponíveis | Concluir análise versus solicitar complementação |
| PROC-07 | Condições | Modos, botão, campo, operador, valor, conectores E/OU, caminho padrão; valores vazios e condições sobrepostas | Caso verdadeiro, falso e sem dado; uma única saída padrão |
| PROC-08 | Identificação | Nome, categoria, unidade, descrição, URL, ícone e resumo; sintaxe de variáveis qualificadas | Resumo com razão social e número da requisição |
| PROC-09 | Acesso | Visualizar/iniciar; permitir/bloquear; comportamento sem regras; conta administrativa; Central e anonimato | Conta autorizada, bloqueada e sem regra |
| PROC-10 | Tarefas × Campos | Linhas/colunas, Início, oculto/visível/editável; aplicação individual e em lote; relação com relatório/requisitante | Parecer oculto no início e editável na análise |
| PROC-11 | Configurações especializadas | Inventariar prazos, mensagens, assinatura e tarefas automáticas presentes; documentar cada controle antes de declarar cobertura completa | Casos específicos conforme os editores encontrados; sem inferir comportamento do motor pela biblioteca |
| PROC-12 | Salvar/versionar/publicar | Estado inicial, homologação, versão publicada, ações pendentes, falha/conflito e retorno do servidor | Salvar mudança de processo publicado e conferir homologação |
| PROC-13 | Testar | Permissão, marca de teste, seleção produção/homologação, concentração de tarefas e suas limitações | Percorrer todos os caminhos e depois verificar acesso com outra conta |
| PROC-14 | Importar/exportar | Formatos, substituição do trabalho, dependências, exportação BPMN e PNG, mensagens de falha | Reabrir definição exportada em ambiente de teste |
| PROC-15 | Diagnósticos | Onde consultar; separar impedimentos, avisos e falhas; localizar elemento; corrigir e revalidar | Corrigir um apontamento sem perder alterações |
| PROC-16 | Abas e barra superior | Avisos de diagnóstico; Fluxo; Formulário; Tarefas × Campos; Configurações; Recursos; nome; estado; Salvar e Publicar | Localizar uma pendência, alternar de visão sem perder o contexto e distinguir salvar de publicar |
| PROC-17 | Paleta do fluxo | Ferramentas de navegação e conexão; Início; Fim; tarefas; eventos; gateways; piscina e raias | Escolher cada elemento pela finalidade e conferir se possui execução confirmada |
| PROC-18 | Painéis por elemento | Informações gerais; formulário; responsáveis e prazos; botões; assinaturas; rotinas; fontes; e configurações especializadas | Configurar uma tarefa humana completa e comparar as seções disponíveis nos demais elementos |

Fontes já lidas: `ModeladorPage.tsx`, `ModeladorNavbar.tsx`, `ConfiguracoesView.tsx`, `TarefasCamposView.tsx`, `GatewayConditionEditor.tsx`, `ActionButtonsEditor.tsx`.

O manual aprofundado cobre esse inventário com base na interface e no motor inspecionados. A cobertura editorial não equivale a homologação: os comportamentos marcados como não confirmados continuam exigindo teste funcional antes de uso produtivo.

## 6. Cobertura do modelador de formulários

| ID | Funcionalidade | Detalhamento exigido | Exemplo e verificação |
|---|---|---|---|
| FORM-01 | Editor | Paleta, área central, seleção e painel; carregamento; diferenças entre editor e execução | Adicionar e configurar um campo |
| FORM-02 | Grupo | Adicionar, organizar, nome/ícone e contador de pendências; grupos na execução em abas/empilhados | Dados do empreendimento e análise interna |
| FORM-03 | Lista dinâmica | Estrutura repetida; campos filhos; chave e valores em coleção; dependências em relatórios/automações | Zero, um e dois equipamentos |
| FORM-04 | Texto e área de texto | Nome/chave; ajuda; limites; documento/máscara quando disponíveis; diferenças de uso | Razão social versus descrição da atividade |
| FORM-05 | Número | Tipo de dado, limites, prefixo/sufixo e valores vazios; não confundir adorno com transformação do valor | Quantidade mínima 1: testar 0 e 1 |
| FORM-06 | Data / Hora | Modos de seleção; restrições disponíveis; referência à data do servidor; exibição e preenchimento | Caso permitido e caso bloqueado por restrição |
| FORM-07 | Upload | Extensões, obrigatoriedade, visibilidade, envio; limites do ambiente; geração por modelo e assinatura relacionada | Anexo recebido versus documento gerado |
| FORM-08 | Seleção | Lista, radio, checkbox, checklist e tags; cardinalidade; rótulo/valor; fonte de opções | Uma atividade versus múltiplas opções |
| FORM-09 | Apresentação | Texto estático/Markdown, HTML, imagem/alternativo, separador e espaçador; ausência de dado de entrada | Orientação entre grupos e imagem com descrição |
| FORM-10 | Nome/chave | Confirmação ao sair, derivação automática, chave manual, normalização, colisão e referências existentes | Renomear rótulo após personalizar a chave |
| FORM-11 | Aparência | Colunas, largura, prefixo/sufixo; grade de execução; herança do container e tela estreita | Dois campos de 8 colunas no desktop |
| FORM-12 | Validação | Obrigatório; limites de texto/número; CPF/CNPJ; máscara com/sem validação; botão que valida ou dispensa validação | Vazio, valor inválido e limite exato |
| FORM-13 | Ajuda | Inline/popover, editar orientações, confirmação, conteúdo útil e diferença do helper técnico | Instrução com formato e exemplo |
| FORM-14 | Visibilidade | Relatório, requisitante e matriz por etapa; sobreposição das regras | Parecer interno não exposto ao solicitante |
| FORM-15 | Fontes de dados | Tipos compatíveis, seleção, carregamento, edição, falha, rótulo/valor e dependências | Fonte vazia/indisponível e condição por opção |
| FORM-16 | Máscaras | Cadastro/seleção, regex/template/validação conforme editor, tipos compatíveis e interação com Documento | Comparar formatação com bloqueio efetivo |
| FORM-17 | Eventos e JavaScript | Separar configuração de eventos do campo da área de automação; permissão própria, escopos, prévia, salvar/publicar e histórico | Regra por alteração de campo e validação antes de enviar |
| FORM-18 | Prévia/importação | Prévia visual, teste real, bloqueio por instâncias existentes, salvar no processo e dependências de versão | Formulário válido na prévia e conferido em cada tarefa |

Fontes já lidas: `FormFieldsPalette.tsx`, `FieldConfigPanel.tsx`, `FormularioView.tsx`, `TarefasCamposView.tsx`, `src/styles/globals.css` e `docs/form-automation.md`.

### Requisitos específicos de automação

O capítulo avançado deve explicar, sem confundir com API nativa de form-js:

- `forms:javascript` e a necessidade de um processo salvo.
- Código comum e script da tarefa; ordem de execução.
- Aplicar proposta ao editor, salvar rascunho e publicar como ações diferentes.
- Versionamento independente do BPMN e comportamento das sessões já abertas.
- `form.get/set/getData`, manipulação de estrutura, visibilidade, obrigatoriedade, opções e eventos.
- `form.beforeSubmit`, retorno `false`, exceções, pendências e bloqueio de envio.
- Fontes de dados autenticadas, chamadas externas e limpeza de listeners/timers.
- Histórico, restauração e conflito sem sobrescrita automática.
- Limites da análise estática e da simulação. Simular envio não envia o formulário, mas chamadas AJAX do código podem executar normalmente.

Os exemplos devem ser conferidos na documentação local e na implementação antes de serem oferecidos como código pronto para copiar.

## 7. Helpers contextuais — especificação futura

### REQ-HELP-01 — Destino preciso

Cada funcionalidade deve ter um identificador estável associado ao manual e capítulo, independente do título exibido. Exemplos: `processos/condicoes`, `processos/publicacao`, `formularios/identificadores`, `formularios/validacao`.

O Guia aceita `manualKey` e `section` na URL. A chave do manual é resolvida para o ID gerado pelo servidor, e a chave da seção é resolvida para o título correspondente no conteúdo. O protótipo inicial registra `modelador-processos`, `responsaveis-prazos`, `botoes-acao` e `salvar-publicar`. Novos helpers devem ampliar o mesmo registro sem vincular os componentes aos IDs do banco.

### REQ-HELP-02 — Posicionamento

| Local | Destino |
|---|---|
| Barra do modelador de processos | Visão geral do manual de processos |
| Editor de condições | Condições e caminho padrão |
| Controle de acesso | Identidade e acesso |
| Tarefas × Campos | Matriz e visibilidade |
| Salvar/Publicar/Versionar | Ciclo de versões e publicação |
| Diagnóstico “Tudo certo/avisos/erros” | Diagnósticos e localização de problemas |
| Paleta do fluxo | Ferramentas e catálogo de elementos BPMN |
| Painel Informações gerais | Identificação do elemento |
| Responsáveis e prazos | Atribuição, calendário, prazo e alertas |
| Botões de ação | Resultados da tarefa e vínculo com condições |
| Assinaturas | Campos assináveis e bloqueio de conclusão |
| Rotinas | Momentos de execução e limitações atuais |
| Cabeçalho do formulário | Visão geral do manual de formulários |
| Chave do campo | Identificadores e dependências |
| Máscara/Documento/Validação | Regras de preenchimento |
| Fonte de dados | Opções e dependências |
| Orientações | Ajuda de preenchimento |
| Upload/documento | Anexos, geração e assinatura relacionada |
| JavaScript | Capítulo avançado e documentação de automação |

### REQ-HELP-03 — Comportamento

Abrir pelo clique, toque ou teclado. Usar nome acessível específico, como “Ajuda sobre condições do gateway”. Não depender apenas de tooltip ou hover.

A abertura deve acontecer sempre em uma nova aba do navegador. Ela não deve salvar, publicar, reiniciar nem descartar alterações do modelador. Como a aba original permanece aberta, o usuário retorna ao mesmo campo, elemento, posição e contexto de edição.

No celular, o conteúdo pode ocupar a tela inteira. Todos os capítulos, busca e referências devem permanecer acessíveis. Helpers devem aparecer apenas para quem pode ler o manual técnico.

### REQ-HELP-04 — Casos de falha

Artigo ausente: informar indisponibilidade e oferecer índice técnico autorizado. Sessão expirada: solicitar autenticação e preservar o destino. Sem permissão: explicar acesso restrito sem revelar corpo ou imagens. Não substituir silenciosamente uma ajuda específica por um artigo sem relação.

## 8. Leitura, busca e imagens futuras

- Índice por manual, sumário por capítulo e anterior/próximo.
- Busca por controles e termos do usuário; exemplos de sinônimos: conexão/seta, condição/gateway, campo/chave, anexo/upload, homologação/teste.
- Link direto para o resultado, com contexto do manual e capítulo.
- Referências entre formulário, matriz e processo, sem duplicar instruções que possam divergir.
- Leitura em 320, 375, 414, 768 px e desktop. Tabelas extensas podem ter rolagem própria identificada; a página inteira não deve transbordar.
- Hierarquia de títulos, foco visível e ordem de leitura coerente.
- Inclusão posterior de imagens com legenda, texto alternativo, versão/data da captura, ampliação e controle de acesso. O caminho da imagem também deve exigir autorização quando contiver conteúdo técnico restrito.
- Não expor um manual ou suas imagens como recurso público estático em uma futura implementação protegida apenas por esconder o menu.

## 9. Limitações conhecidas que os manuais não devem mascarar

1. `FieldConfigPanel.tsx` utiliza `hidden ... lg:flex`; o painel de propriedades do formulário não está disponível em larguras menores. A disponibilidade integral no celular é requisito do produto, não algo que um texto possa afirmar já resolvido.
2. A paleta e os painéis são customizados. Não copiar instruções da interface padrão da Camunda como se fossem do Septem.
3. A execução usa `ReactForm`; suportar um tipo no editor não comprova todas as suas propriedades na execução.
4. O README geral contém descrições antigas de fase standalone. Para persistência, prevalece a implementação atual inspecionada.
5. Tarefa de serviço, subprocesso, timer e marco são persistidos e atravessados pelo motor atual, sem executar o comportamento especializado descrito no painel. Não apresentá-los como automações operacionais.
6. Os vínculos de rotinas são persistidos, mas não foi localizada a chamada correspondente no motor. A atribuição de responsável por fonte de dados também não está resolvida e recai no requisitante.
7. No gateway inclusivo, a saída marcada como padrão é percorrida mesmo quando outras regras são atendidas. Tratar como limitação conhecida e impedir recomendação produtiva desse arranjo até correção e homologação.
8. A cobertura dos painéis está baseada no código. Casos de ambiente, integrações e mensagens devem passar por homologação funcional antes de o estado editorial mudar para validado em execução.

## 10. Critérios de aceite editorial

- Cada controle inventariado tem instrução específica, finalidade e consequência.
- Cada capítulo tem pré-requisitos ou herda explicitamente os do manual.
- Nomes de botões, abas e mensagens correspondem à versão documentada.
- Exemplos indicam dados de entrada e resultado observável.
- Decisões e validações incluem cenários negativo e de limite aplicáveis.
- Diferenças entre salvar, versionar, publicar e testar estão explícitas.
- Funcionalidades de biblioteca não integradas não são anunciadas como disponíveis.
- Conteúdo técnico e ajuda de preenchimento têm público e autorização distintos.
- Nenhuma etapa depende de um print para ser entendida nesta fase.
- Todos os helpers propostos têm destino na cobertura editorial. O protótipo inicial cobre Responsáveis e prazos, Botões de ação e Salvar/Publicar; os demais pontos da tabela REQ-HELP-02 continuam como expansão prevista.
- Revisão de cada versão do editor inclui revisão dos capítulos afetados.

## 11. Sequência de trabalho proposta

1. Revisar os dois rascunhos e o nível de detalhe com o responsável pelo produto.
2. Completar o inventário de painéis especializados, defaults, atalhos e opções não aprofundados.
3. Conferir os exemplos contra a execução e registrar diferenças encontradas.
4. Implementar navegação contextual e autorização de conteúdo/imagens após aprovação desse escopo.
5. Incorporar prints fornecidos manualmente e revisar sua correspondência com os passos.
6. Publicar os manuais técnicos pelo fluxo autorizado do sistema.

A entrega atual encerra a especificação e disponibiliza os rascunhos para revisão. Não altera processos, permissões ou manuais publicados no ambiente remoto.

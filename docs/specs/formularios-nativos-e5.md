# E5 — Matriz, referências e publicação

Status: **iniciada em 20/09/2026; etapa ainda não concluída**. Primeiro incremento: descoberta nativa compartilhada pela matriz e pelos seletores, com identidade de agrupamento. Escopo completo em [requisitos por etapas](formularios-nativos-etapas.md).

## Primeiro incremento

- `extractFields` reconhece a hierarquia nativa, incluindo campos de todas as abas e colunas de tabelas. Exclui elementos de apresentação e os próprios containers.
- Os descritores conservam a identidade permanente do campo, aba e grupo, além da chave de tabela e do caminho de resposta (`itens[].produto`). Grupos homônimos permanecem separados mesmo quando as abas também têm nomes iguais; renomear mantém a identidade.
- A matriz e o painel de visibilidade usam a identidade do agrupamento como chave. Seus títulos incluem o contexto de aba e indicam tabelas; ações em massa de um grupo não atingem seu homônimo.
- O seletor compartilhado mostra aba/grupo e caminho de tabela. O valor persistido continua sendo a chave que os consumidores BPMN atuais resolvem. O `id` histórico do descritor representa essa chave; `fieldId` representa a identidade permanente. Isso não conclui a adaptação de todos os consumidores de RF23.
- O editor atualiza o catálogo ao carregar, editar e importar. Ao abrir matriz/painéis, o rascunho é sincronizado com o BPMN antes da leitura; os consumidores acompanham importações e mudanças. Ausência ou definição inválida limpa o catálogo para não oferecer campos do processo anterior.
- O servidor já aplica regras nativas por chave de coluna em `TaskFormSchema` desde E4. Não foi alterado neste incremento. A persistência e execução por linha ainda precisam ser verificadas na jornada integrada E5.

## Verificação

- `npm run test:native-task-fields`: teste novo com React real, Chrome headless e modeler simulado. Verifica descoberta de cinco respostas em duas abas, exclusão de apresentação, contexto de tabela, grupos homônimos, renomeação, ação em massa isolada, configuração de coluna por chave, abertura com rascunho ainda não sincronizado e troca para processo sem definição/inválido.
- `npm run test:native-forms`: contratos de definição/editor passaram.
- `native-form-editor.mjs` e `modelador-startup.mjs`: passaram, incluindo os quatro cenários de inicialização.
- `npm run typecheck` e `npm run build`: passaram; permanece o aviso de tamanho do bundle.
- `form-regressions.mjs`: 68 verificações passaram. `form-automation.mjs` e `data-source-sql.mjs`: passaram.
- A sequência completa `test:forms` não foi executada; a pendência preexistente de `form-publication.mjs`, registrada em E1, não foi reavaliada.

O novo teste foi adicionado à sequência `test:forms`. Seu modeler simulado não comprova round-trip em servidor, autorização, publicação ou persistência HTTP. CA15 tem cobertura da matriz e descoberta compartilhada; falta concluir a revisão de todos os seletores pertinentes.

## Trabalho restante da etapa

1. Inventariar referências declarativas conhecidas (gateways, tarefas, fontes, documentos, consultas e demais consumidores de E1), com resolução de identidade e cardinalidade apropriada a cada contexto.
2. Exibir usos ao excluir/alterar campos e modificar chaves; permitir salvar rascunhos com referências inválidas sem acrescentar confirmação à limpeza de configurações incompatíveis.
3. Validar referências no servidor e impedir publicação com indicação acionável do problema; verificar a correção seguida de publicação (CA16).
4. Verificar regras de coluna em linhas existentes/futuras e a execução de requisição anterior após nova publicação (CA17), incluindo persistência real.

Não houve alteração de backend, implantação ou limpeza de ambiente neste incremento. E5 permanece em andamento; E6 e E7 permanecem pendentes.

## Atualização de integração — 20/09/2026

Os itens anteriores descrevem o primeiro incremento. Foram acrescentados usos conhecidos no editor, edição de chaves sem troca de identidade e validação de referências no servidor (gateways, matriz, ator, prazo, timer, subprocessos, assinaturas e regras locais de documentos). Testes HTTP permitem rascunho inconsistente, rejeitam publicação e comprovam publicação após correção. Colunas não são aceitas em referências que exigem escalar.

A suíte completa `test:forms`, incluindo publicação, passou. Permanecem em revisão referências externas ao BPMN e contextos de documentos por linha; consulte [E7](formularios-nativos-e7.md). As afirmações de ausência de alterações no backend acima aplicavam-se apenas ao primeiro incremento.

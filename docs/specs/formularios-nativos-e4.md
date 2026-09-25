# E4 — Preenchimento, abas e pendências

Implementação em 20/09/2026 para RF16–RF21 e CA10–CA14 dos [requisitos por etapas](formularios-nativos-etapas.md). A entrega adapta o runtime React e a prévia ao contrato nativo de E1–E3. A configuração completa de tarefas/referências, a API nativa de automações e a retirada do legado continuam em E5–E7.

## Comportamento entregue

- `ReactForm` reconhece a definição nativa e deriva um modelo de visualização interno. Esse modelo reutiliza os controles React e nunca substitui a definição persistida. Campos conservam IDs, chaves, configuração, máscaras, datas, apresentação e fontes de opções.
- Abas sem conteúdo visível desaparecem. Duas ou mais abas exibem navegação com teclado; com uma, os grupos ficam empilhados sem barra; com nenhuma, aparece uma mensagem de ausência de campos. A seleção acompanha a identidade da aba, com retorno à primeira disponível quando necessário.
- Todas as abas visíveis ficam montadas, mas somente a selecionada é exibida. Isso conserva datas parcialmente digitadas e controles de upload durante a navegação.
- Cada título de aba mostra a quantidade de pendências, inclusive zero. Obrigatórios sem resposta e opcionais preenchidos inválidos contam; campos ocultos e sem edição não contam. Células são verificadas pelo caminho `tabela.indice.coluna`.
- Contadores e envio usam `validateForm` com o mesmo schema, valores, estado de célula e erros locais de data. Enviar valida todas as abas, marca as que possuem erros e abre a primeira com correção necessária. O formulário somente leitura não cria pendências.
- Tabelas exibem colunas com seus rótulos como cabeçalhos, uma linha inicial, ação de acrescentar e exclusão por linha. A última linha oferece **Limpar linha**. A remoção reindexa erros e estado por célula e conserva as demais respostas. No celular, a rolagem fica dentro da tabela, com orientação visível.
- Ocultar um campo ou retirá-lo do modelo visual não apaga sua resposta. O filtro de gravação usa a definição original da sessão e o servidor usa a versão vinculada à execução. Campos criados somente em runtime não ampliam o contrato de persistência.
- **Prévia** no modelador abre o mesmo preenchimento React, com ação **Validar preenchimento**. Os valores de teste não são gravados nem enviados ao backend.

## Validação e persistência

`native-form-runtime.ts` prepara linhas iniciais e serializa respostas conhecidas. Linhas inteiramente vazias saem do payload somente após validar o envio; `getData()` permite salvar rascunhos incompletos. Zero numérico e falso booleano são respostas, não ausência. Checkbox nativo obrigatório exige resposta explícita, podendo ser `false`; a semântica do legado permanece separada.

No backend, `NativeForm.RuntimeComponents` permite reutilizar validações e descoberta de fontes. `FormValidator` valida abas, grupos e células nativas; tabela ausente ou sem linhas é validada como uma linha inicial antes do descarte. `TaskFormSchema` mantém os campos na definição e aplica visibilidade/edição em `config`, sem apagar respostas. A autoria da matriz permanece em E5.

`FormValueProjector` filtra respostas contra a versão da requisição e descarta linhas vazias na gravação, incluindo rascunhos. Uma tabela enviada substitui suas linhas completas; chaves de topo omitidas preservam respostas anteriores. A projeção é atualizada na mesma transação. Salvar rascunho vazio não contorna obrigatórios: concluir a tarefa volta a validar a linha inicial.

O endpoint de upload reconhece campos nativos em grupos e tabelas, mantendo a política de tamanho/extensões e o armazenamento existente. O teste de API faz upload real no storage local de testes, verifica rejeição de extensão, baixa o arquivo e grava/reabre sua referência na célula. Configurações de geração de documentos e assinaturas continuam com seus consumidores previstos em E5/E7; esta etapa não comprova esses fluxos por ocorrência de tabela.

## Verificações

- Tipos e build do frontend: passaram; permanece o aviso de tamanho do bundle.
- `npm run test:native-forms`: contratos E1–E3 passaram.
- `node tools/uitest/native-form-runtime.mjs`: CA10–CA14 em 1440 e 390 pixels, com fontes simuladas, estados por célula, datas parciais entre abas, adição/limpeza/remoção de linhas, preservação de respostas e alteração de regras antes do envio. Usa React real e serialização; não representa persistência HTTP.
- `native-form-editor.mjs`, `native-form-structure.mjs` e `modelador-startup.mjs`: regressões do editor, transformações e quatro cenários de inicialização passaram; APIs simuladas, bpmn-js real na inicialização.
- `form-regressions.mjs`: 68 verificações passaram. `form-automation.mjs` e `data-source-sql.mjs`: passaram.
- Backend: **54 testes passaram**, incluindo testes nativos de contrato/runtime/API, validação, projetor e upload executados contra PostgreSQL 14 temporário em `127.0.0.1:55439`; bancos de teste isolados. Os cenários cobrem validar antes de descartar, rascunho incompleto, reabertura, remoção de linha, projeção, versão da requisição e anexos reais.

Capturas de fixture: `.impeccable/review/native-e4-desktop.png` e `native-e4-mobile.png`. Revisão independente da interface retornou **ship** no escopo E4. Engine/detector Impeccable indisponíveis; não houve aprovação do detector nem auditoria completa de contraste por estilos computados. A conferência independente de documentação confirmou a continuidade dos controles, tokens e composição existentes. `DESIGN.md` e seu sidecar já estavam ausentes; nenhum sistema visual novo foi criado.

## Limites e próximas etapas

A integração completa de scripts com a hierarquia nativa, publicação independente, prioridade sobre configuração de tarefa e validação de autorização continua em E6. Os testes desta etapa usam eventos e operações já disponíveis no runtime para verificar o recálculo; não comprovam todo o contrato E6. O servidor ainda aplica as regras declarativas da tarefa, sem reproduzir o estado arbitrário de JavaScript do navegador.

As páginas que usam `ReactForm` passam a renderizar o formato nativo. E7 ainda deve comprovar a jornada integrada em todos os pontos de entrada, retirar wrappers/dependências antigos e executar a limpeza planejada. Não houve limpeza de banco operacional ou implantação. A sequência completa `test:forms` não foi executada; a pendência preexistente de `form-publication.mjs` registrada em E1 permanece fora do escopo desta etapa.

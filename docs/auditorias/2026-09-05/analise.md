# Auditoria funcional — 05/09/2026

Escopo: modelador, persistência do formulário, renderização e validação na execução, eventos e publicação. Também foi lido o validador do repositório irmão `septem_v2`, sem modificá-lo. P1 = alta prioridade; P2 = média. Nenhuma correção foi aplicada ao produto.

Oito cenários com falha foram reproduzidos em Chrome headless usando os componentes reais, dados fictícios e API simulada. Os resultados estão em [runtime-resultados.json](runtime-resultados.json) e [editor-resultados.json](editor-resultados.json). `npm run typecheck` passou. Não foi executado fluxo completo contra a API real nem uma auditoria exaustiva de todos os módulos.

**Sobre os exemplos relatados:** a mistura de formulários foi reproduzida para processo existente sem schema embutido. Não ocorre necessariamente em todos os processos: um schema válido no XML tem precedência. No código atual, os três modos de data mudaram corretamente no canvas, e a restrição `noPast` foi propagada ao BPMN. Portanto, o defeito genérico de troca de tipo não foi reproduzido; há falhas específicas de validação e estado descritas abaixo. Salvar um processo publicado em homologação também não altera automaticamente a versão de produção, conforme o fluxo implementado.

1. **[P1] Cache global mistura formulários de processos diferentes — reproduzido.**
   `src/components/modelador/views/FormularioView.tsx:101` usa `fromXml ?? fromLs`; a chave de armazenamento na linha 243 é sempre `septem.modelador.form`, sem processo, versão ou tenant. Reproduzido: cache com formulário A, abrir B sem schema, editar um campo; o schema A aparece no canvas e é gravado no objeto BPMN de B pelo polling. Também existe janela de uso do cache antes do XML assíncrono chegar. Corrigir removendo o fallback entre processos ou identificando explicitamente processo/versão/tenant e aguardando o carregamento autorizado.

2. **[P1] Cargas assíncronas podem sobrescrever o formulário mais recente — risco identificado por leitura.**
   `FormularioView.tsx:90–129`: cada `import.done` inicia `load()`, que aguarda fontes de dados. O booleano `cancelled` só muda ao desmontar/trocar o modeler, e não invalida uma carga anterior quando outra começa. Se A demora buscando opções e B termina antes, A ainda pode importar seu schema e liberar o polling sobre B. Falha de importação também é capturada sem impedir que `ready` volte a `true`. Corrigir com identificador de geração por carga, tratamento explícito de erro e bloqueio de persistência enquanto o formulário correto não estiver pronto. Cenário concorrente não reproduzido nesta auditoria.

3. **[P2] “Não permitir passado” aceita o minuto atual no calendário e o rejeita na conclusão — reproduzido.**
   `src/components/form/DatePickerField.tsx:93` zera segundos; `src/lib/datafield.ts:110` compara com segundos/milissegundos. Às 12:34:30, o picker aceitou `2026-09-05T12:34`, sem estado inválido, mas `submit()` retornou “A data não pode ser no passado”. O backend também compara com segundos em `../septem_v2/src/Septem.Infrastructure/Execution/FormValidator.cs:105`. Definir a precisão temporal da regra e aplicá-la igualmente nas três camadas.

4. **[P1] Listas dinâmicas escapam da validação e não exibem os erros de suas linhas — reproduzido no cliente, confirmado por leitura no validador do servidor.**
   `src/components/form/ReactForm.tsx:74` pula `dynamiclist` em `collectInputs`; a linha 694 fornece `errors: {}` a cada linha. Uma linha contendo data de 2000 com `noPast` passou pelo `submit()` sem erros. No backend, `FormValidator.cs:54` desce no template usando o objeto raiz, sem iterar `data[lista]`; os valores das linhas não são alcançados. O runtime das linhas ainda herda eventos/estado do formulário raiz, sem escopo por índice. Implementar percurso de arrays, caminhos de erro por linha e runtime realmente local.

5. **[P1] Anexo obrigatório vazio não é validado no cliente — reproduzido.**
   `ReactForm.tsx:70` não inclui `filepicker` em `INPUT_TYPES`. A verificação de anexos vazios da linha 207 fica inacessível para esses campos. Um anexo obrigatório com `[]` retornou `errors: {}`. Incluir anexos no percurso de validação, separando esse percurso da lista de campos de digitação.

6. **[P1] Validação autoritativa não cobre obrigatoriedade e várias regras configuráveis — confirmado por leitura.**
   `../septem_v2/src/Septem.Infrastructure/Execution/FormValidator.cs:40–72` aceita objeto vazio, ignora chaves ausentes e valida apenas documento e data. Não confere `validate.required`, limites numéricos, comprimentos ou máscaras. Em `ValidateDate`, linha 94, modo `time` retorna sucesso sem verificar o formato. `WorkflowEngine.cs:112` e `:214` chamam esse validador na abertura/conclusão; o caminho de conclusão aplica os dados e conclui a tarefa após essa checagem. Assim, as regras da interface não constituem validação equivalente no servidor. Não foi enviado payload inválido à API real. Implementar validação contra o schema efetivo da tarefa, considerando campos editáveis, valores persistidos e política dos botões.

7. **[P1] Evento `change` recebe o valor anterior — reproduzido.**
   `ReactForm.tsx:379` chama `set()` e imediatamente `runEvent()`. A ação lê `valuesRef.current` na linha 191, atualizado apenas no próximo render. Com `set('b', value)`, alterar A de “antigo” para “novo” deixou B como “antigo”. Afeta cálculos, preenchimento dependente e condições. Atualizar o snapshot síncrono antes do evento ou fornecer explicitamente o novo valor/contexto.

8. **[P2] Campo desabilitado por evento continua obrigatório — reproduzido.**
   A renderização usa `fieldState[key].disabled` em `ReactForm.tsx:365`, mas `validate()` na linha 202 só ignora `c.disabled` e `hidden`. Uma ação `setDisabled('destino', true)` tornou o campo não editável, enquanto a conclusão retornou “Campo obrigatório”. Unificar o cálculo de editabilidade entre renderização e validação.

9. **[P1] A paleta oferece componentes sem implementação equivalente na execução — reproduzido parcialmente.**
   `src/components/form/FormFieldsPalette.tsx:40–53` oferece checklist, tags, HTML, imagem e tabela. Em `ReactForm.tsx:339`, HTML lê `comp.text`, embora o editor grave `content`; imagem sem chave retorna `null` na linha 343. Checklist/taglist não possuem ramo próprio e caem no input de texto da linha 449. Reproduzido: checklist virou `input[type=text]`; HTML configurado e imagem não produziram conteúdo. Implementar os tipos anunciados ou impedir sua inclusão até haver suporte; testar também formato de dados, opções e obrigatoriedade de cada tipo.

10. **[P1] Trocar o formulário mantém valores e opções da versão anterior — reproduzido no componente; caminho real identificado.**
    `ReactForm.tsx:122–133` inicializa `values` e `dsOptions` apenas no primeiro mount. Alterar `data` de “Processo A” para “Processo B” manteve A em `getData()`. `src/pages/ServicoFormPage.tsx:41–43` carrega produção e homologação antecipadamente; na linha 107 usa o mesmo ReactForm sem chave de versão. Alternar entre versões já carregadas pode trocar o schema mantendo valores/opções antigos, inclusive chaves removidas no novo schema. Remontar por identidade de processo/versão ou realizar migração explícita de estado; não resetar indiscriminadamente em refetch para evitar apagar edição em andamento.

11. **[P2] Após publicar, o selo pode continuar indicando homologação/rascunho — confirmado por leitura.**
    `src/pages/modelador/ModeladorPage.tsx:173–175` aguarda o PATCH de publicação, mas chama `afterPersist(r)` com a resposta anterior do salvamento. Essa função grava `r.status` em `statusAtual`, que tem precedência sobre a consulta atualizada. Usar a resposta da publicação ou marcar explicitamente `published` após sucesso. A publicação em si pode ter funcionado apesar do selo errado.

12. **[P2] Exportação BPMN pode perder a última alteração do formulário — confirmado por leitura.**
    O salvamento chama `flushForm` em `ModeladorPage.tsx:90`. A exportação da linha 210 chama `exportBpmn`, que executa diretamente `saveXML` em `src/lib/recursos.ts:11`. Antes do próximo polling de 600 ms, o arquivo exportado pode conter o schema anterior. Aplicar o mesmo flush/aguardo de prontidão em todas as saídas de XML.

Ordem sugerida: isolamento e ciclo de carga do formulário; identidade de estado entre versões; validação recursiva cliente/servidor; eventos; suporte dos componentes; consistência de data; publicação e exportação. Cada correção deve ter teste de comportamento no ponto em que a configuração atravessa editor, persistência e execução.

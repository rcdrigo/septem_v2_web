# E1 — Contratos e persistência dos formulários nativos

Base implementada e CA01–CA03 verificados em 20/09/2026 nos repositórios `septem_v2_web` e `septem_v2`. Escopo: RF01–RF06 de [requisitos por etapas](formularios-nativos-etapas.md). O editor foi integrado em [E2](formularios-nativos-e2.md); preenchimento e demais integrações continuam em E3–E6. Esta entrega não retira o form-js nem executa a limpeza de E7.

## Contrato

A definição usa `format: "septem-native"` e `schemaVersion: 1`. `schemaVersion` identifica o formato do JSON; a versão publicada continua sendo `flows.Version`. Não há conversão ou leitura de schema legado pelo parser nativo.

```json
{
  "format": "septem-native",
  "schemaVersion": 1,
  "id": "form-1",
  "tabs": [{
    "id": "tab-1",
    "label": "Aba 1",
    "groups": [{
      "id": "group-1",
      "label": "Grupo 1",
      "type": "group",
      "fields": [{
        "id": "field-name",
        "kind": "field",
        "type": "textfield",
        "key": "nome",
        "label": "Nome",
        "config": { "validate": { "required": true } }
      }]
    }]
  }]
}
```

- `id` é permanente, único entre todos os nós da definição, independente de rótulo, posição e chave. Aceita 1–128 caracteres ASCII alfanuméricos, `_` e `-`. A fábrica inicial usa UUIDs.
- `key` é a chave legível de resposta/script: `[A-Za-z_][A-Za-z0-9_]{0,119}`. Todas as chaves de campos, inclusive colunas, e de tabelas compartilham um namespace por formulário. Os limites respeitam as colunas de projeção existentes. `__proto__`, `prototype` e `constructor` são reservados.
- Rótulos têm até 240 caracteres, podem se repetir e não servem como identidade. Arrays guardam a ordem. Não há propriedade paralela de ordenação.
- Toda definição tem ao menos uma aba; toda aba tem ao menos um grupo. Um grupo pode estar sem campos enquanto é montado. Apenas tabelas possuem `key`; Grupo Padrão não cria nível nas respostas.
- `kind: "field"` identifica respostas. Tipos: `textfield`, `textarea`, `number`, `datetime`, `filepicker`, `select`, `radio`, `checkbox`, `checklist`, `taglist`.
- `kind: "presentation"` identifica `text`, `html`, `image`, `separator`, `spacer`. Não possui chave de resposta e só pode pertencer a Grupo Padrão.
- `type: "table"` em um agrupamento representa tabela; seus `fields` são colunas. Linhas não fazem parte da definição. O `label` da coluna é seu cabeçalho.
- `config` guarda configurações JSON de cada nó, preservadas no round-trip. A estrutura rejeita propriedades desconhecidas fora de `config`, evitando aninhamento acidental. A interpretação de validações, fontes e apresentação cabe às etapas dos consumidores.
- A identidade do formulário deve ser mantida ao salvar versões do mesmo processo. E1 bloqueia troca de chave e reutilização de chave por outra identidade; a ação de trocar chave depende da verificação de referências de E5. Renomear rótulo e reposicionar não exigem nova identidade.

Implementações: `src/lib/native-form.ts` no frontend e `src/Septem.Infrastructure/Execution/NativeForm.cs` no backend. `createNativeForm()` gera uma aba e um Grupo Padrão. `nativeFields()` devolve IDs de aba/grupo, a coluna e seu caminho de resposta, distinguindo grupos homônimos.

## Respostas e execução

```json
{
  "nome": "Ana",
  "itens": [
    { "produto": "A", "quantidade": 0, "ativo": false },
    { "produto": "B", "quantidade": 2 }
  ]
}
```

Os campos de Grupo Padrão ficam no topo; tabelas usam sua chave e um array de objetos com as chaves de coluna. O estado transitório (visibilidade, edição, obrigatoriedade, alterações visuais por script) tem contrato separado e não é parte da definição nem das respostas.

A gravação usa a definição persistida da versão da requisição, nunca o schema alterado pelo script. O filtro aceita todas as colunas definidas em novas linhas e descarta campos desconhecidos, elementos de apresentação e tabelas não definidas. Não usa a matriz de visibilidade para rejeitar valores: scripts podem habilitar campos, conforme RF29.

O envio é parcial por chave de topo: campos omitidos preservam o valor anterior; `null` limpa um campo explicitamente. Uma tabela enviada substitui seu array completo; `[]` remove suas respostas. Tabela precisa ser array de objetos, incluindo no rascunho. Zero e falso são preservados. Validação por tipo, obrigatórios e descarte de linhas vazias pertencem a E4; E1 não descarta linhas vazias antes dessa validação.

## Persistência verificada no código

Não é necessário criar outra tabela ou endpoint para E1:

| Operação | Caminho existente | Comportamento nativo |
| --- | --- | --- |
| Transportar definição | `septem:FormSchema` no BPMN; helpers `getEmbeddedNativeForm` / `setEmbeddedNativeForm` | JSON validado, sem tradução para componentes form-js |
| Criar versão | `POST /api/v1/workflow/process-definitions/` | Valida estrutura e identidade antes de persistir |
| Salvar rascunho | `PUT /api/v1/workflow/process-definitions/{key}` | Publicação permanece íntegra; salvar cria homologação. Versão nativa já usada por execução também gera outra versão |
| Publicar | `PATCH /api/v1/workflow/process-definitions/{key}/status` | Promove versão corrente e aposenta anterior; bloqueia tornar publicação nativa editável no lugar |
| Reabrir definição | BPMN da definição / `GET .../{key}/form` | `flow_forms.SchemaJson` preserva o JSON, identificado por hash |
| Iniciar requisição | `POST /api/v1/workflow/instances` | `FlowExecution.FlowId` fixa a versão selecionada |
| Salvar/concluir/editar respostas | Endpoints de tarefa e instância → `FormValueProjector.ApplyAsync` | Filtro central contra a definição vinculada; JSON e projeção escritos na mesma transação do chamador |
| Projetar campos para consulta | `ProcessDefinitionService.ExtractFormFields` | Ignora apresentação; colunas usam `tabela[].coluna` |

`flow_forms` já guarda snapshots por conteúdo e `flows.FormId` aponta a definição de cada versão. O projetor nativo refaz a projeção inteira da requisição após a filtragem, removendo resíduos desconhecidos também da projeção. O fluxo legado continua operacional até E7, em um ramo separado; não é aceito pelo contrato nativo.

Automações não são copiadas para o contrato de publicação do formulário. Nenhuma seleção de revisão de automação por versão foi introduzida.

## Inventário de consumidores e adaptação

Caminhos sem prefixo de repositório abaixo são relativos ao frontend; `backend:` refere-se a `septem_v2/src`.

| Consumidor encontrado | Implementação atual | Situação / adaptação prevista |
| --- | --- | --- |
| Editor e importação | `components/form/FormBuilder.tsx`, `useProcessFormEditor.ts`, `ImportFormDialog.tsx`, `modelador/views/FormularioView.tsx`; backend: `Api/Endpoints/Workflow/FormImportEndpoints.cs` | E2: tela usa `NativeFormEditor`, `useNativeProcessForm`, fábrica, parser e transporte nativos, com importação somente de JSON nativo; movimentação/conversão em E3. E7: wrappers FormBuilder, FormFill, useProcessFormEditor, FormFieldsPalette e editorDatetime retirados; importador de planilha antigo ainda requer avaliação |
| Processo/BPMN | `lib/bpmn-process.ts`, `lib/api/process-definitions.ts`; backend: `Workflow/Parsing/BpmnXmlParser.cs`, `ProcessDefinitionService.cs` | E1: transporte e persistência nativos preparados e servidor validando; integração visual entregue em E2 |
| Prévia e preenchimento | `components/form/FormPreview.tsx`, `FormFill.tsx`, `ReactForm.tsx`, `lib/form-validation.ts` | E4: `ReactForm` e prévia integrados ao formato nativo, com abas/grupos/tabelas e validação coerente; ver registro de E4 |
| Entradas autenticadas/públicas e relatório | `pages/ServicoFormPage.tsx`, `ServicoPublicoPage.tsx`, `TarefasPage.tsx`, `InstanciasPage.tsx`, `components/requests/NewRequestDialog.tsx`, `lib/api/execution.ts`, `lib/api/catalog.ts`; backend: `Api/Endpoints/PublicServicesEndpoints.cs`, `Execution/ExecutionEndpoints.cs` | E4–E7: ligar runtime nativo em todos os pontos; definição vinculada à execução já persistida |
| Respostas e projeção | backend: `Infrastructure/Execution/FormValueProjector.cs`, `FormDataMerger.cs`, `FormValueExtractor.cs`, `WorkflowEngine.cs` | E1: filtro central e caminhos de gravação cobertos; E4: validação nativa e descarte de linhas vazias; E6: prioridade final dos scripts |
| Matriz e seletores | `lib/form-schema.ts`, `lib/use-ensure-form-fields.ts`, `stores/form.ts`, `modelador/views/TarefasCamposView.tsx`, `modelador/fields/FormFieldSelect.tsx` | E5: consumir descritores nativos com IDs de grupo, não agrupar por rótulos |
| Condições e referências BPMN | `lib/bpmn-gateway-conditions.ts`, `bpmn-form-fields.ts`, editores em `components/modelador`; backend: `Workflow/ProcessDefinitionService.cs`, `Execution/WorkflowEngine.cs`, `TaskFormSchema.cs` | E5: resolver referências estáveis, publicar somente referências válidas; troca de chave bloqueada em E1 |
| Fontes por campo/tarefa | `useProcessFormEditor.ts`, componentes de fontes; backend: `Api/Endpoints/DataSources/DataSourcesEndpoints.cs`, `ExecutionEndpoints.ResolveFieldOptionsAsync` e métodos de valores iniciais | E4/E5: descobrir campos em `tabs/groups/fields`, preservar configurações e contexto de linha |
| Documentos e anexos | `lib/upload.ts`, `ReactForm.tsx`; backend: `Infrastructure/Documents/FormFieldCatalog.cs`, `TemplateData.cs`, `DocumentGenerationService.cs`, endpoints de documentos, storage e assinaturas | E4/E5/E7: catálogo e substituição de valores de tabelas, associação por campo/ocorrência e versão |
| Consultas e relatórios | backend: `Infrastructure/Reports/ProcessRowsReader.cs`, `Workflow/FormFieldPathReconciler.cs`, `FlowFormField` e `FlowExecutionFormValue` | E1: projeção de campos e respostas nativas; E5/E7: seletores, reconciliação e referências declarativas |
| Automações | `lib/form-automation/runtime.ts`, `pages/FormAutomationPage.tsx`; backend: `Api/Endpoints/Forms/FormAutomationEndpoints.cs`, `FormAutomationChat.cs`, `FormScriptsEndpoints.cs` | E6: API de script, prévia e testes para hierarquia nativa; publicação independente preservada |
| Catálogo legado de formulários | `lib/api/forms.ts`; backend: `Api/Endpoints/Forms/FormsEndpoints.cs` e tabelas `forms` | API distinta de `flow_forms`; inventariar usos e retirar somente o que ficar exclusivo do legado em E7 |
| Exemplos, estilos e regressões | `src/assets/empty-form.json`, estilos/imports form-js, `tools/uitest/form*.mjs`, testes backend | E7: dependências, estilos e empty-form.json retirados; regressão de editor substituída pelos testes nativos. Fixtures legadas de outros testes ainda precisam de revisão |

## Dependências da limpeza de E7

Inventário baseado nos mapeamentos `WorkflowModel`, `ExecutionModel`, `TagsModel`, `DocumentsModel` e nos endpoints de execução. Não é um script de exclusão; o ambiente alvo e as contagens ainda precisam ser determinados na implantação.

| Dados | Dependência / tratamento na limpeza |
| --- | --- |
| `flow_executions`, inclusive `DeletedAt` e simulações | Remover as requisições do escopo. O DELETE atual é lógico e não realiza essa limpeza física |
| `flow_execution_form_values`, tarefas, ações, histórico de campos | Dependem de execução/tarefa; mapear cascatas e conferir ausência de órfãos |
| `flow_task_alert_dispatch` | Vinculado a tarefas; incluir registros de alertas no lote |
| Mensagens, menções e entregas | Execução → mensagem → dependências; mensagens têm autorreferências `Restrict`, exigindo ordem explícita |
| Tags de execução, estados e eventos | Cascata por execução. Catálogo `process_tags` e eventos de catálogo pertencem ao processo, não são automaticamente descartados |
| `document_signatures`, `document_codes` | Assinaturas têm cascata de execução; códigos guardam `ExecutionId` e exigem remoção explícita/conferência |
| Arquivos de upload/gerados | Respostas e códigos contêm referências a storage. Levantar chaves físicas antes de apagar respostas e remover apenas objetos abrangidos |
| `document_executions.PayloadJson` | Histórico de geração pode conter respostas sem FK para requisição; inspecionar vínculo e política do lote. Modelos de documento não são automaticamente descartados |
| `flows.FormId`, `flow_forms`, `flow_form_fields`, BPMN `septem:FormSchema` | Desvincular/substituir definições legadas e suas projeções; `flows.FormId` usa `Restrict`. Hashes compartilhados exigem conferir todas as referências antes de apagar |
| `flow_task_form_fields`, condições, campos de ator/prazo/assinatura, fontes e modelos | Referências declarativas a chaves removidas precisam ser corrigidas junto ao reinício; não bastará limpar respostas |
| Catálogo `forms`, grupos/campos, scripts/revisões/testes | Separado de `flow_forms`; identificar quais pertencem ao escopo legado. Publicação de automação exige adaptação E6, não descarte indiscriminado |
| Auditoria, relatórios e integrações | Levantar referências e políticas de retenção, revalidar modelos/consultas contra as novas definições |

Usuários, credenciais, unidades, perfis, categorias, fontes, conexões e outros cadastros não entram automaticamente no lote. Nenhum banco de ambiente foi limpo nesta etapa. Os testes de integração usam bancos temporários isolados.

## Verificação

- `npm run test:native-forms`: contrato, fábrica inicial, round-trip, movimentação/renomeação preservando IDs/chaves/configurações, rejeição de estruturas ambíguas e filtro de respostas.
- Backend `NativeFormContractTests`: contrato e filtragem em C#.
- Backend `NativeFormsTests`: API real e PostgreSQL, cobrindo CA01–CA03, projeção, caminhos iniciar/salvar/concluir/editar, payload inválido, autenticação e bloqueio de alteração de chave sem verificação.
- `npm run typecheck`, `npm run build`, regressões existentes de formulário e automação.

Resultados em 20/09/2026:

| Verificação | Resultado |
| --- | --- |
| Contratos TypeScript, typecheck e build | Passaram |
| Backend: `NativeFormContractTests`, `NativeFormsTests`, `FormValueProjectionTests`, `FormValueProjectorTests`, `WorkflowEndpointsTests` | 56 testes passaram, incluindo 13 nativos; PostgreSQL 14 temporário na porta 55439, bancos de teste isolados |
| `form-regressions.mjs` | 68 verificações passaram |
| `form-editor-regressions.mjs` e `modelador-startup.mjs` | Passaram |
| `data-source-sql.mjs` e `npm run test:automation` | Passaram |
| `form-publication.mjs` / sequência `npm run test:forms` | Timeout esperando `Anterior`, linha 44. Reproduzido também numa cópia limpa de HEAD anterior a E1; esta regressão permanece pendente |

O SDK usado foi `~/.dotnet/dotnet` 10.0.300, conforme `global.json`. Foi necessário restaurar os pacotes já declarados para resolver `Esprima`; nenhuma versão de dependência foi alterada. O build mantém avisos preexistentes de dependências/análise e tamanho de bundle. Os testes HTTP cobrem autenticação (401), mas não comprovam autorização de um usuário autenticado sobre tarefa alheia; essa verificação continua explicitamente necessária em E6/RF29.

A verificação de obrigatórios/tipos no preenchimento nativo, linhas vazias, referências de publicação e comportamento de scripts permanece nas etapas E4–E6. O runtime legado ainda não renderiza a nova definição; não publicar formulários nativos no ambiente operacional antes de concluir a integração.

## Atualização E7 — 20/09/2026

A regressão de publicação e a sequência completa `test:forms` passaram após atualização do harness nativo. A autorização de usuário autenticado sobre tarefa alheia foi implementada e testada (403). Fontes nativas, catálogo de documentos e contexto de tabelas foram adaptados; referências externas e documentos por linha ainda precisam da revisão registrada em [E7](formularios-nativos-e7.md). O procedimento de limpeza agora é executável e manual, conforme [guia](formularios-nativos-limpeza.md); não foi aplicado em ambiente operacional.

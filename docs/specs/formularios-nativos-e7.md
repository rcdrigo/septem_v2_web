# E7 — Integração, limpeza e retirada do legado

Status em 20/09/2026: dependências form-js removidas, integrações adicionais implementadas e procedimento manual de limpeza entregue. A substituição completa ainda exige as verificações finais listadas abaixo; CA25 não está declarado concluído.

## Entregue

- Removidas dependências `@bpmn-io/form-js` e viewer, CSS, tipos, exemplos e wrappers sem consumidores, incluindo os diálogos antigos de importação e scripts. O painel BPMN continua usando `@bpmn-io/properties-panel`.
- Editor nativo mostra usos conhecidos, permite alterar chaves preservando IDs e aponta referências inválidas. O servidor permite salvar o rascunho e bloqueia sua publicação até corrigir referências BPMN conhecidas, inclusive cardinalidade e tipos.
- Automações têm acesso pelo modelador, análise de chamadas literais e seleção de versões estruturais na prévia. O endpoint retorna versões atuais/publicadas e versões usadas por requisições.
- Escrita de tarefas verifica responsável e execução em andamento antes de resolver fontes ou gravar. Os testes HTTP incluem usuário autenticado tentando gravar tarefa alheia (403).
- Estado final de campos/células produzido por scripts é enviado separado das respostas. O backend usa a definição vinculada à requisição, filtra campos temporários e aplica o estado transitório quando existe automação configurada; esse estado não altera a definição nem substitui autorização.
- Fontes nativas preservam valores já preenchidos e tratam colunas de tabelas. Catálogo de documentos, campos de arquivo e contexto de placeholders reconhecem definições nativas e respostas de tabelas.
- Corrigido o harness de publicação: aguarda o carregamento, usa fixture nativa, CSS atual e nomes acessíveis dos botões. A regressão de desktop/mobile passou.

## Limpeza manual — decisão do usuário

O usuário optou por escolher o alvo e executar a limpeza manualmente. **Nenhum ambiente operacional foi limpo.** Use o [guia de limpeza](formularios-nativos-limpeza.md) e `tools/maintenance/reset-native-forms.py`.

O procedimento inventaria dependências e respostas, verifica o alvo, exige confirmação interativa, gera backup e executa SQL transacional. Exclui requisições/dependências e catálogo antigo; substitui definições legadas vinculadas por formulários nativos vazios em rascunho. Preserva cadastros fora do escopo. Histórico de geração requer opção explícita. Storage e auditoria geral têm tratamento separado descrito no guia.

`tools/uitest/native-reset.py` verificou, em PostgreSQL descartável, limpeza, preservação dos cadastros protegidos, rejeição de plano desatualizado antes das exclusões e XML com aspas, barras e delimitadores SQL. Isso não equivale à execução de CA23 no ambiente do operador.

## Verificação

- `npm ci --offline --ignore-scripts --no-audit --no-fund` em diretório limpo: 181 pacotes instalados. Árvore npm sem form-js/viewer.
- `npm run test:forms`: passou, incluindo build, contratos, runtime, matriz, editor, estrutura, inicialização, publicação e fontes SQL.
- `npm run test:automation`: passou.
- Backend: 69 testes passaram em `NativeForm*`, `FormFieldCatalogTests`, `FormAutomationTests`, `StartFormFieldSourceTests`, `FormValueProjectorTests` e `FormValueProjectionTests`, com HTTP e PostgreSQL isolado nos testes de integração.
- Interface mobile inspecionada nas capturas do editor. Testes de navegador usam APIs simuladas; testes HTTP são independentes deles.

## Limites ainda abertos

- Concluir inventário e validação de referências externas ao BPMN, especialmente fontes, consultas/relatórios e modelos compartilhados.
- Verificar geração/assinatura de documentos por ocorrência de linha de tabela; reconhecer campos no catálogo não demonstra esse fluxo completo.
- Retirar caminhos remanescentes de aceitação/leitura de schemas antigos no frontend/backend, distinguindo-os do modelo intermediário usado pelo runtime nativo.
- Demonstrar a jornada CA22 com navegador e API real após o reinício escolhido pelo operador. As suítes isoladas não são apresentadas como essa jornada.

Esses limites impedem declarar E7 e todos os critérios CA01–CA25 concluídos.

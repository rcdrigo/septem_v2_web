# Customização JavaScript dos formulários

Acesso: botão **JavaScript** na visão **Formulário** do modelador, ao lado de Máscaras e Importar. Abre uma nova aba exclusiva do formulário salvo, sem lista geral. Os escopos exibem Código comum primeiro e as tarefas em ordem alfabética. A permissão `forms:javascript` permite editar, conversar com o agente, salvar, publicar e restaurar; o administrador (`*`) tem acesso.

## Fluxo

1. Escolha o formulário do processo e o escopo: código comum ou um elemento BPMN do tipo task.
2. Edite manualmente ou descreva a alteração no chat.
3. Revise as diferenças e edite a proposta. **Aplicar ao editor** ainda não salva.
4. Teste a prévia. **Simular envio** executa as validações, sem enviar os dados do formulário. As chamadas AJAX escritas no código executam normalmente.
5. Salve um rascunho e depois publique o conjunto. Uma publicação inclui o código comum e todos os scripts específicos, armazenados em linhas separadas.
6. No histórico, compare versões e consulte as conversas. Restaurar carrega a versão para revisão; salvar cria uma nova versão, sem apagar o histórico.

A chave do processo identifica o formulário entre versões do BPMN. A customização tem versionamento independente do BPMN e não modifica o schema persistido. Uma publicação passa a valer quando o formulário é aberto novamente; sessões já abertas continuam com o código que receberam.

Conflitos retornam HTTP 409: o editor preserva a edição e mostra a versão do servidor para comparação. Não há sobrescrita automática.

## Ativação do back-end

As mudanças correspondentes estão no repositório irmão `septem_v2`. A migração `AddFormAutomation` cria as tabelas de workspaces, revisões, scripts por escopo e conversas e registra a permissão. Aplique-a pelo fluxo normal de migrações do projeto antes de disponibilizar o front-end.

O chat usa o endpoint OpenRouter `https://openrouter.ai/api/v1/chat/completions` no servidor. Configure em **Parâmetros do sistema → OpenRouter** (permissão `admin:settings`): chave da API, identificador do modelo, URL do site opcional e limite de tokens (padrão 16000).

A chave é cifrada com Data Protection por tenant e nunca é devolvida pela API. Deixar o campo vazio mantém a chave; marcar “Remover a chave salva” e salvar desativa o agente. Alterações entram em vigor na próxima solicitação, sem reiniciar a API. Aplique a migration `AddOpenRouterSettings` antes de usar a aba.

Para compatibilidade, as variáveis `OpenRouter__ApiKey`, `OpenRouter__Model`, `OpenRouter__SiteUrl` e `OpenRouter__MaxTokens` ainda são usadas enquanto o tenant nunca salvou essa seção. Após o primeiro salvamento, prevalece integralmente a configuração da página, inclusive se a chave for removida. Não use variáveis `VITE_` para credenciais. Sem chave ou modelo, edição manual e versionamento continuam disponíveis.

O modelo/provedor precisa suportar `response_format: json_schema`. A integração usa `strict: true` e `provider.require_parameters: true`, conforme as [recomendações de respostas estruturadas](https://openrouter.ai/docs/guides/features/structured-outputs) e a [integração HTTP oficial](https://openrouter.ai/docs/quickstart). Respostas recusadas, truncadas ou inválidas não são aplicadas. O histórico registra o modelo retornado pelo OpenRouter.

O contexto enviado ao agente inclui a estrutura do formulário, tarefas, código atual, catálogo de fontes (ID/nome/tipo, sem credenciais) e a conversa completa. Dados preenchidos por usuários não são enviados pelo editor.

## API disponível no navegador

Cada script é o corpo de uma função `async`, com `await` disponível. Não use `import`/`export`. O código comum executa antes do código da tarefa atual.

```javascript
form.hide('grupo_empresa');
form.on('change', 'tipo', () => {
  if (form.get('tipo') === 'empresa') form.show('grupo_empresa');
  else form.hide('grupo_empresa');
});

form.beforeSubmit(async () => {
  const resultado = await form.dataSource('ID-DA-FONTE', { codigo: String(form.get('codigo')) });
  form.set('resultado', resultado.rows);
});
```

- Valores: `form.get(key)`, `form.set(key, value)`, `form.getData()`.
- Estrutura: `form.getSchema()`, `form.setSchema(schema)`, `form.update(idOuKey, patch)`, `form.add(component, parentId?)`, `form.remove(idOuKey)`.
- Comportamento: `form.show/hide(idOuKey)`, `form.setRequired(idOuKey, boolean)`, `form.setDisabled(idOuKey, boolean)`, `form.setOptions(key, options)`.
- Eventos: `form.on('change' | 'click' | 'blur' | 'focus', keyOuNull, callback)`. Recebe `{ key, value, event }`; retorna uma função para remover o handler. Chaves de eventos em listas incluem o caminho da linha.
- Envio: `form.beforeSubmit(callback)` suporta `async`; retornar `false` impede aquele envio e permite corrigir os dados e tentar novamente. Uma exceção não tratada bloqueia a sessão do formulário.
- DOM: `form.root`, `form.query(selector)`, `$` e `jQuery`. Wrappers dos campos têm `data-form-id` e `data-form-key`. Use `$(form.root).find(...)` para limitar seletores.
- Integrações: `fetch`, `$.ajax`, `form.dataSource(id, parameters)`; esta última usa a API autenticada existente e retorna `{ options, rows }`.
- Ciclo de vida: `form.onCleanup(callback)`; timers recebidos pelo script e requisições monitoradas são encerrados no unmount. `form.fail(message)` bloqueia explicitamente o envio.

Use a API `form` para mudanças controladas pelo React; alterações diretas com jQuery no DOM podem ser substituídas por um novo render. Para manipular valores de listas, leia e atualize o array pela chave da lista.

## Validação e acesso

A análise do editor detecta sintaxe inválida e referências indefinidas; também avisa sobre `debugger` e laços sem condição de saída. O servidor revalida sintaxe e vínculo de tarefas ao salvar/publicar. A análise não prova que o programa funciona para todos os dados. Código síncrono com loop infinito ainda pode travar a página; a prévia deve ser usada antes de publicar.

Falhas não tratadas em inicialização, eventos, timers, `fetch` e AJAX bloqueiam o envio, inclusive para botões que dispensam validação dos campos. Requisições pendentes são aguardadas, com limite de 15 segundos no envio. Erros tratados por `catch`/`fail`/`error` seguem a regra definida pelo script.

A API de execução entrega apenas o código comum e o script da tarefa autorizada, filtrados no servidor. A central pública recebe apenas o código comum. Histórico e conversas exigem a permissão de customização e nunca são incluídos nas respostas de execução. Scripts entregues ao navegador podem ser inspecionados; não devem conter segredos. Credenciais e regras de autorização das APIs permanecem no servidor. A customização no navegador não substitui validações autoritativas do back-end.

## Verificação

- `npm run build`
- `npm run test:automation`
- `node tools/uitest/form-regressions.mjs`
- No back-end: `dotnet test tests/Septem.Integration.Tests --filter FullyQualifiedName~FormAutomationTests`

Os testes do agente usam um transporte OpenRouter simulado para verificar o contrato, histórico e troca de modelo, sem enviar código a um provedor real.

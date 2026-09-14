# Automação de formulários com JavaScript

## Objetivo deste manual

Este manual orienta usuários técnicos a criar, testar, versionar e publicar JavaScript que altera o comportamento dos formulários. O editor exige a permissão `forms:javascript` e abre em uma aba própria.

O código comum também é entregue aos usuários externos. Trate cada script como código de produção: limite o acesso, não inclua segredos e teste cenários reais antes de publicar.

## Quando usar automação

Use JavaScript quando as configurações normais do modelador não forem suficientes, por exemplo:

- mostrar ou ocultar grupos conforme uma escolha;
- tornar um campo obrigatório em uma condição;
- preencher um valor calculado;
- atualizar opções por uma fonte de dados;
- impedir o envio até uma regra adicional ser satisfeita;
- integrar uma consulta necessária à experiência do formulário.

Prefira recursos nativos para obrigatoriedade, máscaras, fontes e visibilidade simples. Scripts aumentam a responsabilidade de manutenção.

## Conhecendo o editor de automação

O cabeçalho informa a chave do processo, a versão do rascunho e a versão publicada. As ações principais são:

- **Testar prévia**: abre o formulário com o código selecionado, sem enviar dados;
- **Salvar rascunho**: cria uma nova versão editável;
- **Publicar conjunto**: ativa a versão salva;
- **Fechar**: fecha o editor, pedindo confirmação quando há alterações.

Salvar e publicar são etapas separadas. A publicação fica indisponível quando existem erros, alterações não salvas, conflito remoto ou nenhuma versão nova.

## Escopo do código

Escolha **Código comum** para comportamento necessário em todas as tarefas. Escolha uma tarefa específica quando a regra só deve existir naquela etapa.

O seletor também mostra scripts de tarefas removidas para permitir limpeza. Use **Remover código desta tarefa do rascunho** quando a automação não for mais necessária.

Evite duplicar a mesma regra no escopo comum e em uma tarefa.

## API disponível

O objeto `form` oferece operações como:

- `form.get(id)` e `form.set(id, valor)` para dados;
- `form.show(id)` e `form.hide(id)` para visibilidade;
- `form.setRequired(id, condição)` para obrigatoriedade;
- `form.setDisabled(id, condição)` para edição;
- `form.setOptions(id, opções)` para seletores;
- `form.update`, `add` e `remove` para componentes;
- `form.getSchema()` e `form.setSchema()` para o esquema;
- `form.on(evento, campo, callback)` para eventos;
- `form.beforeSubmit(callback)` para validação anterior ao envio;
- `form.dataSource(id, parâmetros)` para fontes cadastradas;
- `form.onCleanup(callback)` para liberar listeners e recursos.

O DOM do formulário está disponível por `form.root` e `form.query`. jQuery existe em `$` e `jQuery`; limite a busca ao `form.root`. Para atualizar valores controlados pelo React, use `form.set`.

## Exemplo de visibilidade

```javascript
form.on("change", "tipo_pessoa", () => {
  if (form.get("tipo_pessoa") === "juridica") {
    form.show("dados_empresa");
    form.setRequired("cnpj", true);
  } else {
    form.hide("dados_empresa");
    form.setRequired("cnpj", false);
  }
});
```

Use IDs e chaves existentes no formulário. Teste o valor inicial e as mudanças posteriores.

## Exemplo com fonte de dados

```javascript
form.on("change", "cnpj", async () => {
  const cnpj = form.get("cnpj");
  if (!cnpj) return;
  const opcoes = await form.dataSource("fornecedores_por_cnpj", { cnpj });
  form.setOptions("contrato", opcoes);
});
```

Confirme o identificador da fonte, os parâmetros esperados e o comportamento em falha ou retorno vazio.

## Código, diferenças e histórico

A aba **Código** contém o editor. **Diferenças** compara a edição com a versão carregada. **Histórico** lista versão, situação, descrição da alteração, autor e publicador.

Informe uma **Descrição da alteração** objetiva, como `Exibe dados do contrato para fornecedor selecionado`. Ela facilita auditoria e reversão.

Em uma versão histórica, use **Comparar e ver conversa** para revisar diferenças e solicitações ao agente. **Restaurar para revisão** carrega a versão no rascunho; ainda é necessário salvar e publicar.

## Validação e diagnósticos

A análise verifica sintaxe e alguns padrões. Erros impedem salvar ou publicar; avisos exigem revisão. A análise estática não detecta todos os problemas de dados, rede ou execução.

Na prévia:

1. percorra todos os caminhos condicionais;
2. altere campos mais de uma vez;
3. teste valores vazios e inválidos;
4. simule o envio;
5. confira mensagens e campos obrigatórios;
6. repita em largura de celular.

O envio simulado valida o formulário e não cria uma requisição.

## Agente OpenRouter

Escolha uma conversa ou crie outra, selecione o escopo e descreva o comportamento. O agente devolve uma proposta e uma comparação. Revise e edite antes de **Aplicar ao editor**.

Aplicar não publica. A proposta passa a fazer parte do rascunho e deve seguir validação, prévia, salvamento e publicação. As conversas vinculadas ficam registradas com a versão.

## Conflitos de edição

Se outra pessoa salvar uma versão mais recente, o editor preserva seu código e mostra a versão remota. Compare os escopos e escolha carregar o servidor ou manter sua edição sobre a nova base. Revise novamente antes de salvar.

Não contorne o conflito copiando e publicando sem comparação: isso pode reintroduzir código removido por outro administrador.

## Segurança

- não grave senhas, tokens ou dados pessoais fixos no script;
- trate respostas de API como não confiáveis;
- limite integrações aos domínios autorizados;
- evite HTML construído com valores sem tratamento;
- registre limpezas para timers e listeners;
- considere que o código comum roda também para externos;
- mantenha uma forma segura de continuar o formulário quando uma integração falhar.

## Checklist de publicação

- permissão técnica confirmada;
- escopo comum ou tarefa escolhido corretamente;
- IDs e fontes conferidos;
- nenhum erro de validação;
- diferenças revisadas;
- prévia testada com múltiplos cenários;
- simulação completa do processo concluída;
- descrição da alteração preenchida;
- rascunho salvo antes de publicar;
- versão publicada confirmada.

# Integração de tags

Implementação coordenada com o backend irmão `septem_v2`. Os requisitos de produto estão em [requisitos-tags.md](requisitos-tags.md).

## Leitura e gravação

`GET /api/v1/workflow/instances/{executionId}/tags` retorna o catálogo do processo, as associações da execução e as revisões de ambos:

```ts
type Actor = { id: string; name: string };
type Tag = { id: string; name: string; color: string };
type ExecutionTag = Tag & { addedBy: Actor; addedAt: string };
type Snapshot = {
  executionRevision: number;
  catalogRevision: number;
  flowKey: string;
  catalog: Tag[];
  tags: ExecutionTag[];
};
```

`PUT` na mesma rota recebe um único lote confirmado no modal:

```ts
type SaveTags = {
  executionRevision: number;
  catalogRevision: number;
  selectedTagIds: string[];
  createNames: string[]; // compatibilidade: criação com a cor padrão
  createTags: { name: string; color: string }[];
  colorUpdates: { id: string; color: string }[];
  renames: { id: string; name: string }[];
  deleteTagIds: string[];
};
```

O servidor valida o lote, aplica as associações e alterações de catálogo, registra a auditoria na mesma transação e devolve o novo snapshot. As revisões impedem sobrescrever uma edição concorrente. Um conflito retorna HTTP 409 e exige recarregar os dados e revisar a edição; HTTP 422 indica dados inválidos. Autoria, operador de personificação e timestamps são determinados pelo servidor.

## Histórico

- `GET /api/v1/workflow/instances/{executionId}/tags/history`: eventos que afetaram a execução acessível ao usuário.
- `GET /api/v1/workflow/flows/{flowKey}/tags/history`: somente criação, renomeação, alteração de cor e exclusão de tags do catálogo, sob a permissão de acesso à configuração do processo.

As ações do catálogo são `created`, `renamed`, `recolored` e `deleted`; as da execução são `added`, `removed`, `renamed`, `recolored` e `deleted`. Ambos retornam `{ items }` em ordem decrescente de data, com eventos contendo `id`, `action`, `tagId`, `tagName`, `previousName`, `previousColor`, `color`, `occurredAt`, `actor` e, quando aplicável, `operator`. A exclusão da tag preserva os eventos e seus nomes e cores históricos.

Cores usam hexadecimal `#RRGGBB`, com padrão `#0ea5e9`. A alteração de cor afeta todas as execuções associadas à tag e integra o mesmo lote atômico, controle de revisões e histórico da renomeação. O frontend usa a cor padrão ao ler respostas antigas sem esse campo. Reutilizar um nome existente preserva a cor atual do catálogo.

## Listagens e filtros

As listas e detalhes de tarefas e execuções incluem `tags` para exibir as associações sem uma consulta adicional por card. Tags são restritas a usuários internos em modo interno, indicado pelo header `X-Access-Mode: interno`; o backend também verifica a identidade e o acesso à execução.

O filtro da lista de tarefas usa parâmetros repetidos, por exemplo `tagNames=Urgente&tagNames=Financeiro`. Os nomes são comparados sem distinção de maiúsculas/minúsculas e com espaços nas extremidades removidos, exigindo todas as tags na mesma execução. O filtro pode atravessar processos, sem compartilhar a identidade das tags entre eles.

O resultado acrescenta `tagNames: { name, count, available }[]`. Novas opções devem ser compatíveis com todas as tags selecionadas e demais filtros. A faceta `processes` considera as tags, texto e datas, ignorando apenas a seleção do próprio processo para permitir sua troca. Seleções antigas inválidas permanecem visíveis e removíveis; não são apagadas automaticamente.

## Validação do frontend

`npm run test:tags` compila o frontend e executa os componentes reais em Chrome headless com respostas HTTP simuladas. Requer Chrome local (ou `CHROME_BIN`). Não acessa dados de um ambiente.

Os cenários cobrem o lote independente do formulário, cancelamento, criação e edição de cores, validação hexadecimal, contraste das pills, histórico de cores, reutilização de nomes, remoção de tags novas, confirmação da exclusão global, conflito HTTP 409, histórico e personificação, parâmetros repetidos, preservação de filtros inválidos, restrição ao modo interno e interação móvel pelo rodapé da tarefa. As capturas desktop/mobile e os resultados ficam no diretório temporário informado ao terminar. Persistência e autorização do servidor precisam dos testes de integração do backend.

## Validação do backend e migração

O backend inclui a migração `20260914114451_AddProcessTags`, com catálogo, associações, revisões e históricos separados. A migração `20260914134015_AddProcessTagColors` acrescenta a cor ao catálogo e aos eventos, além da cor anterior nos históricos. Tags existentes recebem `#0ea5e9`. As migrações são validadas em PostgreSQL temporário isolado; não foram aplicadas aos ambientes existentes.

O build da API passou, assim como os sete cenários de `TagsEndpointsTests`, incluindo persistência, auditoria, validação e conflito de cores. Na validação anterior à adição de cores, o filtro combinado `FullyQualifiedName~TagsEndpointsTests|FullyQualifiedName~ExecutionEndpointsTests` passou em 20 de 21 testes. A falha de criação/listagem por usuário externo também foi reproduzida em uma cópia limpa do código original, sem tags.

Para reproduzir, use o SDK indicado pelo `global.json` do backend e o harness documentado em `tests/Septem.Integration.Tests/README.md`. Ele aceita Docker ou um PostgreSQL de testes informado em `SEPTEM_TEST_POSTGRES`; cria bancos com nomes exclusivos. Use somente banco de testes para essa execução.

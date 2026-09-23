# E2 — Editor estrutural e catálogo

Implementação em 20/09/2026, cobrindo RF07–RF11 e CA04–CA06 de [requisitos por etapas](formularios-nativos-etapas.md). A tela Formulário do modelador edita definições nativas e usa o transporte e a persistência da E1. Esta é uma entrega de rascunhos; o preenchimento, a publicação integrada, as automações e a retirada completa do legado continuam nas etapas seguintes.

## Comportamento entregue

- Processo sem definição recebe uma aba e um Grupo Padrão. A estrutura inicial é incluída no próximo salvamento, mesmo sem adicionar campos.
- Nova aba já inclui um grupo. Novo agrupamento permite escolher Padrão ou Tabela. Nomes, descrições e visibilidade são editáveis no painel lateral.
- O agrupamento selecionado tem contorno destacado. Adicionar campo abre o catálogo com o caminho Aba / Agrupamento e insere diretamente nesse destino. Não há arraste para criar campos.
- O catálogo contém Texto, Área de texto, Número, Data/Hora, Upload, Lista, Opções, checkbox, múltipla escolha e tags. Texto estático, HTML, imagem, separador e espaçador aparecem apenas em Grupos Padrão.
- Excluir a última aba ou o último agrupamento da aba fica bloqueado e mostra o motivo. Excluir campos e estruturas adicionais é permitido no rascunho.
- A troca de tipo preserva identidade, chave, nome e configurações compatíveis, removendo configurações incompatíveis sem confirmação. Campos de resposta e elementos de apresentação têm seletores separados, evitando descartar/criar identidades de resposta em uma troca de tipo.
- Configurações reutilizam os controles existentes de máscaras, fontes, obrigatoriedade, limites, aparência, ajuda, upload/documentos e eventos. Listas têm edição de rótulos e valores das opções. A referência de fonte é persistida; a busca de opções durante o preenchimento pertence a E4.
- Nomes não regeneram chaves. A chave permanece somente leitura até a verificação de referências de E5.
- Importação aceita apenas JSON no formato nativo validado. Uma importação inválida mantém o rascunho. A exportação gera uma definição JSON independente. Importar novamente reinicializa a seleção e os drafts do painel, inclusive se os IDs forem iguais.
- Controles funcionam por teclado. Em telas estreitas, as propriedades ficam abaixo da estrutura, no scroll interno; selecionar um campo leva o foco ao nome para edição.

## Persistência e fronteiras

`useNativeProcessForm` mantém o rascunho síncrono em uma ref, registra `flushForm` no modelador e usa `setEmbeddedNativeForm`. Salvar logo após editar inclui a alteração atual; o polling de 600 ms mantém o BPMN e seu estado de alterações sincronizados. Carregamento de outro XML suspende o rascunho anterior, e callbacks de uma montagem antiga não podem salvá-lo.

O JSON persistido segue `tabs → groups → fields`, com configurações em `config`; não há tradução da definição para componentes form-js. `nativePanelField` adapta somente as propriedades para os widgets compartilhados, sem instanciar a engine antiga. As configurações produzidas pelos widgets mantêm seus nomes em `config` (`validate`, `properties`, `appearance`, `layout`, `values`, conteúdo de apresentação). Descrição e visibilidade usam `config.description` e `config.visible`.

Definições antigas e XML com JSON inválido mostram erro e bloqueiam o salvamento pela tela, sem substituição silenciosa. Não há conversão de schema antigo, migração de respostas ou limpeza de dados. Nenhum endpoint ou contrato de banco precisou mudar nesta etapa.

## Limites das próximas etapas

- **E3:** assistente de quantidade de colunas, reordenação, movimentação entre grupos/abas/tabelas e conversão Padrão ↔ Tabela. A criação estrutural de Tabela e a adição de campos de resposta já existem; linhas são exclusivas do preenchimento.
- **E4:** prévia e runtime nativos, aplicação das configurações e validações, contadores e persistência de linhas vazias. A tela E2 não apresenta uma prévia legada como se interpretasse a nova definição.
- **E5:** matriz, demais seletores, referências declarativas e fluxo de publicação. O catálogo local da configuração de documentos já recebe descritores nativos; isso não constitui adaptação completa dos consumidores.
- **E6:** execução e integração das automações. Configurações de eventos podem ser editadas, mas sua execução nativa não é comprovada nesta etapa.
- **E7:** limpar o ambiente e retirar dependências, componentes e testes exclusivos de form-js. O editor antigo não é montado pela tela Formulário; seus arquivos e as dependências ainda existem.

Não publicar estes rascunhos para uso operacional antes de concluir o runtime e as integrações. O backend conserva a capacidade de persistência/versionamento comprovada em E1; E2 não comprova um fluxo completo de requisição nativa.

## Verificação

| Verificação | Resultado e alcance |
| --- | --- |
| `npm run typecheck` e `npm run build` | Passaram. Build mantém aviso de tamanho de bundle |
| `npm run test:native-forms` | Contratos E1 e operações E2 passaram: fábrica, identidade, round-trip, filtragem, catálogo completo e matriz de trocas de tipo |
| `node tools/uitest/native-form-editor.mjs` | Passou: CA04–CA06, edição, exclusões/mínimos, destino de tabela, teclado, importação inválida/válida, recarga, flush antigo, mobile e proteção do legado. React real; modeler e APIs simulados |
| `node tools/uitest/modelador-startup.mjs` | Passou nos quatro cenários novo/existente × normal/StrictMode, com bpmn-js real e API simulada. Verifica o JSON nativo no XML enviado ao salvar |
| `node tools/uitest/form-regressions.mjs` | 68 verificações passaram no runtime existente, em desktop/mobile |

Capturas de revisão: `.impeccable/review/native-editor-desktop.png`, `native-editor-mobile.png` e `native-editor-mobile-properties.png`. O cenário capturado é uma fixture de teste, sem dados de produção. O runtime local da skill Impeccable não está instalado; contexto e detector automáticos ficaram indisponíveis. A avaliação usa código, capturas e testes descritos acima. A revisão independente retornou **ship**, limitada à E2, sem achados materiais e sem afirmar aprovação do detector ou do runtime nativo.

`npm run test:native-editor` executa build e interface E2. `test:forms` passou a chamar a suíte nativa no lugar de `form-editor-regressions.mjs`, cujo contrato de editor form-js ficou obsoleto. O teste antigo permanece no repositório até E7. A falha de `form-publication.mjs` registrada em E1 não é resolvida por esta etapa; não afirmar que a sequência completa de `test:forms` passou.

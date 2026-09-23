# E3 — Tabelas, conversão e movimentação

Implementação em 20/09/2026, cobrindo RF12–RF15 e CA07–CA09 dos [requisitos por etapas](formularios-nativos-etapas.md). A entrega amplia o editor de rascunhos da E2, usando o mesmo formato nativo e a persistência da E1. Preenchimento e verificação de referências continuam em E4 e E5.

## Comportamento entregue

- Criar Tabela solicita quantidade de colunas e tipo de cada coluna no catálogo de respostas. A criação aceita de 1 a 100 colunas por operação; outras podem ser adicionadas depois. Cancelar não cria estrutura parcial. O nome do campo é seu cabeçalho, sem atributo adicional; o editor não cria linhas de resposta.
- Colunas podem ser adicionadas, excluídas, renomeadas, reordenadas pela alça e ter seus tipos alterados. A troca de tipo reutiliza as regras de compatibilidade da E2, preservando identidade, chave e rótulo.
- Arrastar pela alça reordena campos/colunas dentro de um agrupamento. Entre Grupos Padrão, também permite mover campos e apresentação. Durante o arraste, passar sobre outra aba abre seus agrupamentos; soltar sobre um campo insere antes dele, e soltar no agrupamento insere ao final. O destino recebe destaque visual.
- Arraste entre tabelas ou entre Padrão e Tabela é bloqueado. **Transferir campo** oferece destinos pelo caminho Aba / Agrupamento e explica a cardinalidade após a escolha. Entre tabelas, esclarece que não há correspondência entre as linhas das duas tabelas. Apresentação só pode ter destino Padrão.
- **Mover antes**, **Mover depois** e **Transferir campo** permitem operar por teclado e em dispositivos sem arraste. A seleção acompanha o destino.
- **Converter para Tabela/Padrão** explica a mudança no rascunho. Quando houver apresentação, exige outro Grupo Padrão, podendo criar o destino na mesma operação. Conteúdo e configurações de apresentação são preservados; campos mantêm identidade e chave. Cancelar não altera o rascunho.
- A conversão conserva a identidade do agrupamento. Ao converter Padrão em Tabela, gera uma chave de tabela válida e única; essa chave estrutural não representa identidade de campo. Reconverter uma tabela importada pode gerar outra chave de tabela, enquanto as identidades e chaves dos campos permanecem iguais.

## Persistência e fronteiras

As operações usam a transação de `useNativeProcessForm`, que clona a definição antes de aplicar a mudança. Movimentos verificam origem, destino, posição e cardinalidade antes de remover o campo. A conversão valida o destino antes de realocar apresentação. Não há alteração em respostas, definição publicada ou backend nesta etapa.

Salvar/reabrir continua usando o JSON nativo embutido no BPMN. Os testes E3 verificam o flush e a recarga com modeler simulado; a suíte de inicialização verifica o XML enviado ao salvar com bpmn-js real. O isolamento de versões e a persistência no backend são os contratos da E1; esta etapa não executa uma nova publicação operacional ou migração de requisições.

A apresentação de usos conhecidos, adaptação de referências e bloqueio de publicação por referências inválidas pertencem a E5. A chave dos campos continua somente leitura. Alterações estruturais não devem ser apresentadas como prontas para execução até a integração das próximas etapas.

## Verificação

- `npm run typecheck` e `npm run build`: passaram; permanece o aviso de tamanho do bundle.
- `npm run test:native-forms`: contratos E1–E3 passaram, incluindo identidade, bloqueio de transferência implícita, transferência entre tabelas, preservação de apresentação e conversão nos dois sentidos.
- `node tools/uitest/native-form-structure.mjs`: CA07–CA09 passaram com React e arraste real de ponteiro, teclado, criação mobile, cancelamento e round-trip do rascunho. APIs/modeler simulados.
- `node tools/uitest/native-form-editor.mjs`: regressões E2 passaram; criação de tabela adaptada ao novo assistente.
- `node tools/uitest/modelador-startup.mjs`: quatro cenários novo/existente × normal/StrictMode passaram, com bpmn-js real e API simulada.
- `node tools/uitest/form-regressions.mjs`: 68 verificações passaram no runtime existente, desktop/mobile.

A suíte E3 está incluída em `test:native-editor` e `test:forms`. A sequência completa de `test:forms` não foi executada; a limitação de publicação registrada em E1/E2 não é resolvida por E3.

Capturas de interface: `.impeccable/review/native-e3-desktop.png` e `native-e3-mobile.png`, com fixture de teste. O runtime e o detector Impeccable não executaram porque a engine local não está instalada. A revisão visual usa as capturas e o código, sem alegar aprovação do detector.

A revisão independente retornou **ship**, sem achados materiais no escopo E3. A conferência de documentação confirmou a continuidade da paleta, tipografia, controles compartilhados, painel lateral e composição responsiva da E2, sem alterar o sistema visual. A ausência prévia de `DESIGN.md` permanece registrada, sem criação de uma nova direção visual.

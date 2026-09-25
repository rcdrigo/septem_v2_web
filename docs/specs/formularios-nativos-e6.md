# E6 — Automações independentes

Status: **iniciada em 20/09/2026; etapa ainda não concluída**. Primeiro incremento no runtime de automações e sua integração com formulários nativos. A E5 ainda possui pendências de referências e publicação.

## Implementado

- Consulta `form.has(idOuKey)` para scripts adaptáveis às estruturas em execução.
- API `form.cell(tabela, indice, coluna)` para ler/escrever valores e definir visibilidade, obrigatoriedade e edição individualmente. Aceita identidade ou chave da tabela/coluna e rejeita índices inexistentes.
- Estado da célula prevalece sobre a configuração da coluna, inclusive para habilitar uma célula inicialmente bloqueada. O modo de leitura global permanece respeitado.
- Renderização, contadores e validação usam as mesmas regras efetivas. O envio lê o estado atualizado sincronamente pelos scripts, inclusive em `beforeSubmit`.
- Filtragem já existente pela definição original foi coberta com criação de campo temporário, acréscimo de linhas, edição e reabertura dos dados serializados.
- API documentada em `docs/form-automation.md`, incluindo distinção entre modelo visual e definição publicada.

## Verificação

- `npm run typecheck` e `npm run build`: passaram; build mantém aviso de tamanho de bundle.
- `npm run test:native-forms`: contratos passaram.
- `node tools/uitest/form-regressions.mjs`: 68 verificações passaram.
- `npm run test:automation`: regressão passou, incluindo ordem comum/tarefa, falhas, limpeza, edição, rascunho e publicação simulada.
- `npm run test:native-runtime`: passou em 1440px e 390px, com cenários E4 e novos cenários E6.

Os testes usam React real em Chrome headless. Reabertura significa remontagem com os dados serializados pelo frontend, sem persistência HTTP. A publicação no teste de automações usa API simulada. Esses resultados não comprovam autorização no servidor nem concluem CA18–CA21.

## Próximos incrementos

1. Verificar os contratos e a filtragem do backend para permitir salvar campos habilitados por script, mantendo autorização de tarefa/requisição e integridade (CA19).
2. Cobrir publicação independente com servidor real, próxima abertura, retenção dos scripts nas sessões abertas e duas versões estruturais em uso (CA18).
3. Integrar análise de referências detectáveis e testes de versões à prévia/editor, sem prometer garantia de compatibilidade de JavaScript livre (RF27).
4. Verificar persistência HTTP de novas linhas e exclusão de campos/colunas temporários, além das alterações de estado e preservação de respostas (CA20–CA21).
5. Concluir a integração com as referências/publicação pendentes da E5 antes de declarar E6 concluída.

Nenhum backend, publicação, implantação ou limpeza de ambiente foi alterado neste incremento.

## Atualização de integração — 20/09/2026

Foram acrescentados autorização de escrita da tarefa, filtragem real de respostas, persistência HTTP de tabelas e testes com duas versões estruturais e publicação de automação independente. O editor analisa referências literais e permite selecionar versões na prévia; JavaScript calculado continua fora dessa análise.

O frontend envia `formState` separado dos dados na abertura/conclusão. O backend aceita o estado transitório apenas com automação configurada, mantém validação de tipos/constraints e filtra valores pela definição publicada. O estado de células é remapeado quando linhas vazias são descartadas. A fonte inicial não sobrescreve valores explícitos produzidos por scripts. As permissões são verificadas independentemente desse estado.

A suíte de automações no navegador passou; testes HTTP verificam versões, persistência, descarte de temporários e 403 para outro responsável. Backend: 69 testes relevantes passaram no conjunto descrito em [E7](formularios-nativos-e7.md). A jornada única com navegador e API real continua necessária para CA22.

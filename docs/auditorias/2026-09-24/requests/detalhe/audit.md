# Auditoria técnica — /requests/:instanceId

Data: 24/09/2026. Complemento à auditoria da listagem, solicitado explicitamente pelo usuário. Alvo: `SolicitacaoPage`, `InstanceReport` e componentes de formulário, tramitação e mensagens apresentados no detalhe.

## Veredito de integridade

**Reprovado.** A rota independente não monta os hosts necessários às operações que oferece. A exclusão fica esperando uma confirmação que nunca aparece; erros de salvamento não são apresentados. São problemas demonstrados no componente de página real, não hipóteses baseadas no login.

## Resumo

**9/20 — fraco, com falhas relevantes.** Nota restrita ao detalhe e aos cenários examinados. **6 achados: 1 P0, 4 P1, 1 P2.** O P0 bloqueia especificamente a exclusão quando a permissão existe; não significa indisponibilidade da leitura do relatório.

| Dimensão | Nota / 4 | Evidência |
|---|---:|---|
| Acessibilidade | 2 | Datas/prazo com contraste insuficiente; feedback ausente |
| Desempenho | 3 | Consulta compartilhada pelo cache; bundle global ainda pesado, já registrado na listagem |
| Responsividade | 1 | Conteúdo de 472 px em área de 320 px |
| Tematização | 2 | Paleta coerente, mas cores diretas e contraste fraco em informações operacionais |
| Integridade da implementação | 1 | Confirmação não renderizada e falha de mensagens apresentada como vazio |
| **Total** | **9/20** | **Nota do detalhe, sem extrapolação para o produto** |

## Método e cobertura

- Página real `SolicitacaoPage` renderizada na rota `/requests/r1`, com BrowserRouter, QueryClient, store de sessão e CSS do build atual. API interceptada; todos os dados e respostas foram fictícios.
- Requisição em andamento com número, requerente, tarefa atual, datas, um formulário nativo com campo de texto e uma tarefa com histórico de alterações. Nesta configuração nativa, visão geral e tramitação aparecem empilhadas; não se presumiu que existissem abas de relatório.
- Modo interno com `canEdit`/`canDelete`; modo externo simulado com essas permissões falsas. Edição de campo, falha 503 ao salvar, exclusão, falha 503 das mensagens e do relatório.
- Desktop 1280 × 900 e viewport emulado de 320 × 900. Medido `main.clientWidth=320` e `main.scrollWidth=472` no detalhe.
- A tentativa de exclusão não chegou à API; o salvamento foi interceptado e respondeu 503. Nenhuma alteração em dados reais ou envio real de mensagem foi feito.
- Detector em `SolicitacaoPage.tsx` e `ProcessMessages.tsx` retornou `[]`; `InstanciasPage.tsx` também foi verificado na auditoria da listagem. Ausência de alertas não equivale a aprovação funcional.
- Build/TypeScript passou na mesma rodada de auditoria. Dois observadores de `useInstance` compartilham a mesma chave; não foram classificados como chamadas duplicadas apenas pela leitura do código.
- O roteiro foi ajustado ao descobrir que o formulário de uma aba tem apresentação empilhada e para aguardar a remontagem do cenário. A execução final concluiu todos os cenários descritos.
- Não verificados: autorização real do servidor, solicitação real, autenticação, upload/assinatura/impressão, todas as combinações de campos, retorno/encaminhamento/realocação, conversas com histórico real, teclado completo, leitores de tela, gestos touch ou outros navegadores. A auditoria não certifica essas capacidades.

## Achados por severidade

### 1. [P0] Exclusão fica bloqueada por ausência do host de confirmação

**Local:** `src/pages/InstanciasPage.tsx:163`; `src/pages/SolicitacaoPage.tsx:33`; `src/main.tsx` e rota independente em `src/router.tsx`.
**Categoria:** Integridade.

`doDelete()` aguarda `confirm()`, que depende de `ConfirmDialogHost`. A página fica fora do AppShell e não monta esse host, nem há host global no bootstrap. No ensaio, Ações → Excluir processo fechou o menu, abriu **zero diálogos** e gerou **zero chamadas de exclusão**. A promessa permanece sem resposta e o usuário não consegue concluir a operação pela interface.

**Recomendação:** montar o host no contêiner apropriado da rota independente ou em um layout compartilhado, evitando duplicação em rotas que já o possuem. Verificar Cancelar/Confirmar e retorno de foco no contexto desta página.
**Padrão:** bloqueio funcional; não é falha do backend.
**Comando:** `$impeccable harden /requests/:id`.

### 2. [P1] Erros e sucessos de operação são enfileirados, mas não aparecem

**Local:** `src/pages/InstanciasPage.tsx:156`; `src/pages/SolicitacaoPage.tsx:33`; `src/components/execution/ProcessMessages.tsx:81`.
**Categoria:** Integridade / feedback.

A página também não monta Toaster. Ao editar Nome e salvar com resposta 503 simulada, o store continha “Não foi possível salvar as alterações.”, mas a contagem desse texto renderizado era **zero**. O componente usa o mesmo mecanismo para sucesso e validação. Mensagens também usam toast, embora envio de mensagem não tenha sido exercitado neste teste.

**Impacto:** o usuário pode repetir operações ou acreditar que os dados foram salvos sem receber a informação necessária.
**Recomendação:** garantir um host único disponível na rota e considerar erro persistente junto à área editada, preservando os valores. Testar falha, sucesso e validação.
**Padrão:** apresentar feedback visual e acessível; WCAG 4.1.3 orienta a exposição das mensagens quando implementadas.
**Comando:** `$impeccable harden /requests/:id`.

### 3. [P1] Falha das mensagens é apresentada como ausência de mensagens

**Local:** `src/components/execution/ProcessMessages.tsx:94`; `src/lib/api/messages.ts:36`.
**Categoria:** Integridade.

O render trata carregamento e `threads.length===0`, sem um ramo para `messages.isError`. Com metadado do relatório indicando uma mensagem e GET de mensagens respondendo 503, foi exibido **“Nenhuma mensagem enviada.”**. Falha de comunicação é transformada em uma afirmação sobre o histórico da requisição.

**Recomendação:** separar erro, vazio e carregamento; disponibilizar Tentar novamente e preservar mensagens previamente carregadas quando apenas a atualização falhar.
**Padrão:** consistência e recuperação de erros; não atribuído um critério WCAG isolado sem ensaio assistivo.
**Comando:** `$impeccable harden /requests/:id`.

### 4. [P1] Detalhe exige rolagem horizontal em 320 px

**Local:** `src/pages/SolicitacaoPage.tsx:47`; `src/pages/InstanciasPage.tsx:358` e `:369`.
**Categoria:** Responsividade.

A área principal mediu **320 px de largura e 472 px de conteúdo rolável**. Há padding de 24 px no main e mais 24 px no card externo; na tramitação, título/status e o botão “Ver histórico de alterações” ficam na mesma linha, com botão `shrink-0`. Na visão geral, nomes comuns já quebram em várias linhas curtas. O conjunto não se adapta adequadamente à largura disponível, mesmo com dados de comprimento normal.

**Recomendação:** reduzir espaçamento externo por breakpoint, permitir reorganização vertical das ações da tramitação e preservar `min-width:0`/quebra de texto nos grupos. Validar conteúdo, não apenas `document.scrollWidth`, porque o overflow está dentro do main.
**Padrão:** WCAG 1.4.10, reflow para conteúdo que não necessita de layout bidimensional.
**Comando:** `$impeccable adapt /requests/:id`.

### 5. [P1] Datas e prazo da tarefa atual têm contraste abaixo de AA

**Local:** `src/pages/InstanciasPage.tsx:263` e `:265`.
**Categoria:** Acessibilidade / tematização.

Cor computada do texto “Iniciada em”: `oklch(0.704 0.04 256.788)` sobre `rgb(255,255,255)`. A razão é aproximadamente **2,56:1**, inferior aos **4,5:1** exigidos para esse texto pequeno. A mesma classe `text-slate-400` aparece no prazo, informação operacional relevante.

**Recomendação:** usar token de texto secundário com contraste suficiente e verificar os textos auxiliares do resumo e histórico. Preservar o contraste nos estados normais, sem depender de hover.
**Padrão:** WCAG 1.4.3 AA.
**Comando:** `$impeccable harden /requests/:id`.

### 6. [P2] Falha de carregamento sugere falta de permissão e não permite repetir

**Local:** `src/pages/InstanciasPage.tsx:143`.
**Categoria:** Integridade / recuperação.

GET do relatório com 503 exibiu “Você pode não ter permissão para visualizá-la.” e **nenhum botão Tentar novamente**. A mesma mensagem é usada para indisponibilidade e possíveis falhas de acesso. O usuário precisa adivinhar que recarregar a aba pode ajudar, ou buscar suporte para um problema que pode ser transitório.

**Recomendação:** distinguir 403, 404 e falhas transitórias; fornecer repetição para rede/5xx e orientação apropriada para acesso/requisição inexistente. Anunciar o erro de modo acessível.
**Padrão:** recuperação de erros; não há violação WCAG específica atribuída neste achado.
**Comando:** `$impeccable harden /requests/:id`.

## Práticas positivas e padrões

- Número e status aparecem no cabeçalho; nome longo do processo tem quebra explícita.
- As ações de edição/exclusão dependem de flags da resposta. No cenário externo sem flags, Editar e Ações tiveram contagem zero. Isso verifica apresentação, não segurança do backend.
- Formulário preserva leitura versus edição; o controle de salvar fica desabilitado durante a mutação.
- Tramitação apresenta responsáveis, datas e histórico por tarefa. Alterações distinguem valores anterior e novo.
- Cache usa identificador, modo de acesso e contexto de mensagens para o relatório.

O problema compartilhado mais importante é o ciclo de vida das rotas independentes: componentes que funcionam dentro do AppShell continuam dependendo de serviços visuais que essa rota não monta. A correção deve cobrir os hosts e os estados específicos do detalhe, sem assumir que a etapa anterior de hardening do login já o resolveu.

## Evidências e próximos passos

- [Detalhe desktop](desktop.png)
- [Detalhe em 320 px](mobile-320.png)

Ordem recomendada:

1. `$impeccable harden /requests/:id` — confirmação, feedback de edição e estados de falha.
2. `$impeccable adapt /requests/:id` — reflow do resumo e tramitação.
3. `$impeccable polish /requests/:id` — acabamento após os bloqueios.

Executar individualmente, em conjunto ou na ordem escolhida pelo usuário. Repetir `$impeccable audit /requests/:id` após as correções. Nenhum arquivo de interface foi alterado durante esta análise.

# Auditoria técnica de interface — Septem

Data: 18/09/2026. Referência de produto: `PRODUCT.md`, com prioridade para usuários internos, solicitantes externos e autoatendimento.

## Veredito de integridade

**Reprovado no escopo examinado.** Existe uma base visual e funcional coerente com o produto, mas controles que prometem ações sem entregar retorno e estados sem recuperação comprometem o autoatendimento. A reprovação trata da implementação, não de uma proposta de mudança estética.

## Resumo

**9/20 — fraco, com lacunas importantes.** Avaliação técnica amostral, não certificação WCAG nem medição de experiência de usuários reais.

| Dimensão | Nota / 4 | Evidência principal |
|---|---:|---|
| Acessibilidade | 2 | Contraste insuficiente e gestão incompleta de foco |
| Desempenho | 2 | Todas as rotas no pacote inicial de 3,46 MB |
| Responsividade | 2 | Toast com largura fixa excede viewport de 320 px |
| Tematização | 2 | Tokens existentes, mas cor primária configurável não aplicada ao shell |
| Integridade da implementação | 1 | Ações sem retorno e recuperação de falhas incompleta |
| **Total** | **9/20** | **Correções relevantes necessárias** |

**10 achados: 0 P0, 7 P1, 3 P2, 0 P3.** Nenhum bloqueio global P0 foi demonstrado. Priorizar feedback do login, confirmação por teclado, foco dos modais/menu e legibilidade.

## Escopo e método

- Leitura das rotas, bootstrap, login, shell, componentes compartilhados, Central de serviços, partes de Tarefas e parâmetros de identidade, CSS e tokens.
- `npm run build` passou: 4.126 módulos transformados; JS 3.461,04 kB (gzip 1.014,16 kB); CSS 325,00 kB (gzip 66,51 kB). O Vite emitiu alerta de chunk grande.
- Login inspecionado no navegador integrado, em desktop e viewport emulado de 320 × 900. Cliques em Solicitar acesso e Consultar processo não produziram alteração de página ou retorno visível. Central de serviços exibiu falha de carregamento sem ação de repetição.
- Contraste calculado a partir das cores computadas no navegador, convertendo OKLCH para luminância relativa sRGB.
- O grafo MCP não tinha projetos indexados; a inspeção usou os arquivos como alternativa.
- Detector impeccable tentado, mas indisponível: motor 0.1.5 não instalado e launcher incapaz de criar seu cache. Não há resultados de detector para atribuir ao relatório.
- A tentativa separada com Playwright/Chrome não concluiu; não foi usada como evidência. Navegação autenticada, dados reais, gestos touch, leitores de tela, zoom de 200%, outros motores e tempos de carregamento em rede limitada permanecem sem validação. Achados de componentes autenticados abaixo são estáticos.

## Achados P1

### 1. Avisos do login são emitidos, mas não exibidos

**Local:** `src/pages/LoginPage.tsx:118`, `:177`, `:215`, `:346`; `src/main.tsx:16`; `src/router.tsx:57`.
**Categoria:** Integridade da implementação.

O login chama `toast` para Solicitar acesso, falhas e sucesso de recuperação de senha. A rota fica fora do AppShell e não monta Toaster; o bootstrap React também não tem um host global. No navegador, Solicitar acesso não exibiu a orientação prevista no código. O usuário não descobre como obter acesso e pode não receber resultados da recuperação de senha.

**Recomendação:** disponibilizar um único host de notificações nas rotas públicas ou exibir feedback local persistente. Verificar solicitação de acesso, falha de rede, reenvio e redefinição. **Comando:** `$impeccable harden login`. Sem critério WCAG isolado atribuído: o feedback sequer é apresentado visualmente.

### 2. Consultar processo é um botão sem ação

**Local:** `src/pages/LoginPage.tsx:266`.
**Categoria:** Integridade da implementação.

O botão tem `type="button"`, mas nenhum handler ou destino. O clique no navegador não alterou a interface. A promessa de consultar protocolo/documento termina num controle inerte.

**Recomendação:** conectar à jornada de consulta correta; distinguir consulta de requisição e validação de documento conforme a capacidade disponível. **Comando:** `$impeccable harden login`. Não é uma avaliação estética nem uma alegação de conformidade normativa.

### 3. Modais não administram o foco

**Local:** `src/components/ui/Dialog.tsx:21`; `src/components/ui/ConfirmDialog.tsx:65`.
**Categoria:** Acessibilidade.

Dialog anuncia `aria-modal`, mas só implementa Escape: não move/restaura o foco nem impede Tab de atingir o fundo. ConfirmDialog também não isola o foco e não declara papel/nome de diálogo. Usuários de teclado e leitores de tela podem continuar operando conteúdo atrás da janela.

**Referência:** ordem de foco (WCAG 2.4.3), nome/papel/valor (4.1.2) e padrão de diálogo modal WAI-ARIA; fluxo real de teclado ainda requer reprodução autenticada.
**Recomendação:** adotar uma primitiva modal acessível com foco inicial, contenção, retorno ao disparador e fundo inerte. **Comando:** `$impeccable harden dialogs`.

### 4. Menu móvel fechado continua disponível ao teclado

**Local:** `src/layout/Sidebar.tsx:36`; `src/layout/AppShell.tsx:57`.
**Categoria:** Acessibilidade / Responsividade.

O estado fechado apenas aplica `-translate-x-full`; os links e botões permanecem montados, sem `inert` ou ocultação que retire o foco. O drawer aberto também não contém o foco, e a abertura não comunica `aria-expanded`. O usuário pode tabular por controles fora da tela.

**Referência:** WCAG 2.4.3 e 2.4.7; achado estático, sem sessão autenticada.
**Recomendação:** controlar disponibilidade ao foco conforme viewport/abertura e implementar abertura/fechamento por teclado com restauração de foco. **Comando:** `$impeccable adapt sidebar`.

### 5. Contraste insuficiente em Esqueci minha senha

**Local:** `src/pages/LoginPage.tsx:336`; `tokens.css:31`.
**Categoria:** Acessibilidade.

Texto computado: `oklch(0.704 0.04 256.788)`; fundo do painel: `oklch(0.9789 0.0029 264.54)`. Contraste aproximado **2,47:1**, texto de 14 px. O acesso à recuperação de senha fica difícil de perceber.

**Referência:** WCAG 1.4.3 AA, mínimo de 4,5:1 para esse texto.
**Recomendação:** usar uma cor semântica com contraste suficiente no estado normal e verificar outros textos auxiliares antes de estender a correção. **Comando:** `$impeccable harden login`.

### 6. Toast excede telas estreitas

**Local:** `src/components/ui/Toaster.tsx:28`; `src/styles/globals.css:24`.
**Categoria:** Responsividade.

A largura é 360 px, com deslocamento de 16 px à direita. Num viewport de 320 px, a borda esquerda fica em **−56 px**. O overflow horizontal global é recortado; o início da notificação pode desaparecer. É dedução geométrica do CSS, não captura de toast autenticado.

**Referência:** reflow, WCAG 1.4.10.
**Recomendação:** limitar a largura ao viewport menos margens, permitir quebra de mensagens longas e validar em 320/375 px. **Comando:** `$impeccable adapt toaster`.

### 7. Enter confirma mesmo quando Cancelar está focado

**Local:** `src/components/ui/ConfirmDialog.tsx:70`, `:95`.
**Categoria:** Acessibilidade / Integridade da implementação.

O listener de `keydown` em `window` resolve `true` para qualquer Enter. O evento de Enter no botão Cancelar também propaga até esse listener, que pode resolver a promessa como confirmação antes do clique nativo de cancelamento. O fluxo destrutivo pode executar a ação oposta à intenção do usuário.

**Referência:** comportamento esperado de botões por teclado; não atribuído a um critério WCAG específico sem ensaio completo.
**Recomendação:** deixar Enter acionar somente o botão focado, remover confirmação global e testar Cancelar/Confirmar por Enter e Espaço. **Comando:** `$impeccable harden confirmation-dialog`.

## Achados P2

### 8. Editores administrativos entram no carregamento inicial

**Local:** `src/router.tsx:1`; `src/main.tsx:9`; `src/styles/globals.css:3`.
**Categoria:** Desempenho.

As páginas, inclusive modelador BPMN, formulários e relatórios, são importadas estaticamente. O build produz um único JS de **3,46 MB**, cerca de **1,01 MB gzip**, além de CSS global de editores. Solicitantes no login e catálogo pagam download e processamento de funcionalidades administrativas.

**Recomendação:** separar rotas com importação dinâmica, carregar CSS de editores no respectivo fluxo e comparar o pacote inicial após a alteração. Não há medição de LCP/INP nesta auditoria. **Comando:** `$impeccable optimize routes`.

### 9. Falhas de carregamento não oferecem recuperação explícita

**Local:** `src/layout/AppShell.tsx:52`; `src/pages/LoadingSplash.tsx:3`; `src/stores/session.ts:171`; `src/pages/CentralServicosPage.tsx:76`.
**Categoria:** Integridade da implementação.

Após falha do bootstrap, AppShell mantém um spinner com “Não foi possível conectar ao backend”, sem retry; o efeito só reinicia em `idle`. A Central pede para tentar novamente, mas não oferece ação correspondente, também observado no navegador. Recarregar a página é um contorno, mas fica a cargo do usuário descobri-lo.

**Recomendação:** diferenciar carregamento e falha terminal, disponibilizar Tentar novamente e comunicar a tentativa. Replicar o padrão já existente em Tarefas. **Comando:** `$impeccable harden loading-states`.

### 10. Cor primária configurável não governa a identidade da aplicação

**Local:** `src/pages/admin/ParametrosPage.tsx:546`; `src/stores/session.ts:36`; `tokens.css:9`; `src/layout/AppShell.tsx:55`.
**Categoria:** Tematização.

O parâmetro do ambiente é editável e armazenado, mas não há consumo de `tenant.primaryColor` no shell/login nem aplicação a tokens. A busca encontrou usos separados de `button.primaryColor` para botões de processo, que não resolvem o parâmetro do ambiente. A pessoa configura uma identidade sem ver o efeito correspondente nas superfícies examinadas.

**Recomendação:** definir o alcance da cor do ambiente e vinculá-la a tokens semânticos com contraste validado; refletir esse alcance no texto do campo. **Comando:** `$impeccable harden theming`.

## Padrões e pontos positivos

Os problemas se concentram em infraestrutura compartilhada: hosts por rota, foco de overlays, recuperação de erros e tokens. Corrigir a origem reduz repetição entre jornadas.

Práticas que já funcionam e devem ser preservadas:

- Tokens reais em `tokens.css`, importados pelos estilos; a hipótese de variáveis ausentes foi descartada.
- Login reorganizado em uma coluna a 320 px, com ações presentes na inspeção.
- Central de serviços usa links reais, busca rotulada e informa antecipadamente a exigência de login.
- Tarefas oferece estado de erro com `role="alert"`, instrução e Tentar novamente (`src/pages/TarefasPage.tsx:500`).
- Formulários têm grid de uma coluna em telas pequenas; Dialog limita altura e permite rolagem interna.
- Há adaptações para movimento reduzido no login e em outras superfícies. Não foi demonstrado problema de animação que justifique um achado adicional.
- O build e a checagem TypeScript passaram.

Ausência de modo escuro não foi tratada como defeito: não há compromisso de produto confirmado para esse recurso. Controles menores que 44 px não foram classificados automaticamente como violação AA; tamanho e espaçamento exigem avaliação contextual.

## Ordem recomendada

1. **P1 — `$impeccable harden`**: feedback/ações do login, confirmação por Enter, foco modal e contraste.
2. **P1 — `$impeccable adapt`**: sidebar móvel e largura de notificações.
3. **P2 — `$impeccable harden`**: recuperação de falhas e alcance da cor primária.
4. **P2 — `$impeccable optimize`**: dividir carregamento por rota.
5. **Final — `$impeccable polish`**: acabamento após resolver comportamento e acessibilidade.

É possível executar essas etapas individualmente, juntas ou em outra ordem. Depois das correções, repetir `$impeccable audit`, incluindo sessão autenticada e gestos touch para cobrir as limitações desta rodada.

# Auditoria técnica — /requests

Data: 24/09/2026. Alvo: listagem de Requisições, implementada por `InstanciasPage`. Critério de produto: autoatendimento para usuários internos e solicitantes externos.

## Veredito de integridade

**Reprovado quanto à consistência dos estados de consulta.** A organização é específica do produto, com processo, número, status e datas. Entretanto, seleção de filtro, resultados e paginação podem contradizer-se. Isso afeta a confiança no acompanhamento das próprias requisições.

## Resumo e nota do escopo

**13/20 — aceitável, com trabalho significativo necessário.** Esta nota pertence somente à listagem `/requests` e às dependências examinadas; não representa o produto inteiro nem certifica conformidade WCAG.

| Dimensão | Nota / 4 | Evidência |
|---|---:|---|
| Acessibilidade | 3 | Busca rotulada e foco visível; navegação por elementos sem semântica nativa de link |
| Desempenho | 2 | Busca dispara por tecla; pacote inicial compartilhado com editores |
| Responsividade | 3 | Sem overflow nos tamanhos verificados; seletor de tabela contradiz apresentação móvel |
| Tematização | 3 | Paleta coerente e tokens compartilhados; classes diretas de slate ainda predominam |
| Integridade da implementação | 2 | Resultados antigos sem indicação e página fora do intervalo |
| **Total** | **13/20** | **1 P1, 5 P2; nenhum P0 ou P3** |

Prioridade: indicar atualização dos resultados, corrigir a paginação e sincronizar o seletor com a apresentação real.

## Método e limites

- Contexto impeccable carregado para `src/pages/InstanciasPage.tsx`; grafo MCP consultado para componentes e hook da consulta.
- Detector executado: `impeccable detect --json src/pages/InstanciasPage.tsx` retornou `[]`. Os achados abaixo foram verificados no código e/ou no comportamento; não são alertas do detector.
- Componente real compilado com esbuild, BrowserRouter, QueryClient e store de sessão; API simulada em Chrome headless. CSS proveniente do build atual. Sessão interna e externa simuladas, sem credenciais ou alterações de dados reais.
- Capturas e medidas em 1280, 768, 375 e 320 px, altura de 900 px. Verificados cards/tabela, busca, histórico, filtro, vazio, falha 503 com repetição e página fora do intervalo.
- O cenário externo validou a renderização da listagem; não certifica autorização do backend. O shell completo, `/requests/:id`, edição, tramitação, formulários, autenticação real, leitor de tela, zoom de 200%, contraste automatizado e gestos touch não foram auditados nesta rodada. Viewport estreito é emulação de layout, não teste em aparelho físico.
- Primeiro ensaio parou ao esperar um card visível em 768 px com tabela selecionada; corrigida essa expectativa do roteiro, o ensaio concluiu. Isso não foi classificado como defeito da aplicação.
- Build/TypeScript aprovado. JS inicial: **2.429,22 kB**, **697,54 kB gzip**. CSS: **235,30 kB**, **54,60 kB gzip**. Sem medição de LCP/INP ou tempo real de rede.

## Achados

### 1. [P1] Novo filtro exibe resultados antigos sem informar atualização

**Local:** `src/lib/api/execution.ts:253`; `src/pages/InstanciasPage.tsx:74` e `:79`.
**Categoria:** Integridade / acessibilidade de estados.

`placeholderData: (p) => p` mantém a lista anterior, enquanto a página só trata `isLoading`. Ao selecionar Concluídos com resposta atrasada em 1,8 s, o primeiro ensaio registrou o botão selecionado e o card ainda em Em andamento; nenhum `aria-busy` estava presente. O usuário pode interpretar resultados antigos como pertencentes ao novo filtro, sobretudo em redes lentas.

**Recomendação:** diferenciar carregamento inicial de atualização; indicar “Atualizando requisições” durante `isFetching`, comunicar o estado em região apropriada e identificar dados anteriores enquanto forem apresentados. Evitar anunciar quantidade/status como definitivos antes da resposta.
**Padrão:** consistência de estado; aplicar WCAG 4.1.3 à mensagem de atualização implementada. Não foi executada certificação com leitor de tela.
**Comando:** `$impeccable harden /requests`.

### 2. [P2] Digitar a busca cria uma navegação e uma chamada por letra

**Local:** `src/pages/InstanciasPage.tsx:57` e `:75`; `src/lib/api/execution.ts:248`.
**Categoria:** Desempenho / integridade.

Digitando `abc` com 180 ms entre letras, foram registradas três chamadas: `q=a`, `q=ab`, `q=abc`. Voltar no navegador retornou de `q=abc` para `q=ab`. O histórico passa a representar a digitação, dificultando voltar à tela anterior e produzindo consultas intermediárias desnecessárias.

**Recomendação:** manter texto local e aplicar debounce à consulta; substituir a entrada do histórico durante a digitação. Preservar navegações deliberadas, como paginação/status, conforme o comportamento escolhido para Voltar.
**Padrão:** sem violação WCAG específica atribuída.
**Comando:** `$impeccable optimize /requests`.

### 3. [P2] Página fora do intervalo produz listagem vazia com total positivo

**Local:** `src/pages/InstanciasPage.tsx:41`, `:47`, `:79` e `:92`.
**Categoria:** Integridade.

O parâmetro `page` recebe apenas limite inferior. Com `page=99` e resposta simulada de total 1/itens vazios, a tela mostrou cabeçalho de tabela, “1 requisição” e **99 / 1**, sem explicar por que nada aparece. Links antigos ou redução do conjunto entre acessos podem levar ao mesmo estado. Valores fracionários também não são normalizados.

**Recomendação:** validar inteiro positivo e, após a resposta definitiva, normalizar para a página válida indicada pelo servidor ou para o último índice disponível. Tratar vazio da página separadamente de total zero.
**Padrão:** robustez de navegação; nenhum critério WCAG específico atribuído.
**Comando:** `$impeccable harden /requests`.

### 4. [P2] Seletor indica Tabela no celular, mas renderiza cards

**Local:** `src/pages/InstanciasPage.tsx:71` e `:87`; `src/pages/TarefasPage.tsx:509`.
**Categoria:** Responsividade / integridade.

Em 320 e 375 px, Tabela permaneceu com `aria-pressed="true"`, enquanto a tabela estava oculta por breakpoint e os cards visíveis. O usuário pode repetir a ação acreditando que o comando falhou.

**Recomendação:** ocultar o seletor quando há uma única apresentação disponível ou comunicar a adaptação e refletir a apresentação efetiva no estado acessível. A preferência desktop pode ser preservada separadamente.
**Padrão:** correspondência entre controle e resultado; não classificado automaticamente como falha WCAG.
**Comando:** `$impeccable adapt /requests`.

### 5. [P2] Navegação para a requisição não usa links reais

**Local:** `src/pages/InstanciasPage.tsx:105` e `:122`; `src/components/execution/ExecutionListParts.tsx:11`.
**Categoria:** Acessibilidade / integridade.

O card é `article role="link"`, a linha de tabela é `tr tabIndex=0` com handlers e o número é um botão. A tabela renderizada confirmou ausência de `a[href]` e linha focável sem papel de ação. Enter/Espaço possuem handlers, portanto não se trata de ausência completa de teclado; o problema é perder navegação nativa, cópia de endereço, menu contextual e descoberta de links por tecnologia assistiva. O botão numerado oferece um caminho alternativo quando existe número.

**Recomendação:** usar link real no número/título, preservar semântica de linha/célula e manter controles de tags como ações independentes. Informar abertura de nova aba quando mantida.
**Padrão:** semântica de navegação HTML; WCAG 4.1.2 é referência para o papel da ação, sem alegar reprovação de toda a tabela.
**Comando:** `$impeccable harden /requests`.

### 6. [P2] A listagem carrega código de edição e relatórios no pacote inicial

**Local:** `src/router.tsx:23`; `src/pages/InstanciasPage.tsx:6` e `:11`.
**Categoria:** Desempenho.

As rotas são importadas estaticamente. O mesmo módulo da listagem contém InstanceReport e importa ReactForm; o seletor de apresentação vem do módulo inteiro de Tarefas. O build atual entrega um único JS inicial de 2,43 MB (697,54 kB gzip), incluindo funcionalidades que não são necessárias para simplesmente acompanhar requisições. O valor é do aplicativo compartilhado, não o tamanho isolado desta página.

**Recomendação:** separar utilitários de apresentação dos módulos de página e carregar rotas/relatório sob demanda. Medir o pacote inicial de `/requests` antes e depois, sem impor memoização sem evidência.
**Padrão:** sem violação WCAG atribuída; impacto de tempo real ainda não medido.
**Comando:** `$impeccable optimize /requests`.

## Padrões e práticas positivas

O principal padrão é sincronização incompleta entre URL, consulta assíncrona e apresentação. Correções devem manter uma fonte de verdade clara para filtro, página válida, estado de atualização e modo efetivamente visível.

Práticas verificadas que devem ser preservadas:

- Busca com rótulo acessível, filtros com `aria-pressed` e indicação de foco.
- Paginação de 20 itens, limites nos botões e área de 44 × 44 px para avançar/voltar.
- Falha anunciada com `role="alert"`; Tentar novamente recuperou a listagem após retirar o 503 simulado.
- Filtro de status reinicia a página; URL mantém filtros compartilháveis.
- Sem overflow horizontal nos três viewports estreitos medidos; tabela substituída por cards em mobile.
- Consulta usa `mine=me`; modos interno e externo participam da chave de cache.
- Tokens compartilhados para texto, superfície e movimento. A paleta slate é consistente; usar utilitários de cor não equivale a ausência completa de tokens.

O detector não apontou ocorrências. Ausência de modo escuro não foi tratada como defeito, pois não há compromisso confirmado para esse recurso. Controles de 28 × 32 px do seletor estão abaixo da meta confortável de 44 px, mas não foram classificados isoladamente como violação AA. O uso de redução global de duração de animações no CSS merece revisão futura se houver perda de feedback observada; nenhuma foi demonstrada aqui.

## Evidências visuais

Capturas com dados inteiramente fictícios, componente isolado e CSS atual:

- [Desktop em cards](desktop.png)
- [Tabela desktop](table.png)
- [320 px com Tabela selecionada e cards visíveis](width-320.png)

## Ordem recomendada

1. `$impeccable harden /requests`: atualização de filtros, página válida e links semânticos.
2. `$impeccable adapt /requests`: seletor de apresentação móvel.
3. `$impeccable optimize /requests`: digitação/histórico e carregamento por rota.
4. `$impeccable polish /requests`: acabamento após as correções.

As etapas podem ser executadas individualmente, juntas ou em outra ordem. Repetir `$impeccable audit /requests` depois das correções e complementar com backend real, shell autenticado e tecnologias assistivas. Nenhuma alteração de interface foi aplicada nesta auditoria.

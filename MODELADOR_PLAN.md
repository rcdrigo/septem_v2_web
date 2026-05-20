# Modelador de Processos — Plano de implementação

Objetivo: ter, dentro do `septem_v2_web`, um modelador BPMN equivalente em essência ao do Orquestra/ZEEV, mas em React + bpmn-js. Cada fase encerra com algo demonstrável no navegador.

> Referência funcional: `/home/rodrigo/Documentos/vinicius/ZEEV_44710_428/1_Aplicacao/Designer/`.
> Especificação canônica: ver a mensagem do usuário ("Modelador de processos (módulo)") + tabelas `flow_*`.

---

## Fase 0 — Reestruturar a página do Modelador ✅

Hoje `ModeladorPage` é uma toolbar simples + canvas. Vamos trocar pelo layout definitivo (vazio, mas com todas as âncoras visuais).

- [x] Renomear o `ModeladorPage` atual para `ModeladorLegacyPage` (manter rota `/modelador-legacy` temporariamente para regressão visual)
- [x] Criar `pages/modelador/ModeladorPage.tsx` com layout 3 colunas: paleta (esq.) / canvas (centro) / painel de propriedades (dir.)
- [x] Criar `components/modelador/ModeladorNavbar.tsx` com:
  - [x] Nome do processo editável (default `Processo-${timestamp}`; prefixo do usuário virá quando houver auth)
  - [x] Grupo de botões à direita: **Fluxo** | **Formulário** | **Tarefas × Campos** | **Recursos** | **Configurações**
  - [x] Botão ativo destaca-se; cada um troca a "view" central
- [x] Estado global do modelador em Zustand (`stores/modelador.ts`): `processName`, `currentView`, `selectedElementId`, `xml`
- [x] Roteamento: `/modelador` → nova página; `/modelador-legacy` → antiga; `/formulario` mantido por ora

**Aceite:** `npm run build` limpo. Abrir `/modelador` mostra navbar com nome editável, 5 botões, canvas bpmn-js no centro e painel de propriedades do bpmn-js à direita (será substituído na Fase 2).

> Decisão durante implementação: a "paleta esquerda" é a paleta nativa do bpmn-js (já flutua sobre o canvas). Não criamos uma coluna separada para ela — economiza um wrapper sem ganho funcional. Quando customizarmos a paleta na Fase 1, será via `additionalModules`, não via componente React próprio.

---

## Fase 1 — Canvas BPMN com paleta customizada PT-BR ✅

O bpmn-js já está no projeto. Vamos restringir a paleta exatamente aos 12 elementos da spec.

- [x] Configurar `BpmnModeler` com `additionalModules` para sobrescrever paleta (`SeptemPaletteModule`)
- [x] Paleta com **apenas** estes elementos, em PT-BR e com ícones do bpmn-font:
  - [x] Início (`bpmn:StartEvent`)
  - [x] Tarefa humana (`bpmn:UserTask`)
  - [x] Atividade de serviço / fonte de dados (`bpmn:ServiceTask`)
  - [x] Subprocesso (`bpmn:CallActivity`)
  - [x] Evento de e-mail (`bpmn:IntermediateThrowEvent` + `MessageEventDefinition`)
  - [x] Evento de timer (`bpmn:IntermediateCatchEvent` + `TimerEventDefinition`)
  - [x] Evento de marco (`bpmn:IntermediateThrowEvent` + `SignalEventDefinition`)
  - [x] Desvio condicional inclusivo (`bpmn:InclusiveGateway`)
  - [x] Desvio condicional exclusivo (`bpmn:ExclusiveGateway`)
  - [x] Desvio de paralelismo (`bpmn:ParallelGateway`)
  - [x] Convergência de paralelismo (`bpmn:ParallelGateway`)
  - [x] Fim (`bpmn:EndEvent`)
- [x] Auto-save do XML em `localStorage` (`septem.modelador.xml`) a cada mudança (debounce 500ms)
- [x] Carregar último estado ao montar a página

**Aceite:** `npm run build` limpo. Paleta exibe apenas os 12 elementos + ferramentas (mão, laço, espaço, conector). Recarregar a página recupera o último diagrama.

> Decisão: split e join paralelos compartilham `bpmn:ParallelGateway` — BPMN não os distingue estruturalmente, e o comportamento depende do número de conexões de entrada/saída. Mantemos como entradas separadas na paleta para alinhar com a spec do usuário (UX). O `contextPad` (botões que aparecem em volta de um elemento selecionado) ainda é o do bpmn-js — refinar na Fase 2.

---

## Fase 2 — Painel lateral genérico de propriedades ✅

Substitui os Config*.aspx do ZEEV. Quando um elemento é selecionado, renderizamos um painel à direita do tipo correto.

- [x] Moddle extension `septem:` (`Alias`, `Routines`, `ActionButton(s)`, `Signature`) plugada no Modeler via `moddleExtensions`
- [x] `selection.changed` listener no `BpmnModeler` grava `selectedElementId` no Zustand
- [x] `PropertiesPanel.tsx` despacha por `businessObject.$type` + mostra placeholder para seções específicas
- [x] `<GeneralInfoSection>` com Nome (atributo `name`), Descrição (`bpmn:Documentation`), Apelido (`septem:Alias`)
- [x] `<RoutinesSection>` com os 4 ganchos (`septem:Routines` com `preCreate`/`postCreate`/`preFinish`/`postFinish`)
- [x] Persistência: tudo via `modeling.updateProperties` → entra no commandStack → auto-save dispara XML para localStorage e Zustand
- [x] Helpers reutilizáveis em `lib/bpmn-helpers.ts` (getName/setName, getDocumentation/setDocumentation, getAlias/setAlias, getRoutines/setRoutines)
- [x] Primitives de UI: `<Field>`, `<TextInput>`, `<TextArea>`, `<Section>` em `components/ui/Field.tsx`

**Aceite:** clicar em qualquer elemento abre painel à direita com Nome / Descrição / Apelido funcionais; Rotinas aparecem nos tipos que executam (UserTask, ServiceTask, CallActivity, eventos intermediários). Valores persistem ao trocar de elemento e ao recarregar a página.

> Decisões durante implementação:
> - **Sem botão "Aplicar"** — mudanças são commit no blur do input (Tab/clicar fora). UX mais moderna; o auto-save global garante a propagação.
> - **Sem componente "Botões de ação" / "Assinatura" / "Responsáveis e prazos" aqui** — esses são widgets compostos da Fase 4; nas seções específicas da Fase 3 ficam como placeholder.
> - **Bundle do bpmn-js-properties-panel dispensado** — saímos do bundle (~320 kB economizados). Dependência permanece em `package.json` por enquanto; remover quando estabilizar.

---

## Fase 3 — Painéis específicos por tipo de elemento ✅

Um painel por tipo. Arquitetura: `panels/` (1 arquivo por tipo, só compõe seções) + `sections/` (widgets reutilizáveis) + `registry.ts` (dispatcher). Todo painel implementa `PanelProps`.

- [x] **3.0 Fundação**: moddle estendido (ServiceSource, SubprocessConfig, EmailTemplate, TimerConfig, MilestoneConfig, ActorConfig, DeadlineConfig); helpers genéricos `getExtensionConfig` / `setExtensionConfig`; hook `useExtensionState`; primitives `Select` / `Checkbox` / `RadioGroup` / `PlaceholderBox`
- [x] **3.1 Início + Tarefa Humana** — `StartEventPanel`, `UserTaskPanel`. Compartilham GeneralInfo + FormFields placeholder + ActionButtons placeholder + Signature + Routines. UserTask adiciona DeadlineActor (parcialmente funcional, alertas em placeholder).
- [x] **3.2 Atividade de serviço** — `ServiceTaskPanel` + `ServiceSourceSection`
- [x] **3.3 Subprocesso** — `CallActivityPanel` + `SubprocessConfigSection` (processo, sincronia, 2 checkboxes, multi-instance)
- [x] **3.4 Evento de e-mail** — `EmailEventPanel` + `EmailTemplateSection`
- [x] **3.5 Evento de timer** — `TimerEventPanel` + `TimerSection` (4 tipos + fixa/dinâmica)
- [x] **3.6 Evento de marco** — `MilestoneEventPanel` + `MilestoneSection` (ação + nome com auto-discovery de marcos já usados + "Outro")
- [x] **3.7 Gateway condicional** — `InclusiveGatewayPanel`, `ExclusiveGatewayPanel` + `GatewayLinksSection` (lista conexões de saída; botão "Configurar condições" como placeholder)
- [x] **3.8 Paralelismo** — `ParallelGatewayPanel` que detecta automaticamente split vs join pelo número de entradas/saídas
- [x] **3.9 Dispatcher + Fim** — `PropertiesPanel.tsx` virou dispatcher puro (lê `panels/registry.ts`); `EndEventPanel`; `GenericPanel` como fallback

**Aceite:** cada elemento abre seu próprio painel. Campos persistem como `extensionElements` no XML (visível no `localStorage`). Trocar de elemento e voltar mantém valores.

> Arquitetura:
> ```
> components/modelador/
> ├── ModeladorNavbar.tsx
> ├── PropertiesPanel.tsx          (dispatcher: 50 linhas)
> ├── panels/                       (1 arquivo por tipo, compõe seções)
> │   ├── registry.ts                ← única função "switch por $type"
> │   ├── types.ts                   ← PanelProps
> │   ├── StartEventPanel.tsx        ├── EndEventPanel.tsx
> │   ├── UserTaskPanel.tsx          ├── ServiceTaskPanel.tsx
> │   ├── CallActivityPanel.tsx      ├── EmailEventPanel.tsx
> │   ├── TimerEventPanel.tsx        ├── MilestoneEventPanel.tsx
> │   ├── InclusiveGatewayPanel.tsx  ├── ExclusiveGatewayPanel.tsx
> │   ├── ParallelGatewayPanel.tsx   └── GenericPanel.tsx
> └── sections/                      (widgets reutilizáveis)
>     ├── GeneralInfoSection.tsx      ├── RoutinesSection.tsx
>     ├── SignatureSection.tsx        ├── FormFieldsSection.tsx (placeholder)
>     ├── ActionButtonsSection.tsx    ├── DeadlineActorSection.tsx
>     ├── ServiceSourceSection.tsx    ├── SubprocessConfigSection.tsx
>     ├── EmailTemplateSection.tsx    ├── TimerSection.tsx
>     ├── MilestoneSection.tsx        └── GatewayLinksSection.tsx
> ```
>
> **Padrões aplicados:**
> - Cada Section é independente. Recebe `{ modeler, element }` e edita uma única extensão moddle.
> - Hook `useExtensionState<T>` centraliza o ciclo "ler default → estado local → blur → moddle".
> - Inputs livres usam `update` + `commit` (escreve no blur). Selects / radios / checkboxes usam `flush` direto.
> - O XML do BPMN é a fonte da verdade; o Zustand só guarda `selectedElementId`, `processName`, `currentView` e uma cópia do XML pro auto-save.
> - O moddle `septem:*` registrado garante round-trip: importar um XML salvo recupera todas as configs intactas.

---

## Fase 4 — Subcomponentes complexos compartilhados ✅

Widgets reutilizados por vários painéis. Implementados em `components/modelador/editors/` para reuso fora dos painéis (ex: tela "Tarefas × Campos" da Fase 5).

- [x] **4.0 Fundação**: moddle estendido (`DeadlineAlert(s)`, `FormRule`, `GatewayCondition`, `FormFieldEntry`, `FormFields`); `lib/bpmn-arrays.ts` (`getExtensionCollection`/`setExtensionCollection`); helpers por domínio (`bpmn-action-buttons`, `bpmn-deadline-alerts`, `bpmn-gateway-conditions`, `bpmn-form-fields`); primitives `ColorPicker`, `IconButton`; `slugify`, `uid`; `formStore` (Zustand)
- [x] **4.1 Editor de botões de ação** (`<ActionButtonsEditor>`)
  - [x] Lista com botão default ("Enviar requisição" / "Concluir") materializado no XML ao primeiro toque
  - [x] Adicionar/remover botões (o último não pode ser removido)
  - [x] Nome, Id (slugify automático do nome; editável), color picker primário, color picker texto, checkbox "valida campos"
  - [x] Header de cada linha mostra preview do botão renderizado com as cores escolhidas
- [x] **4.2 Editor de responsáveis e prazos** (`<DeadlineAlertsEditor>` dentro de `DeadlineActorSection`)
  - [x] 3 checkboxes: respeitar horas úteis / msg recebimento / msg prazo a expirar (já era da Fase 3)
  - [x] Quando "msg prazo a expirar" ON: cronograma de alertas inline (único/repetido + 4 triggers: após dias/horas, faltando dias/horas; intervalo se repetido)
  - [x] Radio responsável + prazo (já era da Fase 3)
- [x] **4.3 Matriz de visibilidade campos × tarefa** (`<FieldVisibilityEditor>`)
  - [x] Lê o formulário do processo via `formStore`
  - [x] Empty-state quando o form não foi configurado (wire com FormBuilder na Fase 5)
  - [x] Campos agrupados por `fieldGroup` (formato form-js)
  - [x] Toggle 3-estados por campo (ícones EyeOff/Eye/Pencil) + input opcional de fonte de dados
- [x] **4.4 Configurador de condição de gateway** (`<GatewayConditionEditor>`)
  - [x] Inline expansível por conexão dentro de `GatewayLinksSection`
  - [x] 3 modos via radio:
    - Botão de conclusão clicado — combobox lendo `septem:ActionButtons` de TODAS as tarefas do processo (agrupado por "tarefa → botão")
    - Valores do formulário — tabela campo + operador (`=, ≠, >, <, ≥, ≤, contém, começa com`) + valor; campos vêm do `formStore`
    - "Quando nenhuma das demais regras for atendida" (else)
  - [x] Trocar de modo limpa os dados do modo anterior (mode XOR no XML)

**Aceite:** todos os painéis da Fase 3 expõem os widgets reais. Configurar → recarregar → tudo volta intacto via moddle round-trip.

> Arquitetura adicionada:
> ```
> lib/
> ├── bpmn-arrays.ts                    (helpers genéricos para coleções isMany)
> ├── bpmn-action-buttons.ts            (ActionButton[] + getAllProcessButtons)
> ├── bpmn-deadline-alerts.ts           (DeadlineAlert[])
> ├── bpmn-gateway-conditions.ts        (GatewayCondition + FormRule[] + operadores)
> ├── bpmn-form-fields.ts               (FormFieldEntry[] + upsert)
> ├── slugify.ts  +  uid.ts
> stores/
> └── form.ts                           (schema do form; populado na Fase 5)
> components/
> ├── ui/
> │   ├── ColorPicker.tsx  +  IconButton.tsx
> └── modelador/
>     └── editors/
>         ├── ActionButtonsEditor.tsx
>         ├── DeadlineAlertsEditor.tsx
>         ├── GatewayConditionEditor.tsx
>         └── FieldVisibilityEditor.tsx
> ```
>
> **Decisões:**
> - **Editors são independentes das Sections** — podem ser embarcados em outros contextos (telas full-page da Fase 5).
> - **Coleções no moddle** — usamos containers `septem:ActionButtons{buttons[]}` em vez de muitos `ActionButton` soltos. Mantém o XML mais previsível e o moddle valida o aninhamento.
> - **GatewayCondition mora na `SequenceFlow`**, não no gateway. Razão: cada conexão tem sua condição própria; juntar tudo no gateway dobraria o trabalho de manutenção quando conexões mudam.
> - **FieldVisibility roundtrips só entradas não-default** (não-`visible` ou com fonte) — economiza XML para o caso normal.

---

## Fase 5 — Views auxiliares da navbar ✅

Refator estrutural: a navbar agora tem 4 botões togglando view + dropdown "Recursos" disparando ações (não muda view). Views vivem em `components/modelador/views/`.

- [x] **Fluxo** — extraído em `views/FluxoView.tsx` (canvas + painel direito). Permanece sempre montado (oculto via `hidden`) para preservar a instância do bpmn-js entre trocas de view.
- [x] **Formulário** — `views/FormularioView.tsx` monta o `FormBuilder` (form-js) dentro do modelador. Schema persiste em 3 lugares: `formStore` (Zustand, alimenta os outros painéis), `localStorage` (sobrevive a F5), e `septem:FormSchema` no `bpmn:Process` (round-trip via export/import). Polling 600ms detecta mudanças.
- [x] **Tarefas × Campos** — `views/TarefasCamposView.tsx`. Matriz full-page: rows = campos do form agrupados por `fieldGroup`, cols = `UserTask`+`StartEvent` do diagrama. Cada célula tem toggle 3-estados (oculto/visível/editável). Reativa a mudanças no diagrama via eventBus.
- [x] **Recursos** — dropdown com 3 ações:
  - [x] Importar fluxo (`.bpmn`/`.xml`) — `<input file>` programático
  - [x] Exportar fluxo (`.bpmn` formatado, nome do arquivo = nome do processo)
  - [x] Salvar como imagem (PNG 2× — SVG do bpmn-js → `<canvas>` → toDataURL)
- [x] **Configurações** — `views/ConfiguracoesView.tsx`. Form com todos os campos da tabela `flows` (nome sincronizado com navbar, descrição, doc URL, ícone, inbox HTML, categoria, área, status radio rascunho/publicado/inativo, 3 checkboxes). Persiste em `septem:ProcessConfig` no `bpmn:Process`.

**Aceite:** os 4 botões + dropdown da navbar funcionam. Configurar processo → preencher form → ver matriz → exportar `.bpmn` → importar de volta = tudo intacto (round-trip pelo XML).

> Estrutura adicionada:
> ```
> lib/
> ├── bpmn-process.ts             (ProcessConfig + FormSchema embutido + name)
> ├── form-schema.ts              (extractFields: form-js → FormFieldDescriptor[])
> ├── recursos.ts                 (importBpmn / exportBpmn / exportPng)
> └── useProcessNameSync.ts       (XML.name ↔ Zustand.processName)
> components/
> ├── ui/Popover.tsx              (Popover + MenuItem + MenuDivider)
> └── modelador/views/
>     ├── FluxoView.tsx
>     ├── FormularioView.tsx
>     ├── TarefasCamposView.tsx
>     └── ConfiguracoesView.tsx
> ```
>
> **Decisões:**
> - **Recursos é dropdown, não view** — bate com a UX do `Designer2.ascx` do ZEEV (dropdown "Exportar" com PNG/SVG/BPMN). Não muda `currentView`.
> - **FluxoView sempre montado** — preserva o modeler do bpmn-js entre trocas de view; as outras views recebem a instância via prop e operam sobre ela (matriz reativa, configurações persistindo no bpmn:Process).
> - **Nome do processo = `bpmn:Process.name`** — sincronizado bidirecionalmente com Zustand via `useProcessNameSync`. Renomear na navbar ou em Configurações grava no XML.
> - **Schema do form mora no BPMN** — `septem:FormSchema` no `bpmn:Process` com JSON como `body`. Garante export/import único sem precisar de arquivo separado.
> - **Polling do form-js** — o evento `changed` do form-js v1 é inconsistente entre subversões; um interval de 600ms é robusto e o custo é desprezível (só persiste se o JSON realmente mudou).

---

## Fase 6 — Persistência no backend

> Contrato completo do backend para esta fase está documentado em
> **[`septem_v2/BACKEND_MODELADOR.md`](../septem_v2/BACKEND_MODELADOR.md)** —
> moddle ↔ tabelas, endpoints, regras de validação dual, checklist de implementação.
>
> Esta fase tem **2 frentes simultâneas** (backend e frontend). O backend está com
> spec fechada; o frontend só precisa do client HTTP e telas de listagem/publicação.

### 6.A — Backend (em `septem_v2`, .NET 10) — começa 2026-05-20

Detalhes em `septem_v2/BACKEND_MODELADOR.md` §8. Resumo:

- [ ] Scaffold .NET + Postgres + CI (ver `septem_v2/ARCHITECTURE.md §3`)
- [ ] Migrations: tabelas em `BACKEND_MODELADOR.md §3.1 + §3.2` (12 tabelas + colunas extras em `flow_tasks`)
- [ ] Seeds: `elements` (12 tipos), `flow_categories` (5 do domínio)
- [ ] Parser BPMN: lê todos os **17 tipos `septem:*`** (§2.1) + round-trip
- [ ] `ProcessValidator`: porta as 10 regras de `validation.ts` + 3 server-side (`ref-integrity`, `auth`, `key-conflict`)
- [ ] Endpoints:
  - [ ] `POST   /api/v1/workflow/process-definitions` (idempotente por `key`, transacional)
  - [ ] `GET    /api/v1/workflow/process-definitions/{key}` (com `?version=N` e `?format=xml`)
  - [ ] `GET    /api/v1/workflow/process-definitions` (paginado)
  - [ ] `PATCH  /api/v1/workflow/process-definitions/{key}/status`
  - [ ] `DELETE /api/v1/workflow/process-definitions/{key}` (soft-delete)
  - [ ] `GET    /api/v1/workflow/process-definitions/{key}/diagnostics`
- [ ] Endpoints catálogo (para combos do modelador):
  - [ ] `GET /api/v1/categories`
  - [ ] `GET /api/v1/areas` / `GET /api/v1/positions?areaId=`
  - [ ] `GET /api/v1/data-sources`
  - [ ] `GET /api/v1/email-templates`
- [ ] OpenAPI exposto em dev

### 6.B — Frontend (em `septem_v2_web`)

Esperando o backend ficar de pé. Pode ser feito **incrementalmente** conforme endpoints vão saindo.

- [ ] `src/lib/api.ts` — client HTTP base (fetch + JWT do header) + tipos compartilhados
- [ ] Instalar TanStack Query (`@tanstack/react-query`) + `<QueryClientProvider>` em `AppShell`
- [ ] Hook `useProcessDefinition(key)` — GET com cache; popula o modeler ao montar
- [ ] Hook `useSaveProcessDefinition()` — mutation; substitui `localStorage` como fonte canônica
- [ ] Botão "Publicar" em `ConfiguracoesView` — chama `POST` e troca status
- [ ] Aviso visual quando o XML tem alterações não salvas (dirty state na navbar)
- [ ] Tratamento de issues do backend: mapear `422 problem+json` para toasts + popular `DiagnosticsBadge` com issues server-side
- [ ] Trocar `<TextInput>` por `<Select>` nos campos que viram combo remoto:
  - [ ] Categoria em `ConfiguracoesView`
  - [ ] Área/posição em `DeadlineActorSection`
  - [ ] Fonte de dados em `RoutinesSection`, `ServiceSourceSection`, `ActorConfig`
  - [ ] Template em `EmailTemplateSection`
- [ ] Nova página `pages/processos/ProcessosPage.tsx` (rota `/processos`):
  - [ ] Lista paginada (busca, filtros por status/categoria)
  - [ ] Card por processo: nome, versão atual, status, ícone, contador de instâncias rodando
  - [ ] Botão "Abrir no modelador" → navega para `/modelador?key=...`
- [ ] `ModeladorPage` aceita query `?key=...` → carrega versão atual do backend
- [ ] Remover dependência de `localStorage.septem.modelador.xml` (manter como fallback offline opcional)

**Aceite end-to-end:** criar processo no modelador → publicar → fechar aba → entrar em `/processos` → abrir o processo → tudo idêntico, sem `localStorage`.

> Decidimos **completar Fases 5 e 7 antes** do backend (Fase 6) para chegar em
> 2026-05-20 com o frontend 100% pronto e os contratos consolidados em
> `BACKEND_MODELADOR.md`. Hoje o modelador funciona end-to-end via `localStorage`
> + XML embutido — qualquer regressão durante a integração do backend pode ser
> diagnosticada comparando com o estado offline.

---

## Fase 7 — Polimento ✅

- [x] **Toaster próprio** (`stores/toast.ts` + `ui/Toaster.tsx`) com 4 níveis (success/error/info/warning) e auto-dismiss; substituiu todos os `alert()`
- [x] **Modal de confirmação** (`ui/ConfirmDialog.tsx`) tipado como `confirm({...}): Promise<boolean>`; substituiu todos os `window.confirm()`
- [x] **Engine de validação** (`lib/validation.ts`) com 10 regras: sem início/fim, tarefa sem nome, órfão, início sem saída, fim sem entrada, gateway com menos de 2 saídas, exclusivo sem (ou com múltiplos) "else", responsável incompleto, botões sem nome, botões com id duplicado
- [x] **Badge de diagnóstico na navbar** (`DiagnosticsBadge.tsx`) verde/amarelo/vermelho com contador; clicar em um issue **leva ao elemento** (troca pra view Fluxo + select + scrollToElement)
- [x] **Atalhos de teclado** (`useKeyboardShortcuts.ts`): Ctrl/Cmd+S exporta `.bpmn`, Ctrl+Shift+S salva PNG, Ctrl+O importa, Ctrl+1..4 troca de view. Ignora se foco está em input/textarea
- [x] **ErrorBoundary** (`ui/ErrorBoundary.tsx`) ao redor de PropertiesPanel, FormularioView, TarefasCamposView e ConfiguracoesView — uma exceção em um painel não derruba o app
- [x] **Cleanup**: removidos `ModeladorLegacyPage.tsx`, `FormularioPage.tsx`, `ui/Toolbar.tsx`. Rota `/modelador-legacy` e `/formulario` removidas. Sidebar enxuta (só "Modelador" — o formulário virou view interna do modelador)

**Aceite:** build limpo, dev sobe limpo, todas as funcionalidades das fases anteriores continuam funcionando, agora com feedback visual e validação ao vivo.

> Atalhos disponíveis:
> | Combinação | Ação |
> |---|---|
> | `Ctrl/Cmd + S` | Exportar fluxo (.bpmn) |
> | `Ctrl/Cmd + Shift + S` | Salvar como PNG |
> | `Ctrl/Cmd + O` | Importar fluxo |
> | `Ctrl/Cmd + 1` | View Fluxo |
> | `Ctrl/Cmd + 2` | View Formulário |
> | `Ctrl/Cmd + 3` | View Tarefas × Campos |
> | `Ctrl/Cmd + 4` | View Configurações |
> | `Ctrl/Cmd + Z / Y` | Desfazer/Refazer (nativo bpmn-js) |
> | `Del` | Remover elemento selecionado (nativo bpmn-js) |
> | `Esc` | Fechar popover/dropdown ou cancelar edição |
>
> **Regras de validação aplicadas:**
> 1. `no-start` (error) — sem evento de Início
> 2. `no-end` (warning) — sem evento de Fim
> 3. `task-name` (warning) — tarefas/eventos executáveis sem nome
> 4. `orphan` (warning) — shape sem conexões
> 5. `start-no-out` (error) — Início sem saída
> 6. `end-no-in` (warning) — Fim sem entrada
> 7. `gateway-needs-branches` (warning) — gateway condicional com menos de 2 saídas
> 8. `exclusive-no-else` / `exclusive-multi-else` — exclusivo sem ou com múltiplos "else"
> 9. `actor-missing` (warning) — UserTask com `actorType` que exige preenchimento mas sem ele
> 10. `button-name` / `button-id-dup` — botões de ação sem nome ou com id duplicado

---

## Notas de design transversais

- **Onde guardar a config dos elementos?** Tudo no XML BPMN como `extensionElements` no namespace `septem:`. Espelha as 10 tabelas do banco quando o processo for salvo no backend (Fase 6). Decisão: o XML é a verdade no front; o banco é a verdade no back.
- **Lacunas no modelo de dados da spec**: as tabelas `flows / flow_tasks / flow_elements / flow_connections / flow_execute` listadas pelo usuário não cobrem (a) botões de ação, (b) alertas de prazo, (c) visibilidade de campo por tarefa, (d) condições de gateway, (e) configs específicas de timer/marco/subprocesso/e-mail. Resolver junto com a Fase 6 (no backend). Ver § Modelo de dados pendente abaixo.
- **Stores Zustand fatiadas**: uma store por preocupação (`modelador` para UI / `process` para definição / `selection` para foco). Evita re-renders globais.
- **Componentes UI**: ainda sem shadcn/ui (Fase 1 do roadmap macro). Construir os primitives (Input, Select, Checkbox, Radio, ColorPicker) em `components/ui/` à medida que aparecem.

### Modelo de dados pendente (resolver na Fase 6, junto com o backend)

Tabelas adicionais que vão precisar existir para o modelador funcionar 100%:

- `flow_task_buttons` (botões de ação por tarefa)
- `flow_task_deadline_alerts` (cronograma de alertas)
- `flow_task_form_fields` (visibilidade campo×tarefa + fonte de dados)
- `flow_task_signatures` (campos a assinar)
- `flow_connection_conditions` (condições do gateway por conexão)
- Colunas específicas em `flow_tasks` para: timer config, marco config, subprocesso config, e-mail template

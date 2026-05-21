# Septem V2 Web — Shell de navegação (menu principal)

Guia de desenvolvimento do **shell** da aplicação: a sidebar, o menu, a sessão e o
roteamento que sustentam todas as telas. Companion de:
- `MODELADOR_PLAN.md` — o editor de processos (BPMN + form), hoje em `/admin/processos/editar`.
- `septem_v2/BACKEND_MENU.md` — o contrato de backend que troca o mock por dados reais.

> **Estado em 2026-05-20:** shell completo e navegável (build verde). Toda a árvore do
> menu existe; quase todas as telas por trás são *stubs* (`StubPage`). Preenchemos item a item.
>
> **Backend (2026-05-21):** B0 (scaffold .NET 10) concluído em `septem_v2`. O próximo passo
> que destrava a sessão real e o gating por permissão é o **B1** (multi-tenant + auth + RBAC).
> A integração frontend correspondente está em `septem_v2/BACKEND_PLAN.md` (seções IF0–IF5).

---

## 1. Princípio: menu data-driven

A navegação **não é JSX espalhado** — é uma árvore declarativa. Adicionar/remover item,
reordenar, ou mudar permissão é editar **um** arquivo de dados, não componentes.

```
src/
├── stores/
│   └── session.ts            ← sessão (MOCK): user, tenant, accessMode, can(perm)
├── layout/
│   ├── AppShell.tsx          ← Sidebar + <Outlet/> + Toaster + ConfirmDialog
│   ├── Sidebar.tsx           ← renderiza a árvore (logo, user, toggle, seções, rodapé)
│   ├── SidebarUser.tsx       ← dropdown do usuário (Meus dados / Mudar senha / Sair)
│   ├── AccessModeToggle.tsx  ← toggle Interno/Externo (só p/ isInternal)
│   └── menu/
│       ├── types.ts          ← tipos: MenuLink | MenuGroup | MenuAction, MenuLayout...
│       └── menu-config.tsx   ← ★ A ÁRVORE CANÔNICA (interno + externo)
├── pages/
│   ├── StubPage.tsx          ← placeholder "Em construção" + fase do roadmap
│   ├── processos/
│   │   └── ProcessosPage.tsx ← Admin › Processos (mínima; abre o modelador)
│   └── modelador/            ← editor existente (Fluxo/Form/Tarefas×Campos/Config)
└── router.tsx                ← rotas; toda rota é alcançável pelo menu (sem órfãs)
```

**Regra de ouro:** o backend nunca devolve "um menu". Ele devolve `perms[]` em `/api/v1/me`;
o front decide o que mostrar via `session.can(perm)`. Ver `BACKEND_MENU.md §1`.

---

## 2. Dois layouts: Interno e Externo

`menu-config.tsx` exporta `MENU: { interno, externo }`.

- **interno** — back-office completo: seções *Geral* + *Admin* (3 grupos colapsáveis:
  Processos, Relatórios e Dashboards, Configurações) + rodapé (Personificar, Suporte, Sair).
- **externo** — cidadão/requisitante, simplificado: Serviços, Minhas solicitações,
  Organograma + rodapé (Suporte, Sair).

`Sidebar` escolhe via `session.effectiveMode()`:
- usuário **interno** (`isInternal=true`) vê o toggle e pode alternar;
- usuário **externo** (auto-cadastro, `isInternal=false`) é forçado em `externo`, sem toggle.

> Semântica definida pelo cliente: um funcionário também pode ser requisitante, então
> alterna entre suas requisições internas e externas. Quem é só externo não tem a opção.

---

## 3. Sessão (mock → backend)

`src/stores/session.ts` é um store Zustand **mock**. Sua forma já espelha o backend:

```ts
SessionUser = { name, email, isInternal, perms[], hasDashboard }
Tenant      = { name, logoUrl? }
session.can(perm?)        // perms.includes('*') || perms.includes(perm)
session.effectiveMode()   // externo é forçado p/ quem não é interno
```

**Quando a Fase 2 existir** (ver `BACKEND_MENU.md §2` e §7):
1. Adicionar TanStack Query.
2. No bootstrap, chamar `GET /api/tenant/config` + `GET /api/v1/me` e popular o store
   (remover `MOCK_USER` / `MOCK_TENANT`).
3. `can()` e `effectiveMode()` **não mudam** — só a fonte dos dados.

---

## 4. Receita: transformar um stub numa tela real

Cada item do menu aponta para uma rota. Hoje a maioria é `stub(...)` em `router.tsx`.
Para implementar um item:

1. **Criar a página** em `src/pages/<area>/<Nome>Page.tsx`. Padrão de layout:
   ```tsx
   <div className="flex h-full flex-col">
     <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
       <h1 className="text-lg font-semibold text-slate-900">Título</h1>
       {/* ações: ex. botão "Novo" */}
     </header>
     <div className="flex-1 overflow-auto p-6">{/* conteúdo */}</div>
   </div>
   ```
2. **Trocar a rota** em `router.tsx`: de `stub('caminho', 'Título', ...)` para
   `{ path: 'caminho', element: <NovaPage /> }`.
3. **Dados** (Fase 2+): usar TanStack Query contra o endpoint da §6 do `BACKEND_MENU.md`
   (CRUDs) ou `BACKEND_MODELADOR.md §4` (processos/catálogo).
4. **Permissão**: o item já tem `perm` no `menu-config.tsx`; garanta que a rota também
   respeite (guard por rota entra junto com o auth da Fase 2).
5. **Reuso de UI**: `components/ui/` já tem `Popover`/`MenuItem`, `ConfirmDialog`,
   `Field`, `IconButton`, `ColorPicker`, `Toaster` (use `toast.*`).

> **Não deixar página órfã.** Toda rota nova precisa estar acessível a partir do
> `menu-config.tsx` (ou de um dropdown/botão dentro de uma tela que está no menu, como o
> modelador, aberto via Processos). Rotas só-por-URL são proibidas — use redirect se mover.

---

## 5. Status e ordem sugerida

Fase = quando o item ganha backend real (ver `septem_v2/ROADMAP.md`).

| Seção / Item | Rota | Estado hoje | Backend | Fase |
|---|---|---|---|---|
| Geral › Dashboard | `/dashboard` | stub | dashboards | 7 |
| Geral › Serviços | `/servicos` | stub | workflow (publicados) | 3/4 |
| Geral › Tarefas executadas | `/tarefas` | stub | wf instances | 4 |
| Geral › Consultas | `/consultas` | stub | reports | 7 |
| Geral › Organograma | `/organograma` | stub | org-units/tree | 2 |
| **Admin › Processos** | `/admin/processos` | **página mínima** (abre modelador) | workflow CRUD | **3** |
| Admin › Processos › *(editar)* | `/admin/processos/editar` | **modelador completo** ✅ | — | feito |
| Admin › Processos › Categorias | `/admin/processos/categorias` | stub | categories | 3 |
| Admin › Processos › Modelos de e-mails | `/admin/modelos-email` | stub | email-templates | 3/4 |
| Admin › Processos › Modelos de documentos | `/admin/modelos-doc` | stub | document-templates | 7 |
| Admin › Processos › Fontes de dados | `/admin/fontes-dados` | stub | data-sources | 3/4 |
| Admin › Relatórios › Relatórios | `/admin/relatorios` | stub | reports | 7 |
| Admin › Relatórios › Categorias | `/admin/relatorios/categorias` | stub | report-categories | 7 |
| Admin › Relatórios › Dashboards | `/admin/dashboards` | stub | dashboards | 7 |
| Admin › Config › Manuais | `/admin/manuais` | stub | manuals | 7 |
| Admin › Config › Usuários | `/admin/usuarios` | stub | users | 2 |
| Admin › Config › Unidades | `/admin/unidades` | stub | org-units | 2 |
| Admin › Config › Posições | `/admin/posicoes` | stub | positions | 2 |
| Admin › Config › Perfis de acesso | `/admin/perfis` | stub | access-profiles | 2 |
| Admin › Config › Logs | `/admin/logs` | stub | audit-logs | 2/9 |
| Conta › Meus dados / Mudar senha | `/me`, `/me/senha` | stub | me | 2 |
| Rodapé › Personificar | (ação) | toast mock | impersonate | 2 |
| Rodapé › Suporte | `/suporte` | stub | support-tickets | 7 |
| Rodapé › Sair | (ação) | toast mock | auth/logout | 2 |

**Próximos passos recomendados (item por item):**

1. **Admin › Processos (listagem real)** — é o único com backend já contratado
   (`BACKEND_MODELADOR.md`). Quando o backend existir: listar de
   `GET /workflow/process-definitions`, "Novo/Editar" → `/admin/processos/editar`.
   *Antes do backend:* dá pra fazer a lista ler do `localStorage` que o modelador já usa.
2. **Categorias de processos** — CRUD simples; bom primeiro CRUD de referência.
3. **Bloco Fase 2** (Usuários, Unidades, Posições, Perfis, Logs) — depende de iniciar o
   backend .NET (auth/tenant). É o que destrava a sessão real e o gating por permissão.

---

## 6. Convenções

- **Estilo**: Tailwind 4, paleta `slate`; ativo = `bg-slate-900 text-white`. Sidebar `w-64`.
- **Ícones**: `lucide-react` (já tem 5.8k+; confira o nome antes de usar).
- **Estado leve**: Zustand (`stores/`). Estado de servidor: TanStack Query (a partir da Fase 2).
- **Toasts**: `import { toast } from '@/stores/toast'` → `toast.success/error/info/warning`.
- **Alias**: `@/` → `src/` (configurado em `tsconfig.app.json` e `vite.config.ts`).
- **Build**: `npm run build` (tsc -b + vite). Manter sempre verde antes de commitar.

---

## 7. Referências

- Backend do menu: `septem_v2/BACKEND_MENU.md`
- Backend do modelador: `septem_v2/BACKEND_MODELADOR.md`
- Editor de processos: `MODELADOR_PLAN.md`
- Arquitetura/roadmap macro: `septem_v2/ARCHITECTURE.md`, `septem_v2/ROADMAP.md`

# septem_v2_web

Frontend headless do Septem V2. SPA React 19 + Vite + Tailwind 4, com dois editores integrados do ecossistema [bpmn.io](https://bpmn.io/):

- **Modelador** — BPMN 2.0 via [bpmn-js](https://bpmn.io/toolkit/bpmn-js/)
- **Formulário** — JSON-schema forms via [@bpmn-io/form-js](https://bpmn.io/toolkit/form-js/)

> Repo irmão (backend + docs): `septem_v2` — veja `ARCHITECTURE.md` lá para o panorama completo.

## Pré-requisitos

- Node 22+
- npm 10+ (ou pnpm/bun)

## Como rodar

```bash
npm install
npm run dev
```

Servidor sobe em `http://localhost:5173`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite dev server com HMR |
| `npm run build` | Type-check + build de produção (`dist/`) |
| `npm run preview` | Serve o build localmente |
| `npm run typecheck` | Apenas TypeScript, sem emitir |

## Estrutura

```
src/
  main.tsx              bootstrap React
  router.tsx            React Router (/, /modelador, /formulario)
  layout/               AppShell + Sidebar
  pages/                ModeladorPage + FormularioPage
  components/
    bpmn/BpmnModeler    wrapper React de bpmn-js + properties panel
    form/FormBuilder    wrapper React de @bpmn-io/form-js editor
    ui/Toolbar          botões Novo / Importar / Exportar
  assets/               diagramas e schemas iniciais (.bpmn, .json)
  lib/                  utilidades pequenas
  styles/globals.css    Tailwind + CSS dos editores
```

## Estado atual

Fase 1 do roadmap: editores funcionam **standalone** (import/export de arquivo local). Integração com backend chega na Fase 3.

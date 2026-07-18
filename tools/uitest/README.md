# Teste visual de UI (web + mobile)

Harness de testes de UI com navegador real (Chrome do sistema via `playwright-core`,
sem download de browser, sem mock). Implementa o **protocolo obrigatório** de
`septem_v2/doc/rules.md` (seção "TESTAR TODA MODIFICAÇÃO"): toda UI criada ou
alterada é exercitada em **1280×900 (web) e 375×812 (mobile)** com critérios
objetivos — sem overflow (`scrollWidth ≤ clientWidth`) e sem controle cortado
(`clipped: 0`) — além de asserções de comportamento (✓/✗ por caso, exit ≠ 0 em falha)
e screenshots para inspeção visual.

## Pré-requisitos

- Backend em `http://localhost:5000` (o proxy `/api` do Vite aponta pra lá):
  ```bash
  cd ../septem_v2
  DOTNET_ROOT=$HOME/.dotnet PATH=$HOME/.dotnet:$PATH ASPNETCORE_URLS=http://localhost:5000 \
    dotnet run --project src/Septem.Api
  ```
- Frontend: `npm run dev` (porta 5173).
- Credenciais do DevSeeder: `admin@prefeitura-x.local` / `admin123` (header `X-Tenant` já é padrão em dev).
- Dependência: `cd tools/uitest && npm install` (só `playwright-core`; usa `/usr/bin/google-chrome`).

⚠️ **Não rode `dotnet test` com a API dev no ar** (re-protege as chaves do Data
Protection e a API passa a responder 500; reiniciar a API cura). Sequência segura:
`dotnet test` → reiniciar a API → suítes de UI.

## Suítes (rodar todas como regressão ao mexer nas áreas)

| Script | Cobre |
|---|---|
| `modal-condicoes.mjs` | Modal de condições do gateway no modelador (layout web+mobile, combobox pesquisável de campos) |
| `menu-ativo.mjs` | Item ativo do menu em 13 rotas — prefixo, query string (`?scope=report`) e redirects; exige exatamente 1 ativo no grupo certo |
| `servicos-categorias.mjs` | Modal “Nova requisição” (categorias, busca, cards e abertura em nova aba) e modal CRUD de categorias de processos |
| `consultas-categorias.mjs` | Consultas agrupadas por categoria (lista própria de relatórios), filtro, cores, modal CRUD de categorias de relatórios |
| `relatorio-fluxo-completo.mjs` | Fluxo real ponta-a-ponta: criar relatório pela UI escolhendo categoria → publicar → conferir card/cor em Consultas → limpar |

```bash
cd tools/uitest && npm install
node menu-ativo.mjs && node servicos-categorias.mjs && node consultas-categorias.mjs \
  && node relatorio-fluxo-completo.mjs && node modal-condicoes.mjs
```

Cada suíte imprime `✓/✗` por caso e termina com `PASSOU`/`FALHOU: N caso(s)`
(exit code ≠ 0 em falha) — dá pra usar em CI. Screenshots saem no diretório
corrente (ou `OUT_DIR`).

## Fixture

`fixtures/teste_condicoes.bpmn` — processo `teste_condicoes_ui` (formulário com
nome/cpf/valor/saldo_empenho/descricao, tarefa 005 com botão "Enviar requisição",
gateway condicional com 2 regras na conexão para a 006). Recriar no banco de dev:

```bash
TOKEN=$(curl -s http://localhost:5000/api/v1/auth/login -H "Content-Type: application/json" \
  -H "X-Tenant: prefeitura-x" -d '{"email":"admin@prefeitura-x.local","password":"admin123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
python3 -c "import json;json.dump({'key':'teste_condicoes_ui','bpmnXml':open('fixtures/teste_condicoes.bpmn').read()},open('/tmp/req.json','w'))"
curl -s http://localhost:5000/api/v1/workflow/process-definitions/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant: prefeitura-x" -d @/tmp/req.json
```

As suítes de categorias criam e removem seus próprios dados (idempotentes);
`servicos-categorias`/`consultas-categorias` esperam a categoria "Pagamentos"
(processos) e "Financeiro" (relatórios) com um item publicado em cada — criáveis
via API como no exemplo acima (`/api/v1/categories`, `/api/v1/report-categories`,
`/api/v1/reports`).

## Padrão para novos testes

Copie uma suíte existente e mantenha SEMPRE:
1. login real + fluxo do usuário (clicar/digitar/salvar, não só renderizar);
2. viewport 1280 **e** 375 (para modais: abrir em 1280 e `setViewportSize(375)`);
3. `check()` objetivo por caso + diagnóstico de overflow/`clipped`;
4. screenshots dos dois tamanhos;
5. dados de teste idempotentes (criar e limpar no próprio script).

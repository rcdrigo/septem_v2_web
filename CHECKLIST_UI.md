# Checklist de testes da UI (integrada com o backend)

Telas integradas ponta a ponta. **Ambiente:** `https://rcdrigo.github.io/septem_v2_web/`
· tenant `prefeitura-x` · login `admin@prefeitura-x.local` / *(senha do `Seed__AdminPassword`)*.

> **Antes de começar:** abra com **Ctrl+Shift+R** (hard reload) pra pegar o bundle novo.
> A 1ª ação pode levar ~50s (cold start do Render). Faça na ordem — um passo alimenta o próximo.

> 🆕 **Novidades desta rodada** estão marcadas com 🆕.

---

## 1. Sessão & conta
- [ ] **Login** com as credenciais acima → entra no back-office.
- [ ] **Login inválido** (senha errada) → erro, não entra.
- [ ] **Meus dados** (`/me`): nome, e-mail, tipo, perfis, nº de permissões.
- [ ] **Trocar senha** (`/me/senha`) → relogar com a nova funciona.
- [ ] **Logout** → volta ao login.

## 2. Unidades (`/admin/unidades`)
- [ ] Criar **unidade raiz** (ex.: "Secretaria de Obras").
- [ ] Criar **subunidade** dentro dela.
- [ ] Editar nome; tentar **excluir** unidade com filho/posição → bloqueado.

## 3. Posições (`/admin/posicoes`)
- [ ] Selecionar a unidade → criar **posição** (ex.: "Fiscal").
- [ ] Editar e excluir uma posição sem vínculo.

## 4. Usuários (`/admin/usuarios`) 🆕
- [ ] **Criar usuário** com nome, e-mail **+ CPF, RG, matrícula, telefone, cargo** → mostra a senha inicial.
- [ ] **Editar** o usuário: confirmar que os campos cadastrais (CPF etc.) **persistiram**.
- [ ] 🆕 Na edição, seção **"Unidades e posições"**: escolher uma **unidade** → uma **posição** → **Adicionar**; ela aparece na lista. Salvar.
- [ ] Reabrir o usuário → a posição atribuída continua lá.
- [ ] Buscar por nome/e-mail; **desativar** (some dos ativos).

## 5. Perfis (`/admin/perfis`)
- [ ] Criar perfil marcando permissões na matriz; editar.
- [ ] Tentar **excluir** o perfil **Administrador** (sistema) → bloqueado.

## 6. Logs (`/admin/logs`)
- [ ] Ver registros das ações acima; filtrar por ação/entidade/período.

## 7. Organograma (`/organograma`)
- [ ] Ver a árvore com as unidades/posições criadas.

## 8. Fontes de dados — Processos (`/admin/fontes-dados`) 🆕
- [ ] 🆕 O cabeçalho mostra **"Fontes de dados · Processos"** (sem botão "Conexões").
- [ ] Criar fonte **Fixa** com alguns itens (valor/texto).
- [ ] 🆕 **Ordenar** os itens: botões **↑/↓** por linha, **"por valor"** e **"por texto"** → a ordem muda. Salvar e reabrir → ordem mantida.
- [ ] Criar fonte **SQL** (`SELECT 1 AS value, 'um' AS label`) → **Testar** retorna a linha (roda no banco do tenant).
- [ ] Fonte SQL de escrita (`DELETE ...`) → **Testar** é **barrado**.
- [ ] Editar e excluir uma fonte.

## 9. Fontes de dados — Relatórios (`/admin/relatorios` → Fontes de dados) 🆕
- [ ] 🆕 Abrir por **Relatórios e Dashboards → Fontes de dados** → cabeçalho mostra **"· Relatórios"**.
- [ ] Criar uma fonte aqui → ela **NÃO** aparece na lista de Processos (e vice-versa). ✅ escopos separados.

## 10. Modelos de e-mail (`/admin/modelos-email`)
- [ ] Criar template com assunto/corpo usando placeholders (`{{requisitante.nome}}`).
- [ ] Adicionar destinatário (tipo `requester`); usar **Preview**.

## 11. Modelador / Formulário do processo (`/admin/processos`) 🆕
- [ ] 🆕 Confirmar que **não existe mais** o item "Formulários" no menu (forms vivem no processo).
- [ ] Criar **processo**: início → tarefa → fim.
- [ ] Aba **Formulário**: adicionar grupo + campos (ex.: `assunto` texto, `valor` número, `decisao` select com opções).
- [ ] 🆕 Aba Formulário → botão **"Máscaras"** abre o gestor de máscaras (criar uma regex + testar).
- [ ] Na tarefa: configurar **botões** ("Aprovar"/"Reprovar") e **ator** (área + posição).
- [ ] **Salvar** rascunho (aviso "alterações pendentes" some) → **Publicar**.
- [ ] 🆕 **Editar o processo já publicado** e **Salvar** → toast diz **"Rascunho salvo v2"** (cria rascunho à parte, **sem erro/sem 409**). A versão publicada continua valendo.
- [ ] 🆕 **Publicar** de novo → o rascunho v2 vira a versão publicada.
- [ ] Para a execução, publique 3 variações: **simples**, **gateway por valor**, **paralelo (join)**.

## 12. Serviços → iniciar em nova aba (`/servicos`) 🆕
- [ ] O processo publicado aparece no catálogo.
- [ ] 🆕 **Iniciar** → abre uma **NOVA ABA** só com o formulário (sem menus laterais).
- [ ] 🆕 O formulário é renderizado com **campos nativos** (não o form-js); validação de obrigatório funciona.
- [ ] Preencher → **Iniciar** → tela **"Solicitação iniciada!"**; fechar a aba.

## 13. Tarefas (`/tarefas`)
- [ ] A tarefa pendente aparece para o ator correto.
- [ ] Abrir → preencher → **Concluir** por um botão → instância avança/encerra.
- [ ] **Gateway por valor**: iniciar com `valor>=100` cria a tarefa; valor baixo encerra direto.
- [ ] **Join paralelo**: concluir 1 ramo não libera; concluir o 2º libera a tarefa final (uma vez).

## 14. Consultas (`/consultas`)
- [ ] Lista as instâncias com status e nº de pendentes.
- [ ] Filtrar por processo/status/"apenas as que iniciei".
- [ ] Abrir o **detalhe** (Ver): dados do formulário + histórico de tarefas.

---

### Observações
- **Tenant fixo** `prefeitura-x` (Pages é host único).
- **Evento de e-mail**: dispara mas **não envia** — registra no **log do Render** (sem SMTP).
- **Scripts de formulário**: a entrada saiu junto com a página de Formulários (o form do
  processo é embutido e não tem id próprio para scripts) — fora de escopo nesta rodada.

# Checklist de testes da UI (integrada com o backend)

Só telas **integradas ponta a ponta** (UI ↔ API). Telas ainda *stub* (Dashboard,
Relatórios, Categorias, Modelos de documento, Manuais, Suporte) ficam de fora.

**Ambiente:** `https://rcdrigo.github.io/septem_v2_web/` · tenant `prefeitura-x`
**Login:** `admin@prefeitura-x.local` / *(senha do `Seed__AdminPassword`)*

> Dica: a 1ª chamada após ~15 min pode demorar ~50s (cold start do Render). Depois fica rápido.
> Faça na ordem — um passo alimenta o próximo (ex.: criar unidade → posição → usuário → form → processo → executar).

---

## 1. Sessão & conta
- [ ] **Branding** carrega (nome do ambiente + cor primária) já na tela de login.
- [ ] **Login** com as credenciais acima → entra no back-office.
- [ ] **Login inválido** (senha errada) → mensagem de erro, não entra.
- [ ] **Meus dados** (`/me`): mostra nome, e-mail, tipo (interno), perfis e nº de permissões.
- [ ] **Trocar senha** (`/me/senha`): troca com a senha atual correta → relogar com a nova funciona.
- [ ] **Logout** → volta ao login; rota protegida não abre mais.

## 2. Configurações › Unidades (`/admin/unidades`)
- [ ] Listar a árvore de unidades.
- [ ] Criar **unidade raiz** (ex.: nome "Secretaria de Obras").
- [ ] Criar **subunidade** dentro dela.
- [ ] Editar o nome de uma unidade.
- [ ] Tentar **excluir** unidade com subunidade/posição → bloqueado.

## 3. Configurações › Posições (`/admin/posicoes`)
- [ ] Selecionar a unidade → criar **posição** (ex.: "Fiscal").
- [ ] Editar o nome da posição.
- [ ] Excluir uma posição sem vínculo.

## 4. Configurações › Usuários (`/admin/usuarios`)
- [ ] Criar **usuário** (ex.: "Fulano") → sistema mostra a **senha inicial gerada**.
- [ ] Editar: atribuir **perfil de acesso** e **posição** (vincular à posição criada acima).
- [ ] Buscar por nome/e-mail e filtrar por status.
- [ ] **Desativar** o usuário (some dos ativos).
- [ ] (Opcional) Logar com o Fulano numa aba anônima → confirma que a conta funciona.

## 5. Configurações › Perfis (`/admin/perfis`)
- [ ] Listar perfis (com contagem de usuários).
- [ ] Criar **perfil** novo marcando permissões na matriz (ex.: só `workflow:read`).
- [ ] Editar a matriz de um perfil.
- [ ] Tentar **excluir** o perfil **Administrador** (sistema) → bloqueado.

## 6. Configurações › Logs (`/admin/logs`)
- [ ] Abrir os logs e ver os registros das ações acima (create/update/delete).
- [ ] Filtrar por **ação**, **tipo de entidade** e **período**.

## 7. Organograma (`/organograma`)
- [ ] Abrir e ver a árvore organizacional (as unidades/posições criadas aparecem).

## 8. Fontes de dados (`/admin/fontes-dados`)
- [ ] Criar fonte **Fixa** (array JSON) → **Testar** mostra a tabela de resultado.
- [ ] Criar fonte **SQL** (um `SELECT` simples) → **Testar** retorna linhas.
- [ ] Confirmar **sandbox**: comando de escrita (INSERT/UPDATE) é **barrado**.
- [ ] Editar e excluir uma fonte.
- [ ] (Opcional) Criar uma **conexão externa** e usá-la numa fonte SQL.

## 9. Modelos de e-mail (`/admin/modelos-email`)
- [ ] Criar template com **assunto e corpo** usando placeholders (ex.: `Olá {{requisitante.nome}}`, `{{formulario.assunto}}`).
- [ ] Adicionar **destinatário** (ex.: tipo `requester` em "Para").
- [ ] Usar o **Preview** com valores fictícios → placeholders resolvidos.
- [ ] Editar e excluir um template.

## 10. Formulários (`/admin/formularios`)
- [ ] Criar **formulário** com um grupo e campos (ex.: `assunto` texto, `valor` número, `decisao` select). Anote as **keys**.
- [ ] Ver o **preview ao vivo** refletindo os campos.
- [ ] Configurar opções avançadas de um campo (obrigatório, help-text, máscara).
- [ ] **Máscaras**: criar uma máscara (regex) e testá-la ao vivo.
- [ ] **Scripts**: criar um script, ver o **lint ao vivo**, salvar revisão e fazer **rollback**.
- [ ] **Testes de script**: criar teste (input/expected), rodar; confirmar que **publicar** bloqueia se algum teste falha.

## 11. Processos › Modelador (`/admin/processos`)
- [ ] Listar processos (`/admin/processos`).
- [ ] Criar **processo** no modelador: início → tarefa → fim.
- [ ] Vincular o **formulário** do passo 10.
- [ ] Configurar **botões de ação** na tarefa (ex.: "Aprovar"/"Reprovar").
- [ ] Configurar o **ator** da tarefa (área + posição).
- [ ] **Salvar rascunho** → aviso de "alterações pendentes" some após salvar.
- [ ] **Versionar processo** → a versão sobe.
- [ ] **Validação/lint**: um diagrama quebrado retorna issues e não publica.
- [ ] **Publicar** (status → published) → aparece na lista com status correto.

> Para a execução, crie e **publique** 3 variações: **simples** (início→tarefa→fim),
> **gateway** (rota por valor do form), **paralelo** (2 ramos → join → tarefa final).

## 12. Execução › Serviços (`/servicos`)
- [ ] O processo publicado aparece no catálogo.
- [ ] **Iniciar**: preencher o formulário inicial → inicia a instância.

## 13. Execução › Tarefas (`/tarefas`)
- [ ] A tarefa pendente aparece (para o ator correto).
- [ ] **Abrir** a tarefa: form carrega com os dados + botões.
- [ ] **Concluir** por um botão → a instância avança/encerra.
- [ ] **Gateway por valor**: iniciar com `valor>=100` cria a tarefa; com valor baixo, encerra direto.
- [ ] **Join paralelo**: concluir só 1 ramo não libera; concluir o 2º libera a tarefa final (uma vez).

## 14. Execução › Consultas (`/consultas`)
- [ ] Lista as instâncias com status e nº de tarefas pendentes.
- [ ] Filtrar por **processo (busca)**, **status** e **"apenas as que iniciei"**.
- [ ] Abrir o **detalhe** (Ver): dados do formulário + **histórico de tarefas**.

## 15. Permissões (amostragem)
- [ ] Com um usuário **sem** `workflow:read`, Serviços/Tarefas/Consultas ficam indisponíveis.
- [ ] Toda ação relevante (create/update/delete/publish) **aparece nos Logs**.

---

### Observações do ambiente publicado
- **Tenant fixo** `prefeitura-x` (GitHub Pages é host único).
- **Evento de e-mail**: o disparo funciona, mas **não envia** de verdade — o `LoggingEmailSender`
  registra destinatário/assunto/corpo no **log do Render** (não há SMTP neste ambiente provisório).
- **Scripts de formulário** rodam no **navegador** (Web Worker), isolados.

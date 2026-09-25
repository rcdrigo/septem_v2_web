---
target: "/requests/:instanceId"
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/vinicius/Documents/Dev/septem_v2_web/src/pages/SolicitacaoPage.tsx"
target_fingerprint: "sha256:64aa3cd670cab2dab0d3c689a160fa47aef05d18e220e4ae7934f66476c452d2"
target_path: /Users/vinicius/Documents/Dev/septem_v2_web/src/pages/SolicitacaoPage.tsx
timestamp: 2026-09-24T10-21-00Z
slug: src-pages-solicitacaopage-tsx
---
Method: dual-agent (A: /root/design_review · B: /root/detector_review)

**A página informa o andamento, mas ainda não orienta o autoatendimento.** O maior ganho em `/requests/:instanceId` é responder imediatamente: “preciso agir ou aguardar?”

Avaliação dos componentes reais com dados fictícios, em desktop e celular; não valida o backend nem todas as combinações de permissões e formulários. Nenhuma interface foi alterada.

**Especificidade do design:** visual coerente, porém próximo de um relatório administrativo genérico. Tarefa, responsável e prazo são específicos do Septem; a hierarquia ainda privilegia consulta e manutenção, em vez do próximo passo do usuário.

**Saúde da experiência: 19/40 — fraca.** São 3 prioridades P1 e 2 P2; nenhuma P0 nesta crítica de experiência.

| Heurística | Nota /4 | Principal observação |
|---|---:|---|
| Visibilidade do estado | 2 | Mostra andamento, mas não explicita agir versus aguardar |
| Linguagem do usuário | 2 | Mistura processo, requisição, solicitação e Inbox |
| Controle e liberdade | 2 | Cancelar existe; falta retorno contextual na página isolada |
| Consistência | 2 | Menu próprio e cores diferentes para a tarefa ativa |
| Prevenção de erros | 3 | Validação e bloqueio de envio vazio; confirmação tem falha de integração |
| Reconhecimento | 2 | Próxima ação depende de interpretação |
| Eficiência | 2 | Tarefa atual não oferece acesso direto à execução |
| Minimalismo | 2 | Repetições, ferramentas concorrentes e resumo vazio |
| Recuperação de erros | 1 | Erros sem recuperação e falha de mensagens tratada como vazio |
| Ajuda contextual | 1 | Não explica a ação esperada nem quando aguardar |
| **Total** | **19/40** | **Fraca** |

**O que funciona**

- Número, serviço e status juntos ajudam a confirmar qual requisição está aberta.
- Tarefa atual, responsável e prazo formam um grupo útil; a tramitação preserva contexto e autoria.
- Edição e mensagens já têm validação, estados de envio e controles de cancelamento que podem sustentar uma experiência mais confiável.

**Prioridades, em etapas**

1. **[P1] Dar uma resposta explícita sobre o próximo passo.** O cartão “Tarefa atual” apresenta nome, responsável e datas, sem orientar quem pode executar ou quem deve aguardar. Antes dele, até cinco ferramentas disputam atenção. Colocar no topo uma orientação por perfil e estado: ação autorizada, como “Abrir tarefa”, ou informação de espera, como “Aguardando análise; nenhuma ação necessária agora”. Não deduzir permissão apenas do nome do responsável. Referência: `src/pages/InstanciasPage.tsx:169` e `:257`. Comando: `$impeccable clarify`.

2. **[P1] Restaurar confiança nas ações e nos erros.** Esta rota não monta Toaster nem ConfirmDialogHost, embora salvar e excluir dependam deles. O resultado pode não aparecer, e a confirmação de exclusão não ser exibida. Mensagens também não distinguem falha de carregamento de conversa vazia; o erro geral sugere falta de permissão sem oferecer nova tentativa. Montar os componentes necessários, mostrar falhas no contexto e oferecer recuperação. Referências: `src/pages/SolicitacaoPage.tsx:33`, `src/pages/InstanciasPage.tsx:142`, `:153` e `src/components/execution/ProcessMessages.tsx:94`. Comando: `$impeccable harden`.

3. **[P1] Tornar o detalhe utilizável no celular.** Em 390px, o histórico apresentou rolagem horizontal e o botão “Ver histórico de alterações” ficou cortado. Duas camadas de padding e a barra de ferramentas reduzem o espaço para o conteúdo. Empilhar título e ação do histórico, permitir quebra de texto e reduzir margens internas nas telas estreitas. Referências: `src/pages/SolicitacaoPage.tsx:47` e `src/pages/InstanciasPage.tsx:357`. Comando: `$impeccable adapt`.

4. **[P2] Remover linguagem de configuração e repetição.** “Inbox da requisição / Sem resumo configurado” ocupa um cartão sem ajudar o solicitante. Serviço, número e responsável aparecem repetidos. Usar “Requisição” para a execução individual, conforme CONTEXT.md; nomear o resumo por sua finalidade e omitir o cartão vazio. Referência: `src/pages/InstanciasPage.tsx:246`. Comandos: `$impeccable clarify` e `$impeccable distill`.

5. **[P2] Completar a navegação acessível.** O menu “Ações” não informa seu estado expandido nem implementa localmente Escape e gestão de foco; títulos importantes são parágrafos. Usar componente acessível compartilhado, títulos semânticos e verificar o fluxo por teclado. Referência: `src/pages/InstanciasPage.tsx:190`. Comando: `$impeccable harden`.

**Carga cognitiva e confiança:** a organização em grupos ajuda, mas ferramentas com peso semelhante, dados repetidos e ausência de orientação exigem interpretação. A pessoa reconhece a requisição ao entrar; a dúvida aparece quando precisa decidir o que fazer. O fim da interação precisa confirmar resultado e próximo passo de forma visível.

**Impacto por público**

- Solicitante externo: pode confundir uma tarefa do analista com uma pendência própria.
- Operador interno: encontra o responsável, mas precisa procurar onde executar a tarefa.
- Usuário no celular ou por teclado: enfrenta conteúdo cortado ou controles com comportamento incompleto.

**Observações menores:** datas e prazos têm pouco destaque; verde no resumo e âmbar na tramitação representam a tarefa ativa de formas diferentes; o editor de mensagens poderia explicitar quem verá o conteúdo.

**Detector:** 2 alertas `gray-on-color` em `src/components/form/ReactForm.tsx:743` e `:1155`. Ambos são falsos positivos: o hover altera também a cor do texto. Os problemas relevantes vieram da inspeção visual e do código. Não foi possível produzir overlay: a avaliação do navegador é somente leitura.

**Decisões para a próxima etapa**

1. O cartão da tarefa deve oferecer **acesso direto à execução quando autorizado** ou **orientação de acompanhamento com indicação de onde executar**?
2. Seguindo seu pedido de trabalhar por etapas, começar por **confiabilidade das ações e erros** ou por **clareza do próximo passo**?

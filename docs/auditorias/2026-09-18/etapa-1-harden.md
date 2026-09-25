# Etapa 1 — harden

Correções dos achados 1, 2, 3, 5 e 7 da auditoria inicial:

- Login monta notificações; Solicitar acesso apresenta a orientação já prevista.
- Consultar processo abre escolha entre acompanhamento autenticado das próprias requisições e validação pública de documentos. O acompanhamento conserva o destino após login.
- Dialog e ConfirmDialog usam a primitiva modal do Base UI, já instalada, para semântica, foco contido, Escape e retorno ao disparador.
- Confirmação inicia no botão Cancelar. Enter aciona exclusivamente o controle focado.
- Esqueci minha senha usa slate-600 no estado normal e indicador de foco explícito.

Validação: build/TypeScript aprovado; `node tools/uitest/dialog-hardening.mjs` aprovado em Chrome headless (Cancelar/Confirmar com Enter, Escape, foco inicial, ciclo Tab/Shift+Tab e retorno). Login e modal inspecionados no navegador integrado em desktop e viewport de 320 × 900. Notificação visível e navegação para Validar documento confirmadas.

Não foram executadas autenticação real, redefinição de senha ou consulta de documento no backend. A rota de validação exibiu indisponibilidade da consulta no ambiente local. Uso de controles com portais próprios dentro de modais requer regressão nas respectivas jornadas autenticadas.

Próxima etapa: adapt, cobrindo sidebar móvel e largura das notificações. Recuperação de carregamento, tematização e divisão de bundle permanecem nas etapas seguintes; a nota original não foi recalculada.

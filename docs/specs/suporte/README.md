# Specs de desenvolvimento — Suporte

Status: especificação para desenvolvimento; implementação não realizada.

Origem: [requisitos discutidos com o usuário](../../requisitos-suporte.md). Vocabulário: [CONTEXT.md](../../../CONTEXT.md).

## Documentos

1. [Domínio, regras e permissões](01-dominio.md)
2. [Dados, API e processamento](02-contratos.md)
3. [Interface, entregas e critérios de aceite](03-entregas-e-aceite.md)

As regras de negócio confirmadas são normativas. Nomes de entidades, endpoints, limites de texto e estratégias técnicas são propostas de implementação deste pacote, não contratos existentes no backend. Ajustes técnicos devem preservar os comportamentos e critérios de aceite.

## Escopo

Abertura e histórico dos próprios chamados; triagem central da Septem; atendimento por equipes do cliente ou da Septem; tarefas simultâneas; conversa pública e notas internas; anexos; propostas e validação da solução; apontamento de horas; prioridade e prazo previsto; cancelamento e reabertura; notificações no sistema e por e-mail.

Fora do escopo: cálculo monetário, emissão de cobrança, SLA contratual automático e execução de deploy pelo módulo. “Implementação” representa trabalho da equipe, não uma integração automática com infraestrutura. Exportação de horas é uma extensão possível, não requisito confirmado.

## Integração conhecida

- Frontend React/TypeScript com React Router, React Query e Zustand, conforme `package.json`.
- Suporte já possui entrada de menu e rota placeholder em `src/layout/menu/menu-config.tsx` e `src/router.tsx`.
- `src/stores/session.ts` contém identidade, tenant, perfis e permissões. `isInternal` não identifica sozinho um funcionário da Septem nem concede acesso entre clientes.
- `src/lib/upload.ts` oferece upload específico de workflow e download autenticado. Não reutilizar o contrato de upload exigindo processo/tarefa de workflow fictícios.
- Contratos e persistência do backend de suporte ainda precisam ser implementados/verificados no repositório correspondente. Estas specs não presumem endpoints existentes.

## Interpretações explicitadas

Para tornar os fluxos implementáveis, este pacote propõe:

- Resposta pública do requisitante, inclusive envio apenas de anexo, em Resolvido/Encerrado reabre em Em análise. Edição de conteúdo anterior não reabre.
- Cancelamento interrompe o trabalho imediatamente; participantes podem regularizar apontamentos de trabalho anterior ao cancelamento sem reabrir tarefas.
- A organização de autoria limita notas internas, mas não concede acesso ao chamado por si só. Equipes anteriores perdem acesso quando não possuem outro papel autorizado.
- Aprovações bloqueiam as tarefas explicitamente abrangidas, incluindo início e conclusão; uma solicitação pendente não é dispensada silenciosamente. A dispensa de proposta ocorre antes de submetê-la. Essa leitura segue a última resposta: “aguardar aprovação”.
- Uma tarefa de triagem marcada como resolução do chamado torna suas horas cobráveis; demais tarefas de triagem continuam não cobráveis. Guardar essa classificação e sua justificativa no registro.

Essas interpretações devem ser mantidas visíveis na revisão de desenvolvimento. A representação da identidade central da Septem e de sua relação com tenants é uma dependência técnica a resolver no backend antes de liberar acesso entre empresas.

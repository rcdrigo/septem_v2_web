# Produto — Septem

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

As decisões de produto priorizam usuários internos e solicitantes externos.

- Usuários internos executam tarefas, analisam informações e acompanham requisições no atendimento diário.
- Solicitantes externos encontram serviços, enviam solicitações, respondem pendências e acompanham seu andamento.
- Administradores configuram processos, formulários, acessos e o ambiente que sustenta essas jornadas.

## Product Purpose

O Septem conecta a configuração de serviços e processos à execução de tarefas e ao acompanhamento de requisições. Deve funcionar como um ambiente de autoatendimento: os usuários precisam compreender o que fazer e como fazê-lo sem depender de orientação externa para as atividades previstas.

O sucesso da experiência é permitir que usuários internos e solicitantes externos reconheçam sua situação, identifiquem a próxima ação e concluam seu trabalho com clareza.

## Operating Context

Administradores configuram e publicam processos e formulários. Solicitantes iniciam requisições; o fluxo distribui tarefas aos responsáveis, inclusive ao solicitante quando há pendências. Os participantes acompanham o andamento e os resultados conforme suas permissões.

Os manuais em `docs/manuais-tecnicos/` descrevem as jornadas e as regras operacionais. Capacidades documentadas podem estar em implementação; confirmar a disponibilidade no código antes de apresentá-las como entregues.

## Capabilities and Constraints

- Preservar permissões por perfil e regras de acesso específicas de cada recurso.
- Preservar a separação entre clientes e ambientes e o versionamento com atualização explícita.
- Usar a terminologia de `CONTEXT.md` como autoridade para os conceitos do domínio, incluindo processo, serviço, requisição, tarefa e ambiente.
- Consultar `docs/adr/0001-hospedagem-central-banco-por-ambiente.md` para isolamento de dados e hospedagem, e `docs/adr/0002-processos-personalizaveis-com-atualizacao-explicita.md` para personalização, atualização e continuidade das execuções.

## Brand Commitments

Preservar o nome Septem e respeitar o nome configurado para cada ambiente. A comunicação deve explicar ações, estados e resultados em linguagem compreensível para quem executa o trabalho.

## Evidence on Hand

- `CONTEXT.md`: vocabulário do domínio.
- `docs/manuais-tecnicos/visao-geral-plataforma.md`: públicos e jornadas documentadas.
- `docs/manuais-tecnicos/`: orientações operacionais por funcionalidade.
- `docs/adr/` e `docs/specs/`: decisões e requisitos, distinguindo intenção de produto de funcionalidade já disponível.

## Product Principles

1. **Autoatendimento:** orientar a pessoa no próprio fluxo, deixando claros os requisitos, a ação esperada e como realizá-la.
2. **Prioridade ao trabalho diário:** avaliar decisões pelo impacto nas jornadas de usuários internos e solicitantes externos.
3. **Próximo passo compreensível:** comunicar o estado atual, o resultado de cada ação e o que precisa acontecer em seguida, inclusive quando a pessoa deve aguardar.
4. **Recuperação orientada:** explicar pendências e erros com instruções concretas para resolvê-los, preservando o trabalho já realizado quando possível.
5. **Continuidade e confiança:** respeitar permissões, isolamento de ambientes e versões ao simplificar a experiência.

## Open Decisions

Padrões específicos de acessibilidade e métricas quantitativas de sucesso ainda não foram definidos. Diferenciais comerciais exclusivos também não foram estabelecidos; autoatendimento é um compromisso do produto, sem alegação de exclusividade de mercado.

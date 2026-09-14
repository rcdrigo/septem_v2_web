# Specs de desenvolvimento — Administração da plataforma

Status: especificação para desenvolvimento; implementação não realizada.

Origem: [requisitos consolidados](../../requisitos-administracao.md). Vocabulário: [CONTEXT.md](../../../CONTEXT.md). Decisões: [hospedagem central](../../adr/0001-hospedagem-central-banco-por-ambiente.md) e [processos personalizáveis](../../adr/0002-processos-personalizaveis-com-atualizacao-explicita.md).

## Documentos

1. [Domínio, regras e permissões](01-dominio.md)
2. [Dados, contratos e processamento](02-contratos.md)
3. [Interface, entregas e critérios de aceite](03-entregas-e-aceite.md)

As regras confirmadas são normativas. Entidades, estados técnicos, endpoints, concorrência e estratégias de execução descritos nestas specs são propostas de implementação, não APIs já existentes. Ajustá-los às convenções do backend preservando os critérios de aceite.

## Escopo e limites

Administração central por super admins; clientes e ambientes; provisionamento e domínios; funcionalidades contratadas; catálogo de processos; personalização e atualização opcional; promoção e sincronização; credenciais; bloqueio de novas solicitações e inativação completa.

Ficam fora: instalações nos servidores dos clientes, exclusão definitiva de ambientes, conversão de homologação em produção, migração de execuções de processos em andamento e implementação de novas capacidades comerciais apenas por cadastrá-las no catálogo. Os exemplos de funcionalidades não são uma promessa de implementar todos os produtos nesta entrega.

## Integração e decisões técnicas de execução

O frontend usa React/TypeScript, React Router, React Query e Zustand, conforme `package.json`. Este pacote abrange também backend e operação: uma tela com mocks não conclui o provisionamento. A aplicação será compartilhada e cada ambiente terá um banco; cliente e ambiente precisam de identidades distintas.

Antes de E1, verificar no backend os contratos atuais de tenant, identidade, persistência e versionamento de processos. Mapear tenant para ambiente, sem presumir que tenant equivale a cliente. Antes de E2, configurar provedor de infraestrutura, domínio base, emissão de certificados, envio de e-mail e armazenamento de segredos. Essas são dependências técnicas da implantação, sem reabrir as decisões de negócio.

Interpretações técnicas propostas para tornar os fluxos executáveis:

- Permissão de editar credenciais é uma política por ambiente. O vínculo de admin ao cliente concede alcance sobre todos os ambientes, mas não permissões centrais.
- Convite criado e disponível compõe a prontidão; falha na entrega de e-mail gera pendência de reenvio, sem recriar ou invalidar o ambiente pronto.
- Transferências não atravessam clientes. Conflitos de conteúdo aceitos pelo usuário não dispensam validação estrutural, autorização ou checagem de versão concorrente.
- Inativação impede novas ações imediatamente no servidor; ações externas já enviadas não podem ser desfeitas pela troca de estado. Registrar seu resultado antes de pausar o próximo passo.
- A documentação detalha comportamento-alvo; capacidade existente deve ser verificada durante cada entrega, sem presumir implementado o que consta apenas nos requisitos.

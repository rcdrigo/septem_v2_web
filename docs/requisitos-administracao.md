# Administração de clientes e ambientes

Definição em andamento. As decisões abaixo foram confirmadas na entrevista; as questões abertas ainda não autorizam escolhas de implementação.

## Decisões confirmadas

- Um cliente pode possuir vários ambientes, com URL, dados, módulos e configuração próprios. Os termos estão definidos no glossário em `../CONTEXT.md`.
- O cadastro informa cliente, nome do ambiente (Septem por padrão), URL, logo, nome da base com sugestão padrão, módulos/serviços e opção de dados fictícios.
- Os módulos/serviços contratados podem ser alterados futuramente.
- A área administrativa da plataforma é exclusiva da equipe interna. Super admins têm acesso a tudo; admins têm acesso apenas ao cliente. O alcance operacional desses papéis ainda será detalhado.
- Um ambiente está pronto para uso quando a URL funciona com HTTPS, a base está preparada, a identidade visual está aplicada, os módulos estão habilitados e o convite para o primeiro administrador indicado no cadastro está disponível. A criação só é concluída após verificar esses critérios.

## Questões abertas

- Vínculo e permissões dos admins internos, incluindo alcance sobre os ambientes do cliente e distinção do administrador usuário do cliente.
- Infraestrutura alvo e isolamento dos ambientes, confrontando o desenho existente do backend com sua implantação atual.
- Catálogo de módulos, dependências e efeitos de habilitar ou desabilitar serviços.
- Finalidade dos ambientes e regras para dados fictícios.
- Domínio, verificação de prontidão, falhas e retomada do provisionamento.
- Identificação e entrega do primeiro acesso administrativo.

Decisões arquiteturais serão registradas em ADRs quando os respectivos trade-offs forem resolvidos.

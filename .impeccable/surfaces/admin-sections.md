# Seções e buscas da administração

Modo: Operate. Extensão das telas administrativas existentes para configurar processos, formulários e recursos do ambiente. A estrutura segue o protótipo por seções aprovado pelo usuário.

## Direction contract

THESIS: permitir que administradores encontrem registros e reconheçam quais campos pertencem à mesma tarefa. Títulos semânticos, proximidade e separadores organizam os formulários. Instruções opcionais explicam controles específicos.

OWN-WORLD: preservar superfícies brancas e slate, bordas discretas, tipografia de sistema e ícones Lucide. `FormSection` e `CombinedSearch` reutilizam os controles existentes. Esta extensão não define uma identidade visual nem tokens globais.

STORY: localizar um registro com busca e filtros combinados, abrir sua configuração, editar as seções relevantes e salvar. Testes e prévias têm áreas próprias, distintas dos dados de configuração.

FIRST VIEWPORT: nas listagens, título e ações precedem a busca geral. Filtros por coluna podem ser recolhidos sem perder os critérios. Nos editores, o título precede as seções e seus campos. Modelos de e-mail e documento abrem em abas próprias do navegador. O editor de manuais ocupa a largura disponível.

FORM: extensão do desenho confirmado, sem sorteio de conceitos. No desktop, campos relacionados compartilham linhas quando há espaço. Em telas estreitas, campos e filtros empilham. Tabelas mantêm rolagem horizontal dentro de sua área.

FINISH: revisão funcional e visual nos recortes implementados, com evidências desktop e mobile, veredito independente e registro de limites. A entrega preserva o sistema visual existente e não adiciona imagens ao produto.

## Alcance

As seções organizam fontes de dados, modelos de e-mail e documento, usuários, manuais, relatórios e seus componentes, propriedades dos campos, configurações do processo, SMTP e automações. Os briefs `data-sources-tables.md` e `native-form-editor.md` continuam a descrever seus recortes específicos.

As buscas gerais combinam palavras por AND e se somam aos filtros por coluna. Categorias usam correspondência exata. A filtragem ocorre antes da paginação. Usuários expõem filtros nas quatro colunas. Relatórios também oferecem busca nos catálogos de campos e blocos.

A reorganização preserva os contratos de schema, API, permissões e ciclo de vida, inclusive a distinção entre salvar e publicar. As listagens afetadas atualizam os dados ao recuperar o foco após a edição em outra aba. O teste de SMTP usa a configuração candidata sem ativá-la.

## Verificação e limites

A entrega registrou aprovação de `npm run build`, dos contratos de busca e da suíte `admin-sections-search.mjs`. Também passaram as regressões de fontes SQL, API e tabela, parâmetros e SMTP, automações e formulários nativos. `npm run test:admin-sections` reúne build, contratos e a suíte administrativa.

A revisão independente retornou `SHIP`, sem achados materiais no código e nas capturas examinadas. As capturas incluem larguras de 1440 e 390 px, além dos tamanhos usados pelas regressões existentes. Não há capturas completas do formulário de usuários nem das configurações do processo. A avaliação desses recortes limita-se ao código.

Os testes de navegador usam fixtures HTTP. Eles verificam a interface e as requisições esperadas, sem certificar integração com um backend real. As evidências permanecem no [diretório externo da entrega](/Users/vinicius/.codex/visualizations/2026/10/31/01a19142-32f1-7630-be71-bb6c753aa67c/implementation-review), sem cópia de imagens para o repositório.

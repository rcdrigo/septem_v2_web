# Formulários nativos sem form-js

Para implementar a hierarquia Formulário → Aba → Agrupamento → Campo e o fluxo de criação guiada, adotamos editor, renderização e formato de definição próprios, permitindo bibliotecas auxiliares de interface, validação e reposicionamento. A decisão remove o form-js ao custo de assumir a manutenção dessas responsabilidades; componentes nativos existentes podem ser reaproveitados.

Os formulários antigos e todas as requisições serão removidos, e o ambiente começará do zero, sem compatibilidade com o formato anterior. Essa decisão substitui a exigência de continuidade dos formulários antigos presente no anexo SGI-V2-Redesenho-Formulario-Passo-a-Passo-2.md. A execução da limpeza e seu inventário de dependências ainda não foram realizados.

O anexo especifica a mudança de interação, não uma lista exaustiva de capacidades. A primeira versão preservará os tipos e capacidades atuais, incluindo validações, fontes de dados e automações, reaproveitando o runtime React e adaptando seus contratos. Elementos de apresentação serão distintos de campos que recebem respostas.

Após o reinício, alterações estruturais de formulários publicados produzirão novas versões, e requisições existentes continuarão na versão em que começaram, conforme o ADR 0002. A conversão entre Grupo Padrão e Tabela ocorrerá no rascunho e preservará os identificadores dos campos, sem converter respostas de requisições existentes.

As automações permanecem independentes da versão do formulário, em vez de serem fixadas junto à publicação estrutural. A compatibilidade será tratada inicialmente por scripts adaptáveis e verificações antes da publicação, mantendo sessões abertas com o código já carregado. Isso permite publicar automações separadamente, ao custo de considerar versões de formulário em uso ao editar e testar os scripts.

Scripts mantêm a capacidade de alterar a estrutura em execução e têm prioridade sobre a configuração inicial dos campos na tarefa, inclusive permitindo salvar alterações de campos inicialmente somente leitura. A autorização de acesso à requisição e de execução da tarefa continua no servidor. Campos criados apenas por script não têm respostas persistidas; novas linhas de tabelas existentes podem ser persistidas quando utilizam os campos definidos nas colunas.

Desenho confirmado pelo usuário em 18/09/2026. As regras acordadas estão em [Formulários nativos](../specs/formularios-nativos.md), com [requisitos de desenvolvimento por etapas](../specs/formularios-nativos-etapas.md). A confirmação encerra a entrevista; implementação e exclusões ainda não foram executadas.

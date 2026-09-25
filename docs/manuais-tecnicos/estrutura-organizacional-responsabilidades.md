# Estrutura organizacional e distribuição de responsabilidades

## Objetivo deste manual

Este manual explica como representar a estrutura do órgão, cadastrar unidades e posições, definir titular e preposto e conferir os vínculos no organograma. Essas informações são usadas na distribuição de tarefas, nos responsáveis dos processos, em destinatários de e-mail e na autorização de modelos e conteúdos.

Configure a estrutura antes de publicar processos que direcionem trabalho por unidade ou posição. Uma chave incorreta ou uma posição sem usuários pode deixar tarefas sem responsável.

## Conceitos principais

- **Unidade organizacional** representa um órgão, secretaria, diretoria, coordenação, comissão ou setor.
- **Subunidade** pertence a outra unidade e forma a hierarquia exibida no organograma.
- **Posição** representa uma função exercida dentro de uma unidade, como Analista, Fiscal, Aprovador ou Gestor.
- **Titular** é a pessoa responsável pela unidade e pode personificar usuários da unidade e de suas subunidades.
- **Preposto** substitui o titular nas ausências.
- **Chave** é o identificador técnico estável usado pelo modelador e pelas integrações.

O nome pode acompanhar mudanças administrativas. A chave deve permanecer estável depois que processos começarem a referenciá-la.

## Planejando a estrutura

Antes do cadastro, desenhe a hierarquia e identifique quais funções recebem tarefas. Evite reproduzir detalhes que não tenham uso operacional. Uma estrutura simples é mais fácil de manter.

Exemplo:

- Secretaria de Meio Ambiente
  - Diretoria de Licenciamento
  - Fiscalização Ambiental
- Secretaria de Administração
  - Gestão de Contratos
  - Compras e Licitações

Em Gestão de Contratos podem existir as posições `Fiscal do contrato`, `Gestor do contrato` e `Aprovador`.

## Configurando unidades organizacionais

1. Acesse **Administração > Unidades organizacionais**.
2. Clique em **Nova unidade raiz** para criar o nível principal, ou use a ação de adicionar em uma unidade existente para criar uma subunidade.
3. Informe **Sigla** e **Nome**.
4. Confira a **Chave** gerada automaticamente. Ajuste-a antes de salvar, se necessário.
5. Descreva o **Objetivo** da unidade.
6. Preencha localização, unidade orçamentária, telefone e e-mail.
7. Selecione o **Titular** e o **Preposto**.
8. Salve e confira a unidade na árvore.

A chave é editável somente durante a criação. Na edição ela aparece para consulta, sem possibilidade de alteração, porque processos podem depender dela.

### Unidade raiz ou subunidade

Crie como raiz apenas estruturas de primeiro nível. Para preservar a hierarquia, use **Nova subunidade** a partir da unidade superior. A tela informa no título do diálogo qual será a unidade pai.

### Ativar e inativar

Uma unidade inativa permanece no histórico. Antes de inativar, revise posições, usuários vinculados, responsáveis de tarefas, modelos de documentos, manuais e processos associados.

### Excluir

Só é possível excluir uma unidade sem subunidades nem posições. Se houver dependências, a API bloqueia a operação. Remova ou reorganize os vínculos de forma controlada; não exclua estruturas usadas apenas para limpar a visualização.

## Cadastrando posições

1. Acesse **Administração > Posições**.
2. Selecione a unidade organizacional.
3. Clique em **Nova posição**.
4. Informe o nome da função.
5. Revise a chave gerada e salve.
6. Vincule a posição aos usuários em **Administração > Usuários**.

A chave da posição também fica somente para leitura depois da criação. Posições com o mesmo nome podem existir em unidades diferentes, mas use nomes que deixem clara a responsabilidade.

Não crie posições com o nome de pessoas. Use `Fiscal do contrato`, e vincule a pessoa que atualmente exerce essa função.

## Vinculando usuários

Na edição do usuário, adicione a unidade e a posição correspondentes. Um usuário pode acumular vínculos. Revise essa soma, pois ela pode fazê-lo receber tarefas de mais de uma área.

Quando alguém muda de setor:

1. identifique tarefas em andamento;
2. reatribua o que for necessário;
3. adicione o novo vínculo;
4. remova o vínculo anterior;
5. revise perfis de acesso;
6. teste a distribuição em homologação.

## Titular e preposto

Selecione usuários ativos e com dados cadastrais corretos. O titular pode atuar em nome de pessoas da unidade e das subunidades; conceda essa função somente a quem possui essa atribuição. O preposto deve estar preparado para assumir durante ausências.

Mudanças de titular ou preposto devem ser registradas e acompanhadas de revisão das tarefas pendentes.

## Consultando o organograma

O **Organograma** mostra a mesma hierarquia em modo de leitura. Clique em uma unidade para abrir o detalhamento em nova aba.

A página da unidade mostra:

- objetivo, localização, unidade orçamentária e contatos;
- titular e preposto;
- processos vinculados;
- manuais, documentos e usuários relacionados;
- contadores em cada aba.

Use **Imprimir** para gerar uma visão consolidada. Na impressão, todas as abas são incluídas, mesmo que somente uma estivesse aberta na tela.

## Utilização no modelador

Ao configurar responsáveis, selecione a unidade e a posição esperadas. O processo usa as chaves estáveis, por isso mudanças de nome são suportadas, enquanto recriar a estrutura com novas chaves exige revisar o fluxo.

Para um licenciamento, a tarefa `Analisar documentação` pode ir para a posição `Analista` da Diretoria de Licenciamento. Em contratos, `Atestar medição` pode ser atribuída ao `Fiscal do contrato` da unidade gestora.

## Diagnóstico

- **posição não aparece**: selecione a unidade correta e confirme que a posição foi criada nela;
- **tarefa sem responsável**: verifique se há usuário ativo naquela unidade e posição;
- **não é possível excluir**: existem subunidades ou posições dependentes;
- **chave incorreta**: a chave não pode ser alterada após a criação; avalie criar uma nova estrutura e migrar referências;
- **dados sumiram ao abrir edição**: aguarde o carregamento completo antes de salvar;
- **organograma vazio**: confirme o cadastro de uma unidade raiz.

## Checklist de homologação

- hierarquia aprovada pelo responsável do órgão;
- chaves curtas, estáveis e sem referência a pessoas;
- titulares e prepostos ativos;
- posições vinculadas aos usuários corretos;
- processos e notificações revisados;
- distribuição de tarefas simulada;
- detalhamento e impressão conferidos no desktop e no celular.

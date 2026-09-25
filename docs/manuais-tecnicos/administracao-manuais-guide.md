# Administração de manuais e Guide

**Manuais técnicos › Administração › Administração de manuais e Guide**

Este manual explica como criar, organizar, restringir, publicar e manter conteúdos exibidos no Guide e acessados por helpers contextuais.

> **Acesso restrito**
> A administração requer `manuals:read` para consultar e `manuals:write` para alterar. A aba e os conteúdos técnicos dependem também de `manuals:technical`.

## Como os manuais são apresentados

O cadastro administrativo alimenta a página **Guide**. Cada manual possui:

- título;
- categoria;
- artigo-pai opcional;
- público;
- unidades organizacionais opcionais;
- ícone;
- conteúdo formatado;
- estado de publicação;
- indicação de manual técnico.

O Guide organiza os itens por categoria, ordem e hierarquia. O conteúdo publicado pode ser encontrado por pesquisa, menu, navegação anterior/próximo e link direto para um capítulo.

## Manuais e manuais técnicos

A aba **Manuais** contém conteúdos normais. A aba **Técnico** aparece apenas para usuários com `manuals:technical`.

Manuais técnicos são adequados a administradores, configuradores e equipes de suporte. Orientações destinadas a solicitantes devem ser criadas como manuais normais com público externo ou ambos.

Não marque um conteúdo como técnico apenas para escondê-lo temporariamente. Use rascunho enquanto ele ainda não estiver pronto.

## Criando um manual

Acesse **Admin › Configurações › Manuais**, escolha a aba correta e clique em **Novo manual**.

### Título

Use uma frase que descreva a tarefa do leitor. Prefira **Como responder a uma solicitação de complementação** a **Complementação**.

O título também ajuda a pesquisa e aparece na navegação do Guide.

### Artigo-pai

Selecione quando o novo conteúdo for parte de um assunto maior. O filho herda a categoria do pai e a seleção de categoria fica bloqueada.

Exemplo:

- pai: **Licenciamento ambiental**;
- filho: **Como enviar estudos complementares**;
- filho: **Como acompanhar a análise**.

Evite hierarquias profundas. Um nível de pai e filhos costuma ser suficiente para leitura e navegação móvel.

### Categoria

Agrupa assuntos no menu e na página inicial do Guide. Se necessário, use o botão ao lado para criar uma categoria.

Categorias úteis descrevem domínios, como **Primeiros passos**, **Licenciamentos**, **Contratos** e **Administração**. Evite categorias vagas como **Diversos**.

### Público

| Opção | Quem poderá receber o conteúdo |
|---|---|
| **Externo (público)** | Solicitantes e visitantes conforme a exposição do Guide. |
| **Interno** | Usuários internos autorizados. |
| **Ambos** | Públicos interno e externo. |

O público não substitui as unidades organizacionais nem a restrição de manual técnico.

### Unidades organizacionais

Disponível para público interno ou ambos. Nenhuma unidade marcada significa visibilidade para todas as unidades elegíveis.

Marque unidades quando o procedimento variar por estrutura. Se o conteúdo vale para todo o órgão, deixe a lista vazia para evitar manutenção desnecessária.

### Ícone

Escolha um ícone coerente com a categoria ou ação. Ícones ajudam reconhecimento, mas o título deve continuar compreensível sozinho.

### Conteúdo

O editor permite formatação, links, imagens e vídeos por URL e edição do HTML. Estruture o texto com:

1. objetivo e público;
2. pré-requisitos;
3. localização da funcionalidade;
4. explicação dos controles;
5. passo a passo;
6. exemplo realista;
7. erros comuns;
8. assuntos relacionados.

Use títulos de segundo e terceiro nível para formar o sumário lateral. Um helper contextual pode apontar diretamente para esses títulos.

### Publicar e Manual técnico

Marque **Publicar** somente depois da revisão. Marque **Manual técnico** apenas quando o conteúdo exigir a permissão técnica.

Clique em **Salvar**. Fechar ou cancelar descarta alterações não enviadas.

## Escrevendo conteúdo útil

### Explique decisões, não apenas cliques

Em vez de “clique em Publicar”, explique o efeito: novas requisições usarão a versão publicada e a produção anterior será substituída para novos inícios.

### Use exemplos do trabalho do usuário

Para servidores, use protocolos, análise, parecer e prazos. Para empreendimentos, use licenças e complementações. Para fornecedores, use contratos, garantias e documentos fiscais.

### Diferencie interface e regra

Informe quando a validação ocorre também no servidor, quando uma permissão é necessária e quando uma configuração depende de outra área.

### Mantenha termos iguais aos da tela

Use **Tarefas × Campos**, **Salvar rascunho** e **Em homologação** exatamente como aparecem. Isso facilita pesquisa e reduz ambiguidade.

## Inserindo imagens depois

Escolha capturas que mostrem uma ação específica. Antes de publicar uma imagem:

- oculte dados pessoais, credenciais e informações protegidas;
- destaque a área mencionada no texto;
- use resolução legível em desktop e mobile;
- escreva texto alternativo;
- atualize a captura quando a interface mudar.

Não dependa apenas da imagem. O procedimento precisa permanecer compreensível em texto.

## Publicação e revisão

Adote este fluxo:

1. crie como rascunho;
2. revise termos e permissões com o responsável funcional;
3. teste todos os passos com um perfil representativo;
4. confira o Guide em desktop e mobile;
5. teste pesquisa, sumário e links;
6. publique;
7. registre a data ou responsável pela próxima revisão no processo editorial do órgão.

## Usando o Guide

O Guide possui áreas **Interno**, **Externo** e **Técnico** conforme a sessão. A página contém:

- pesquisa no cabeçalho;
- menu de categorias e artigos;
- sumário do manual selecionado;
- breadcrumbs;
- ação **Copiar link**;
- navegação anterior e próxima;
- gaveta de menu no mobile.

O link copiado preserva aba, manual e capítulo. O destinatário ainda precisa ter autorização para a área indicada.

## Helpers contextuais

Helpers técnicos usam uma chave estável do manual e uma chave de seção. Ao clicar, o conteúdo abre em uma nova aba e tenta posicionar o capítulo correspondente.

Para um helper funcionar de forma confiável:

- o título do manual deve corresponder ao mapeamento técnico;
- o capítulo precisa possuir um título estável;
- o manual deve estar publicado;
- o usuário precisa de `manuals:technical`;
- alterações de título devem atualizar o mapeamento da aplicação.

Evite dois helpers no mesmo ponto. Quando existir link para o manual completo, mantenha somente esse helper no cabeçalho; popovers continuam adequados para explicar campos específicos sem documentação própria.

## Atualizando um manual

Abra o cartão e use **Editar**. Revise conteúdo, público, unidade e publicação.

Alterar o artigo-pai também altera a categoria herdada. Alterar o público para externo remove a necessidade de unidades internas no envio.

Depois de salvar:

1. abra o Guide;
2. localize o manual pela pesquisa;
3. confira o sumário;
4. teste os helpers associados;
5. valide a visualização móvel.

## Excluindo um manual

Use **Excluir** somente quando o conteúdo não tiver mais valor histórico ou substituto. Antes:

- verifique filhos vinculados;
- localize helpers que apontam para o título;
- crie redirecionamento editorial ou atualize os links;
- confirme que não é melhor despublicar.

## Exemplo completo

Para criar um manual externo **Como enviar a garantia contratual**:

1. abra a aba **Manuais**;
2. escolha a categoria **Contratos**;
3. defina público **Externo**;
4. explique formatos, tamanho e validade do documento;
5. inclua o passo a passo dentro da tarefa;
6. acrescente um exemplo de nome de arquivo;
7. descreva os erros de envio;
8. revise no Guide móvel;
9. publique.

Para um manual técnico sobre configuração dessa garantia, crie outro item na aba **Técnico** e explique modelagem, assinatura e visibilidade interna.

## Erros comuns

### O manual foi salvo, mas não aparece

Confirme **Publicar**, público, unidades, aba técnica e permissões do usuário.

### O artigo ficou em outra categoria

Artigos filhos herdam a categoria do pai. Altere o pai ou reorganize a hierarquia.

### O helper abre o Guide, mas não o capítulo

Confira o título do capítulo e o mapeamento da chave de seção. Mudanças editoriais precisam preservar a identificação esperada.

### O conteúdo aparece para público indevido

Despublique imediatamente, ajuste público e unidades e revise se informação protegida chegou a ser exposta.

### A imagem ficou ilegível no celular

Recorte para a ação relevante e mantenha o procedimento completo em texto.

## Checklist editorial

- Título orientado à tarefa.
- Público e unidades conferidos.
- Permissões mencionadas.
- Passos testados na versão atual.
- Exemplos sem dados reais.
- Títulos formando um sumário útil.
- Links abrindo corretamente.
- Visualização desktop e mobile revisada.
- Helper contextual sem duplicidade.

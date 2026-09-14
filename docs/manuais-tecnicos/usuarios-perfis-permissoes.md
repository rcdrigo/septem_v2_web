# Usuários, perfis e permissões

## Objetivo deste manual

Este manual explica como cadastrar usuários internos, atribuir perfis de acesso e relacioná-los a unidades e posições. Essas configurações controlam o que cada servidor pode consultar, administrar e executar.

Siga o princípio do menor acesso: cada pessoa deve receber somente as permissões e posições necessárias para seu trabalho. Revise acessos quando houver mudança de setor, função, contrato ou vínculo.

## Como o acesso é formado

O acesso efetivo combina três elementos:

- **usuário**: identidade, dados cadastrais e situação ativa ou inativa;
- **perfil**: conjunto de permissões funcionais, como visualizar manuais técnicos ou administrar cadastros;
- **unidade e posição**: vínculo organizacional usado na distribuição de tarefas e em regras por área.

Um usuário pode ter mais de um perfil e mais de uma posição. A soma desses vínculos amplia seu acesso, portanto evite perfis redundantes.

## Cadastrando usuários

1. Acesse **Administração > Usuários**.
2. Clique em **Novo usuário**.
3. Informe **Nome** e um **E-mail** individual e válido.
4. Preencha CPF, RG, matrícula, telefone e cargo conforme a política do órgão.
5. Marque os **Perfis de acesso** necessários.
6. Em **Unidades e posições**, adicione cada vínculo organizacional.
7. Revise os dados e salve.

No cadastro, a tela pode apresentar o resultado do provisionamento ou instruções relacionadas ao acesso inicial. Não compartilhe credenciais entre pessoas. Use um endereço institucional que permita recuperação e auditoria.

### Editando ou desativando

Abra a edição para corrigir dados, mudar o status, perfis ou posições. Ao afastar ou desligar alguém, desative o usuário e trate tarefas pendentes antes de remover seus vínculos. A inativação preserva o histórico das ações já realizadas.

Antes de retirar uma posição, confirme se ela participa como responsável de tarefas em andamento. Reatribua o trabalho quando necessário.

## Criando um perfil de acesso

1. Acesse **Administração > Perfis de acesso**.
2. Clique em **Novo perfil**.
3. Informe um nome baseado na função, como `Analista de licenciamento` ou `Gestor de contratos`.
4. Descreva quem deve receber o perfil e para qual finalidade.
5. Marque as permissões por grupo.
6. Salve e atribua o perfil aos usuários adequados.

Cada permissão mostra uma descrição e sua chave técnica. Use a descrição para decidir e registre a justificativa do perfil. Perfis de sistema são identificados na lista e ficam somente para leitura; eles não podem ser alterados ou excluídos pela tela.

Evite criar um perfil diferente para cada usuário. Prefira funções estáveis e combine-as quando alguém acumular atribuições.

## Permissão dos manuais técnicos

Os helpers contextuais e a aba **Técnico** do Guia aparecem apenas para quem possui `manuals:technical`. Atribua essa permissão a administradores, modeladores, suporte e demais responsáveis que precisam consultar procedimentos técnicos.

Depois de mudar o perfil, peça ao usuário para atualizar a sessão caso o novo acesso não apareça imediatamente.

## Unidades organizacionais e posições

A unidade representa a estrutura do órgão, como secretaria, diretoria, coordenação ou comissão. A posição representa uma função dentro da unidade, como analista, fiscal do contrato ou aprovador.

Cadastre a estrutura antes de vinculá-la aos usuários. Use nomes que permaneçam compreensíveis em processos, relatórios e destinatários de e-mail. Ao alterar uma estrutura, avalie os responsáveis configurados no modelador e os modelos de notificação.

Na edição do usuário:

1. selecione a unidade;
2. selecione uma posição disponível nela;
3. adicione o vínculo;
4. repita para outros vínculos necessários;
5. remova relações antigas e salve.

## Exemplos de configuração

### Licenciamento

Um analista pode receber o perfil `Analista de licenciamento` e a posição `Analista` na unidade `Secretaria de Meio Ambiente`. Um coordenador pode acumular o perfil de análise com permissões de administração e a posição `Aprovador`.

### Contratos

Um fiscal pode receber o perfil `Fiscal de contratos` e a posição `Fiscal` na unidade gestora. Fornecedores externos não devem receber perfis administrativos internos; eles usam a jornada externa apropriada.

## Revisão periódica

Faça uma revisão ao menos quando houver mudança de equipe ou estrutura. Compare usuários ativos, perfis atribuídos e posições. Procure:

- contas sem responsável identificável;
- usuários ativos sem vínculo vigente;
- permissões administrativas acumuladas sem necessidade;
- posições antigas ainda usadas em processos;
- perfis com nomes parecidos e funções sobrepostas.

## Diagnóstico de acesso

Se um usuário não vê uma funcionalidade:

1. confirme que a conta está ativa;
2. confira os perfis atribuídos;
3. localize a permissão exigida no catálogo;
4. verifique unidade e posição quando a regra depender da organização;
5. encerre e reinicie a sessão;
6. teste com o próprio perfil, sem conceder acesso administrativo amplo como atalho.

## Checklist de segurança

- conta individual e e-mail válido;
- dados cadastrais conferidos;
- usuário ativo apenas durante o vínculo;
- perfis mínimos para a função;
- unidade e posição atuais;
- tarefas reatribuídas antes da desativação;
- acesso técnico concedido somente a quem precisa;
- revisão registrada pelo responsável.

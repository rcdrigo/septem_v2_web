# Validação pública de documentos

## Objetivo deste manual

Este manual explica como cidadãos, empreendimentos, fornecedores e agentes públicos verificam a autenticidade de um documento emitido pelo órgão. A consulta é pública, não exige login e depende de número do processo, código verificador e captcha.

A validação abre sempre a versão vigente do documento associado ao código. Se houve reemissão, o arquivo consultado pode ser diferente da cópia impressa em mãos.

## Informações necessárias

O usuário precisa de:

- **Número do processo**;
- **Código verificador**, com até 16 caracteres;
- acesso à verificação anti-robô do ambiente.

Quando o documento possui QR Code, o link pode preencher número e código automaticamente. O usuário ainda conclui o captcha antes de consultar.

## Validando um documento

1. Acesse a página **Validar documento** ou leia o QR Code impresso.
2. Confira se o cabeçalho identifica o órgão correto.
3. Informe o **Número do processo** usando somente dígitos.
4. Informe o **Código verificador**. A tela converte letras para maiúsculas.
5. Conclua a verificação anti-robô.
6. Clique em **Consultar**.
7. Confira serviço, processo, situação e data de emissão.
8. Clique em **Abrir documento**. O arquivo abre em nova aba.

No celular, se a leitura do QR abrir outro navegador, confirme que a URL pertence ao domínio oficial do órgão.

## Interpretando o resultado

Quando encontrado, o sistema mostra **Documento autêntico** e informa:

- serviço que originou o documento;
- número do processo;
- situação: Em andamento, Concluído ou Cancelado;
- data de emissão;
- botão para abrir o arquivo vigente.

Autenticidade confirma que o código corresponde a um documento disponibilizado pelo sistema. Avalie também a situação do processo e a versão exibida.

## Documento reemitido

O código é associado à vaga documental e mostra a versão mais recente. Compare a data, o conteúdo e demais identificadores. Se a cópia em mãos divergir, use o arquivo aberto pela consulta como referência vigente e confirme a política administrativa do órgão.

Quando a finalidade exigir comprovar exatamente uma versão histórica, a validação pública atual não fornece essa comparação. Solicite confirmação oficial ao órgão.

## Relação com assinaturas

Documentos podem conter assinaturas eletrônicas. A página pública de validação confirma o documento emitido e abre o arquivo vigente. A conferência detalhada de signatários, certificado e estado da assinatura ocorre nos recursos de assinatura disponíveis aos usuários autorizados.

Se um documento foi alterado depois de assinado, o hash da assinatura anterior deixa de corresponder. Não confunda a mensagem de autenticidade do documento vigente com a validação isolada de cada assinatura.

## Configuração necessária no ambiente

A consulta depende da chave do captcha configurada no tenant. Sem ela, a tela informa que a consulta está indisponível e o botão permanece bloqueado.

Para homologar:

1. gere um documento real de teste;
2. obtenha número e código;
3. acesse a página sem login;
4. teste preenchimento manual e QR Code;
5. abra o arquivo em desktop e celular;
6. reemita o documento e confirme que a consulta mostra o vigente;
7. teste número ou código inválido;
8. valide o comportamento sem captcha em ambiente controlado.

## Orientações para documentos emitidos

- imprima número e código com boa legibilidade;
- use QR Code com contraste e margem adequados;
- informe o domínio oficial próximo ao código;
- evite colocar dados sensíveis na própria URL;
- mantenha o endereço público estável;
- explique que a consulta mostra a versão mais recente.

## Problemas comuns

- **Consultar desabilitado**: falta número, código ou token do captcha;
- **consulta indisponível**: captcha não configurado ou não carregado;
- **documento não encontrado**: confira número e código sem espaços adicionais;
- **QR Code não abre**: tente outro leitor e digite os dados manualmente;
- **arquivo não abre**: permita nova aba e teste a conexão;
- **situação cancelada**: confirme com o órgão se o documento ainda produz efeitos;
- **arquivo diferente do papel**: pode ter ocorrido reemissão; a consulta mostra o vigente.

## Atendimento ao usuário externo

O suporte deve pedir número do processo e código verificador, sem solicitar senha. Confirme o domínio acessado e oriente o captcha. Não envie arquivos por canais não autorizados para contornar uma falha de acesso.

Se a consulta continuar falhando com dados corretos, registre horário, navegador, dispositivo e mensagem apresentada. Não publique número e código em chamados visíveis a terceiros.

## Checklist de publicação

- captcha configurado;
- domínio oficial confirmado;
- documento contém número, código e QR legíveis;
- consulta anônima testada;
- arquivo abre em nova aba;
- versão vigente conferida após reemissão;
- mensagens compreensíveis no mobile;
- equipe de atendimento conhece as limitações.

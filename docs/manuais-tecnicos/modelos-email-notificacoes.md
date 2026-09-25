# Modelos de e-mail e notificações

## Objetivo deste manual

Este manual explica a configuração do servidor de e-mail e a criação de modelos usados nos eventos dos processos. Um modelo reúne assunto, mensagem, anexos e destinatários. A entrega depende da configuração SMTP do ambiente.

Use modelos para avisos previsíveis, como protocolo recebido, tarefa atribuída, pedido de complementação, prazo próximo e contrato aprovado.

## Configurando o envio do ambiente

Antes de criar modelos, acesse **Administração > Parâmetros > E-mail** e configure o servidor SMTP. Informe host, porta, autenticação quando exigida, uso de TLS/SSL e os dados do remetente.

O **Remetente (e-mail)** é o endereço técnico usado no envio. O **Remetente (nome exibido)** deve identificar o órgão ou serviço. Salve e use o teste de conexão/envio disponível na tela. Se o teste falhar, confira rede, porta, credenciais, criptografia e autorização do remetente.

Não publique processos que dependem de e-mail antes de validar o SMTP no ambiente correspondente.

## Criando um modelo de e-mail

1. Acesse **Administração > Modelos de e-mail**.
2. Clique em **Novo modelo**.
3. Informe um **Nome** que indique evento e público, como `Licenciamento - pedido de complementação ao requerente`.
4. Descreva quando o modelo deve ser usado.
5. Escreva o **Assunto**.
6. Monte a **Mensagem** no editor de texto.
7. Adicione anexos por referência de campo, se necessário.
8. Configure um ou mais destinatários.
9. Clique em **Testar** para enviar o conteúdo atual ao seu endereço.
10. Revise o e-mail recebido e clique em **Salvar**.

Assunto e mensagem aceitam placeholders, por exemplo `{{requisitante.nome}}`. Use apenas tokens que estarão disponíveis no ponto do processo em que o e-mail for enviado.

## Escrevendo uma mensagem útil

Inclua o órgão, o serviço, a ação esperada e uma referência que ajude a localizar a requisição. Evite expor dados pessoais sensíveis no assunto, porque ele pode aparecer em notificações de tela bloqueada.

Exemplo de assunto:

> Complementação necessária — protocolo {{processo.numero}}

Exemplo de corpo:

> Olá, {{requisitante.nome}}. A análise do protocolo {{processo.numero}} identificou informações pendentes. Acesse o sistema, abra a requisição e consulte a tarefa de complementação.

Não use o e-mail como único registro de uma decisão administrativa. O conteúdo essencial deve permanecer na requisição ou tarefa.

## Anexos

Em **Anexos (campos do formulário)**, informe a referência do campo que contém o arquivo, como `anexo_contrato`. Adicione somente arquivos necessários e confirme que o campo já estará preenchido quando o evento ocorrer.

Se um anexo não chegar, verifique o nome do campo, a existência do arquivo e o momento da execução. Considere limites de tamanho do servidor SMTP.

## Tipos de destinatário

Cada linha possui o modo de envio **Para**, **Cópia** ou **Cópia oculta**, além do tipo de destinatário:

- **Requisitante**: usa o e-mail de quem abriu a requisição;
- **Posição**: envia às pessoas de uma posição em uma unidade organizacional;
- **Usuário dinâmico (campo)**: resolve um usuário a partir de um campo do formulário;
- **Usuário fixo**: seleciona uma conta ativa;
- **Endereço fixo**: usa um e-mail digitado;
- **Customizado (SQL)**: consulta endereços conforme a regra informada.

Prefira destinatários por função para rotinas institucionais. Use endereço fixo apenas quando ele for estável e monitorado. Consultas SQL devem retornar endereços válidos e seguir o mesmo cuidado de leitura e parametrização aplicado às fontes de dados.

## Para, cópia e cópia oculta

Use **Para** para quem precisa agir. Use **Cópia** para ciência e **Cópia oculta** quando os destinatários não devem ver os demais endereços. Evite listas amplas sem finalidade, pois aumentam a exposição de dados e o volume de mensagens.

## Testando o modelo

O botão **Testar** envia assunto e corpo atuais para o usuário que está editando. Ele permite revisar formatação, links e aparência. Destinatários e anexos dependentes de uma requisição devem ser homologados em uma simulação do processo.

No teste, confira:

- identificação do remetente;
- assunto completo e sem tokens indevidos;
- leitura no desktop e no celular;
- links e chamadas para ação;
- caracteres acentuados;
- ausência de dados reais desnecessários.

## Vinculando ao processo

No modelador de processos, selecione o modelo no evento, tarefa ou rotina de e-mail correspondente. Confirme que ele é acionado no momento correto e que os dados usados nos placeholders já existem.

Após publicar, simule cenários com e sem dados opcionais. Verifique também destinatários em posições vazias, usuários inativos e campos dinâmicos não preenchidos.

## Diagnóstico

- **teste não enviado**: revise SMTP e o e-mail do usuário atual;
- **placeholder aparece literalmente**: token incorreto ou indisponível naquele ponto;
- **destinatário ausente**: confira posição, usuário, campo ou resultado SQL;
- **anexo ausente**: valide referência e preenchimento do campo;
- **mensagem no spam**: confira domínio, remetente e políticas do serviço de e-mail;
- **duplicidade**: verifique destinatários sobrepostos e múltiplos eventos no fluxo.

## Checklist de publicação

- SMTP testado;
- remetente identificado;
- assunto sem dados sensíveis;
- mensagem clara e acionável;
- placeholders homologados;
- destinatários mínimos e corretos;
- anexos necessários disponíveis;
- visualização conferida em desktop e mobile;
- evento validado por simulação.

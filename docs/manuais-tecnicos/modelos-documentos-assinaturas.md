# Modelos de documentos e assinaturas

## Objetivo deste manual

Este manual orienta a criação de modelos DOCX, o uso de chaves do processo, os testes de geração e a assinatura dos documentos produzidos. O cadastro dos modelos é administrativo; a assinatura aparece ao usuário responsável quando a tarefa possui um documento assinável.

Um modelo transforma dados da requisição em um documento padronizado, como licença, parecer, termo de referência, ordem de fornecimento ou contrato.

## Preparando o arquivo DOCX

Crie o documento no Word ou LibreOffice com o texto institucional, estilos, cabeçalhos, rodapés e tabelas necessários. Nos locais variáveis, use chaves no formato `{{campo}}`. As chaves devem corresponder aos campos disponíveis no serviço.

Exemplo:

> Concede-se a licença ao empreendimento **{{razao_social}}**, inscrito no CNPJ **{{cnpj}}**, para a atividade **{{atividade}}**.

Evite quebrar uma chave entre estilos ou trechos diferentes do Word. Mantenha `{{`, o nome e `}}` no mesmo bloco de texto. Antes do envio, revise se nenhuma chave ficou incompleta.

## Criando um modelo

1. Acesse **Administração > Modelos de documentos**.
2. Use **Buscar campos** para abrir os campos publicados de um serviço e copiar as chaves corretas.
3. Clique em **Novo modelo**.
4. Informe **Nome** e **Descrição**.
5. Selecione a **Unidade organizacional** responsável. Essa escolha participa da autorização de edição.
6. Defina o **Status** como ativo ou inativo.
7. Escolha o **Tipo de saída**: DOCX ou PDF.
8. Clique em **Salvar**. O arquivo só pode ser enviado depois que o modelo possui um identificador.
9. Edite o modelo salvo e envie o arquivo em **Arquivo do modelo (.docx)**.
10. Confira a validação apresentada pela tela.

Use DOCX quando o resultado ainda precisar de edição. Use PDF quando o documento deve sair em formato de leitura e assinatura. A geração de PDF depende do conversor configurado no servidor.

## Buscar campos

O recurso **Buscar campos** consulta os campos de um serviço. Selecione o serviço, localize o campo e copie a chave. Confirme que está usando a versão publicada correta do formulário.

Adote nomes claros no modelador, pois eles serão reutilizados nos documentos. Para dados de tarefa ou de contexto, confira a lista disponível no ambiente e faça um teste antes da publicação.

## Arquivo, validação e visualização

O envio de um novo DOCX substitui o arquivo anterior. Após enviar:

- revise os avisos de validação;
- abra a visualização para conferir paginação, fontes e substituições;
- corrija chaves desconhecidas ou malformadas;
- repita o envio e a validação.

A visualização abre em nova aba. Quando o servidor não consegue converter para PDF, o arquivo DOCX pode ser entregue para download.

## Testando a geração

Use a ação **Testar** do modelo. Selecione o serviço ou contexto solicitado, gere um documento e verifique:

- se todas as chaves foram substituídas;
- se valores ausentes aparecem de forma aceitável;
- se tabelas e quebras de página permaneceram corretas;
- se o tipo de saída corresponde ao configurado;
- se o arquivo abre em desktop e mobile.

O teste não substitui a homologação do processo completo. Depois de aprovar o modelo isolado, execute uma simulação com dados semelhantes aos de produção.

## Histórico de execuções

O **Histórico** apresenta gerações de teste e de produção, formato, solicitante, data, duração e resultado. Use-o para investigar documentos ausentes ou falhas de conversão. Registre o horário e o processo ao acionar o suporte.

## Vinculando o modelo ao processo

No modelador de processos, configure a tarefa ou rotina que gera o documento e selecione o modelo apropriado. Garanta que todos os campos utilizados no DOCX existam antes do ponto de geração. Quando o documento precisar de assinatura, o campo de arquivo deve estar configurado para essa etapa da tarefa.

## Assinando um documento

A página de assinatura abre em aba própria e exibe o documento antes das opções. Se o navegador móvel não mostrar o arquivo no quadro, use **Abrir em outra aba** e leia-o antes de assinar.

Há dois métodos:

### Assinatura eletrônica simples

É a opção inicial. O sistema registra nome, CPF, data, hora e o hash SHA-256 do arquivo. Clique em **Assinar documento** somente depois de conferir o conteúdo.

### Certificado ICP-Brasil A1

Selecione **Certificado ICP-Brasil (A1)**, escolha um arquivo `.pfx` ou `.p12` e informe a senha. O CPF do certificado deve coincidir com o cadastro do usuário. Arquivo e senha são usados na operação e não ficam guardados pela tela.

## Validade e conferência

A assinatura é vinculada ao conteúdo por hash. Se o documento for substituído, a assinatura anterior deixa de valer para o novo arquivo. **Visualizar assinaturas** gera a conferência disponível e a lista informa signatário, data, tipo e estado.

Se aparecer **arquivo alterado** ou **arquivo indisponível**, não trate a assinatura como válida. Recupere o documento correto ou gere uma nova versão e repita a coleta das assinaturas.

## Checklist de homologação

- chaves copiadas do serviço correto;
- DOCX validado sem chaves quebradas;
- unidade, status e formato de saída revisados;
- geração de teste conferida visualmente;
- geração de produção simulada;
- documento legível no desktop e no celular;
- responsáveis pela assinatura testados;
- substituição de arquivo e necessidade de novas assinaturas compreendidas.

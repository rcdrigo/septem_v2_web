# Parâmetros, armazenamento e segurança

## Objetivo deste manual

Este manual explica as abas de **Parâmetros do sistema** e o efeito de cada configuração sobre identidade visual, prazos, arquivos, autenticação e automação por IA. Alterações atingem todo o ambiente e devem ser testadas em homologação.

Senhas e chaves são campos de escrita protegida: a interface informa que existe um segredo configurado, mas não devolve seu valor. Deixar o campo vazio preserva o segredo atual, salvo quando houver uma opção explícita de remoção.

## Configurando parâmetros do sistema

1. Acesse **Administração > Parâmetros do sistema**.
2. Abra uma aba por vez.
3. Registre os valores anteriores e a justificativa da alteração.
4. Modifique somente os campos necessários.
5. Clique em **Salvar** na própria aba.
6. Execute o teste disponível para e-mail ou arquivos.
7. valide o efeito em uma sessão de usuário e em dispositivo móvel.

Cada aba salva seu próprio conjunto. Trocar de aba não salva automaticamente.

## Aba Informações gerais

### Identidade

- **Nome do cliente** identifica o órgão.
- **Nome do ambiente** diferencia produção, homologação ou treinamento.
- **URL do logo** exibe a marca no login, cabeçalhos e páginas públicas.
- **Cor primária** usa valor hexadecimal, como `#0f172a`.

Use imagens hospedadas em endereço estável e acessível pelos usuários externos. Em homologação, deixe o nome do ambiente evidente para evitar registros acidentais.

### Tela de login

A **URL da imagem de destaque** e a **Descrição do sistema** compõem a apresentação do portal. Escreva uma descrição curta, institucional e compreensível. Confira contraste, recorte e carregamento em desktop e celular.

### Calendário de horas úteis

Defina os períodos de cada dia da semana, com horas e minutos. Um dia pode ter mais de um período, como **08:00–12:00 e 14:00–18:00**; o intervalo entre eles não entra no cálculo. Um dia sem períodos não conta horas úteis. Os períodos não podem se sobrepor nem atravessar a meia-noite.

Para preencher rapidamente, selecione os dias que compartilham os mesmos horários e aplique os períodos de uma vez. Depois, ajuste os dias individualmente, por exemplo para usar **09:00–12:00** somente no sábado.

O calendário padrão do cliente é copiado na criação de cada ambiente. As alterações nesta tela valem somente para o ambiente atual e para novos cálculos: não sincronizam os outros ambientes nem alteram vencimentos já calculados. O admin do cliente faz essa edição na administração do seu ambiente, sem acesso à área dos super admins.

Estado, município e fuso horário identificam a localidade usada no cálculo. Clientes existentes devem completar a localização antes de utilizar o novo cálculo com feriados. Os horários seguem o fuso do cliente, independentemente do fuso do usuário.

Os feriados nacionais, estaduais e municipais aplicáveis são consultados ao calcular o prazo de uma tarefa que respeita horas úteis, inclusive nas datas seguintes necessárias para completar esse prazo. Um feriado exclui o dia inteiro. Se a consulta estiver indisponível, o cálculo usa a semana padrão; o vencimento gerado também é preservado. Feriados não representam um status de aberto ou fechado do cliente e não são consultados durante seu cadastro. Recessos e horários especiais por data não fazem parte desta etapa.

## Aba E-mail

A configuração SMTP é detalhada no manual **Modelos de e-mail e notificações**. Nesta aba são definidos servidor, porta, autenticação, TLS/SSL, usuário, senha e remetente.

Salve antes de clicar em **Enviar teste**, pois o teste usa a configuração gravada. O destino inicial é o e-mail do administrador atual.

## Aba Arquivos

### Bucket

Informe bucket, região, endpoint, pasta base, access key e secret key. O armazenamento deve ser S3 ou compatível, como MinIO. A pasta base ajuda a separar ambientes ou tenants.

Não reutilize a mesma pasta de produção em homologação. Use credenciais com acesso limitado ao bucket necessário.

### Entrega dos arquivos

- **URL do CDN** define o endereço público de entrega, quando usado.
- **URLs assinadas** limitam o acesso por tempo.
- **Validade da URL** aceita de 1 a 10.080 minutos.
- **Classe de armazenamento** pode ser Standard, acesso infrequente ou Glacier.
- **Criptografia** permite AES-256 no servidor.

Use URLs assinadas para anexos restritos. Classes de arquivamento podem tornar a recuperação lenta; não use Glacier para documentos que precisam abrir imediatamente em tarefas.

### Limites de upload

O tamanho máximo vale para todos os anexos dos formulários. As extensões bloqueadas são informadas em lista, como `exe,bat,cmd`. Alinhe o limite com proxy, API, bucket e SMTP quando arquivos forem enviados por e-mail.

Depois de salvar, clique em **Testar conexão**. O teste confirma acesso ao bucket, mas a homologação deve incluir upload, abertura e expiração de URL.

## Aba Segurança

### Verificação em duas etapas

Escolha:

- **Nunca**: código adicional desligado;
- **Somente funcionários**: exige código para usuários internos;
- **Todos os usuários**: exige código também para externos.

O código é enviado por e-mail, portanto o SMTP deve funcionar antes de ativar a exigência. Usuários podem confiar no dispositivo e removê-lo em **Meus dados**.

### Bloqueio por tentativas

Defina entre 3 e 20 tentativas e de 1 a 1.440 minutos de bloqueio. A recuperação de senha libera a conta imediatamente. Escolha valores que dificultem ataques sem impedir o atendimento normal.

Homologue login válido, senha incorreta, bloqueio, recuperação e autenticação em duas etapas.

## Aba OpenRouter

Essa integração alimenta o agente que propõe JavaScript para formulários.

- **Chave da API** é cifrada e não retorna ao navegador.
- **Modelo** usa o identificador `provedor/modelo` e precisa suportar respostas estruturadas.
- **URL do site** é opcional.
- **Limite de tokens** controla o tamanho máximo da resposta.
- **Remover a chave salva** desativa o agente ao salvar.

Alterações valem nas próximas solicitações, sem reiniciar a aplicação. O código gerado nunca deve ser publicado sem revisão, prévia e simulação.

## Ordem recomendada para um ambiente novo

1. identidade e identificação do ambiente;
2. expediente;
3. armazenamento e teste de conexão;
4. SMTP e teste de envio;
5. segurança e autenticação em duas etapas;
6. OpenRouter, se a organização autorizar o recurso;
7. homologação completa de login, anexos e prazos.

## Diagnóstico

- **logo não aparece**: confira URL pública, formato e permissões;
- **prazo calculado incorretamente**: revise expediente, dias úteis e configuração da tarefa;
- **bucket não conecta**: confira endpoint, região, credenciais e rede;
- **arquivo abre após o prazo esperado**: confirme se a entrega usa URL assinada;
- **código de login não chega**: teste SMTP antes de manter a exigência ativa;
- **agente de IA indisponível**: verifique chave, modelo e autorização do serviço;
- **segredo foi apagado**: confirme se foi marcada a remoção explícita; campo vazio normalmente preserva o valor.

## Checklist de mudança

- alteração aprovada e registrada;
- valores anteriores preservados;
- ambiente correto confirmado;
- segredos tratados fora de registros públicos;
- testes específicos concluídos;
- efeitos em processos ativos avaliados;
- desktop e mobile conferidos;
- plano de reversão definido.

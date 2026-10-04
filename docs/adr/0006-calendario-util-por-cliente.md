# Calendário padrão do cliente com cópias independentes por ambiente

Revisão de 4 de outubro de 2026: o [ADR 0008](0008-localizacao-configurada-por-ambiente.md) substitui a exigência de localização no cadastro central e seu escopo por cliente. Ler essas regras históricas conforme a revisão; os demais princípios de calendários independentes e preservação de vencimentos permanecem.

A configuração atual de expediente pertence ao ambiente; a decisão para sua evolução é definir um calendário padrão de horas úteis no cliente e copiá-lo ao criar cada ambiente. As cópias são independentes: editar o calendário em produção, por exemplo, afeta somente produção, sem alterar homologação nem o padrão do cliente. Isso permite começar com os horários do cliente e ajustar cada ambiente sem propagar mudanças. Alterações afetam somente novos cálculos e preservam vencimentos já calculados, evitando mudanças implícitas nos prazos de tarefas em andamento.

A checagem de feriados ocorre ao calcular as horas úteis das tarefas, usando a cidade e o estado do cliente, e não no cadastro do cliente. O calendário serve ao cálculo de horas úteis e às regras de negócio que o utilizem, sem representar status de aberto ou fechado.

O escopo inicial contempla múltiplos períodos por dia da semana, precisão de minutos e aplicação dos mesmos períodos a dias selecionados com edição individual posterior. Virada de dia e exceções por data, como recessos ou expediente reduzido, ficam fora desta etapa.

Feriados nacionais, estaduais e municipais aplicáveis excluem o dia inteiro dos cálculos que respeitam horas úteis. A checagem abrange as datas percorridas até completar o prazo, inclusive quando atravessa o ano. Se a consulta de feriados estiver indisponível, o cálculo pode usar somente a semana padrão; o vencimento assim calculado também é preservado.

Estado e município são obrigatórios para novos clientes e selecionados em listas. Clientes existentes precisam completar a localização antes de ativar o novo cálculo com feriados. Os períodos seguem o fuso local do cliente, sugerido pela localização e disponível para conferência, independentemente do fuso do usuário.

Na criação de cada ambiente, o horário do cliente deve ser replicado para ele, sem sincronização posterior. O admin do cliente edita o calendário pela administração do ambiente do cliente, sem acesso à área administrativa dos super admins; a edição vale somente para o ambiente em que foi feita.

Na implementação, o catálogo de estados e municípios usa o IBGE. A consulta de feriados usa o endpoint de cidade/ano da FeriadosAPI, que identifica o município pelo código IBGE, com a chave configurada no backend em `Holidays:FeriadosApiKey` (variável de ambiente `Holidays__FeriadosApiKey`). A cobertura municipal depende do plano contratado no provedor; esta alteração não cria conta nem contrata um plano. Sem chave ou sem resposta utilizável, aplica-se a semana padrão conforme a decisão acima. A documentação do provedor está em https://feriadosapi.com/en/docs.

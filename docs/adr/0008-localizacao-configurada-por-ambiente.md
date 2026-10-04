# Localização configurada no ambiente após o cadastro

O cadastro central de novos clientes cria produção e homologação sem exigir estado ou município. A localização começa em branco e é configurada pelo administrador no ambiente do cliente junto do horário de funcionamento, permitindo cadastrar o cliente sem antecipar sua configuração de calendário.

Esta decisão substitui a obrigatoriedade de localização no cadastro e o uso da localização do cliente previstos no ADR 0006. Os demais princípios de calendários independentes por ambiente e preservação de vencimentos já calculados continuam válidos. Processos somente podem ser iniciados após configurar estado, município, fuso e pelo menos um período válido de funcionamento, com aviso dessa condição no ambiente; a omissão não autoriza assumir uma cidade genérica nem iniciar processos usando uma semana padrão provisória.

Depois da configuração inicial, rejeitar alterações incompletas e manter a última configuração válida. Processos em andamento e vencimentos já calculados permanecem preservados. Preferimos uma condição explícita para iniciar processos e configurações sempre válidas à execução com localização provisória ou à interrupção de processos por campos apagados posteriormente.

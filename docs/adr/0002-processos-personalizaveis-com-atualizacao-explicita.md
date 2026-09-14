# Processos personalizáveis com atualização explícita

Processos do catálogo central são replicados para os ambientes e podem ser personalizados pelo cliente. Atualizações do catálogo são opcionais e explícitas, evitando que uma alteração central modifique automaticamente processos personalizados.

A promoção de homologação para produção e a sincronização inversa apresentam comparação antes da aplicação. Conflitos são informados ao usuário: confirmar permite que a origem sobrescreva os itens conflitantes selecionados e suas dependências, preservando a versão anterior; cancelar mantém o destino intacto. Essa escolha dá controle ao cliente e exige conservar versões para recuperação, em vez de manter os ambientes permanentemente sincronizados.

Execuções em andamento permanecem na versão em que começaram; novas versões valem para novas execuções. Isso preserva a continuidade dos processos existentes, ao custo de manter versões anteriores utilizáveis. Migração de execuções existentes fica para um fluxo posterior.

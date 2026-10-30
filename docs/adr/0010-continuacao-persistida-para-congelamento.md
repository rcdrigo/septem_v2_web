# Continuação persistida para congelamento

O congelamento completo exige retomar a requisição do mesmo ponto após o descongelamento ou reinício do servidor. O motor persiste as etapas pendentes, as chegadas às conexões dos gateways paralelos e os tempos restantes dos prazos, em vez de conservar a continuação apenas na pilha de chamadas.

Uma regra que congela a própria requisição preserva seus sucessores sem executar novamente o congelamento. Uma intenção de congelamento persistida separadamente permite que uma chamada externa já disparada termine e que o motor suspenda os passos seguintes, mesmo quando a ação manual aguarda a transação em execução. Essa persistência acrescenta estado ao motor, mas evita perder ramos paralelos ou repetir etapas na retomada.

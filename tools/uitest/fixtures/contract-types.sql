SELECT MESES.MES
FROM (
SELECT 1 AS ORDEM, 'Novo contrato' AS MES
UNION
SELECT 2 AS ORDEM, 'Contrato Corporativo' AS MES
UNION
SELECT 3 AS ORDEM, 'Contrato de Empenho' AS MES
UNION
SELECT 4 AS ORDEM, 'Nova Ata de Registro de Preços' AS MES
UNION
SELECT 5 AS ORDEM, 'Cessão de Saldos de ARP' AS MES
UNION
SELECT 6 AS ORDEM, 'Cessão de Saldos de Contrato Corporativo' AS MES
UNION
SELECT 7 AS ORDEM, 'Novo Contrato de Gestão' AS MES
UNION
SELECT 8 AS ORDEM, 'Termo de Fomento' AS MES
UNION
SELECT 9 AS ORDEM, 'Termo de Colaboração' AS MES
UNION
SELECT 10 AS ORDEM, 'Termo de Cooperação Técnica' AS MES
UNION
SELECT 11 AS ORDEM, 'Termo de Cessão de Servidor' AS MES
UNION
SELECT 12 AS ORDEM, 'Termo de Permuta' AS MES
UNION
SELECT 13 AS ORDEM, 'Convênio' AS MES
UNION
SELECT 14 AS ORDEM, 'Termo Aditivo' AS MES
UNION
SELECT 15 AS ORDEM, 'Apostilamento' AS MES
UNION
SELECT 16 AS ORDEM, 'Rerratificação' AS MES
UNION
SELECT 17 AS ORDEM, 'Rescisão' AS MES
) MESES
ORDER BY MESES.ORDEM&#x20;

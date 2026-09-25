# Conversão preservando registros antigos

Em 23/09/2026, o usuário substituiu a decisão de reiniciar o ambiente pela conversão dos formulários antigos para a estrutura nativa. Esta decisão substitui o descarte previsto no ADR 0004: requisições, respostas, versões, vínculos, histórico e anexos devem ser preservados. A migração converte a representação da definição na versão existente; não transfere a requisição para uma nova versão do processo.

A execução será manual, com inventário, backup e transação. Estruturas sem correspondência segura bloqueiam o lote para revisão, em vez de renomear chaves ou descartar respostas automaticamente. Preservar scripts e referências exige verificar seu comportamento no novo runtime, especialmente quando inspecionam diretamente a árvore antiga. O [procedimento de migração](../specs/formularios-nativos-migracao.md) registra o suporte e os limites implementados.

# Conversão manual de formulários antigos

Em 23/09/2026, o usuário substituiu a limpeza por conversão com preservação dos registros. O comando antigo de limpeza foi desativado. Nenhum banco operacional foi alterado.

## Como executar

Com aplicação e workers parados, configure a conexão PostgreSQL (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` e `.pgpass`, ou `PGSERVICE`) para o **banco do ambiente**, não o master. São necessários Python 3, `psql` e `pg_dump` no PATH.

Na pasta do frontend, gere um plano somente leitura em diretório novo:

```sh
python3 tools/maintenance/migrate-native-forms.py plan --output /caminho/privado/migracao-formularios
```

Confira o banco, os snapshots convertíveis e a lista `blocked`. O plano contém definições e respostas; mantenha-o privado. Havendo bloqueios, nenhuma conversão do lote será aplicada. Não edite o plano para ignorá-los: resolva o caso na origem ou estenda a conversão com testes e gere outro plano.

Após conferir um plano sem bloqueios:

```sh
python3 tools/maintenance/migrate-native-forms.py apply --plan /caminho/privado/migracao-formularios/plan.json
```

O comando recalcula o plano e rejeita alterações no banco ou no arquivo. Exige digitar `CONVERTER nome_do_banco`, cria `before-migration.dump` e aplica as alterações em transação com bloqueio das tabelas. Divergências cancelam a transação. A conferência de preservação abrange o conteúdo das tabelas, não apenas suas contagens. Em bancos grandes, o inventário completo e os bloqueios exigem janela de manutenção.

## O que é convertido e preservado

- Snapshots legados em `flow_forms` e o formulário embutido nos BPMNs que os referenciam. Os IDs das linhas e os vínculos `FormId`/`FlowId`, versões e status permanecem iguais. Uma requisição V1 continua vinculada à mesma V1; não passa para a versão mais recente.
- Grupos superiores tornam-se agrupamentos em abas nativas. Campos soltos são colocados em um grupo Geral. Listas dinâmicas simples tornam-se tabelas. A ordem e IDs existentes de campos/grupos, chaves, tipos e configurações são preservados; wrappers novos recebem IDs determinísticos.
- Respostas não são filtradas, zeradas nem regravadas. Zero, falso, linhas vazias e referências a anexos são preservados. O plano bloqueia respostas cujas chaves seriam descartadas em um salvamento nativo posterior.
- Tarefas, histórico, projeções de respostas, documentos, assinaturas, automações, usuários e demais cadastros permanecem intactos. Os objetos no storage não são movidos nem excluídos.
- O catálogo independente `forms` e suas revisões antigas são preservados como arquivo histórico; este comando converte os snapshots de processos, não transforma itens de catálogo em novos processos.

## Casos que exigem revisão

Listas/grupos aninhados, apresentações dentro de tabelas, tipos sem equivalente, chaves repetidas/inválidas, grupos com chave, configurações de raiz desconhecidas, snapshots compartilhados entre processos diferentes, deduplicação que colidiria com outro snapshot, divergência entre BPMN e snapshot e respostas sem campo definido interrompem o lote. Renomear chaves automaticamente poderia quebrar scripts, relatórios e referências; a ferramenta não tenta adivinhar o mapeamento.

Scripts são preservados como texto. Código que inspeciona diretamente a árvore antiga pode precisar de adaptação mesmo quando as chaves continuam iguais. Antes de reabrir o acesso, confira automações, matriz, fontes, anexos, relatórios e documentos, além de abrir/salvar/concluir requisições de versões antigas e criar uma nova. A preservação dos registros não comprova compatibilidade comportamental de todo JavaScript livre.

## Recuperação

Mantenha aplicação e workers parados. Restaure `before-migration.dump` com `pg_restore` em um banco vazio, confira-o e aponte o ambiente para ele. Não reexecute o SQL antigo de limpeza. O backup preserva o estado anterior à conversão; a migração não altera o storage.

## Verificação do desenvolvimento

`npm run test:native-migration` passou (contrato TypeScript e quatro testes Python). `native-migration-postgres.py` passou no schema real copiado para um banco descartável: 8 snapshots convertidos, 6 requisições preservadas, demais tabelas intactas, rollback de plano desatualizado e reexecução sem novas conversões. O fluxo CLI com confirmação interativa e backup também foi exercitado nessa cópia. Esses testes não substituem a validação das automações e documentos específicos do ambiente escolhido.

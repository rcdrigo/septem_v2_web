# Limpeza manual para formulários nativos

A execução fica a cargo do operador, no ambiente que ele escolher. Nenhum ambiente operacional foi limpo durante o desenvolvimento. O comando precisa de Python 3, `psql` e `pg_dump` no PATH e acesso ao **banco do ambiente**, nunca ao banco master da plataforma.

## Executar

Pare a aplicação e seus workers antes de gerar o plano definitivo. Configure a conexão como já faz para usar `psql`: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` e senha em `.pgpass`, ou um serviço `PGSERVICE`. Não escreva a senha nos comandos ou no plano.

Na pasta do frontend:

```sh
python3 tools/maintenance/reset-native-forms.py plan --output /caminho/privado/limpeza-formularios
```

O comando só consulta. Ele exibe o banco, servidor, usuário, contagens por tabela, versões de processos com formulário antigo e cadastros preservados. Leia o inventário antes de continuar. O diretório precisa ser novo e ficará privado: `plan.json` contém respostas e XML para conferência de anexos e referências.

Se houver histórico de geração de documentos, o comando para e informa a quantidade. Esses registros não possuem uma ligação confiável com a requisição; para incluir **todo esse histórico de geração** no lote, sem excluir os modelos, repita em outro diretório com `--include-document-history`. Se precisar preservá-lo, não use essa opção: revise os payloads e a política de retenção antes do reinício.

Depois de conferir o plano:

```sh
python3 tools/maintenance/reset-native-forms.py apply --plan /caminho/privado/limpeza-formularios/plan.json
```

O comando confere novamente o alvo e o inventário, pede que você digite `LIMPAR nome_do_banco`, cria `before-reset.dump` com `pg_dump` e executa a limpeza em uma transação. Se houver alteração desde o plano, erro de dependência ou divergência de contagem, a operação é interrompida. Não usa `TRUNCATE CASCADE` nem desabilita constraints.

Ao final, `result.json` registra as contagens e `applied.sql` registra as operações. Para restaurar, mantenha a aplicação parada e use `pg_restore` sobre um banco vazio a partir de `before-reset.dump`, apontando o ambiente para esse banco após a conferência. Arquivos no storage precisam de backup próprio.

## Escopo

- Todas as requisições do banco, inclusive simulações e exclusões lógicas, com tarefas, respostas/projeções, ações, mensagens, menções, entregas, histórico de campos, alertas, vínculos/eventos de tags, assinaturas e códigos de documentos.
- Catálogo antigo `forms`, seus grupos/campos e os scripts/revisões/testes antigos associados. As máscaras são preservadas.
- Formulários antigos de `flow_forms`: versões de processo que os utilizam recebem uma definição nativa vazia e ficam em rascunho. A identidade do formulário novo é compartilhada entre versões do mesmo processo.
- O histórico de geração de documentos só entra com a opção explícita descrita acima.

São preservados processos/BPMN, formulários já nativos, usuários, credenciais, unidades, perfis, categorias, máscaras, fontes, conexões, modelos de documento, catálogo de tags e automações novas por processo. Logs gerais de auditoria não são apagados; sua retenção exige decisão própria, pois também contêm eventos de cadastros fora deste lote.

## Depois da limpeza

1. Abra cada processo afetado, monte seu formulário nativo e corrija referências em tarefas, saídas, fontes, documentos, consultas e automações. As referências declarativas no BPMN foram preservadas para orientar essa correção; a publicação valida os usos conhecidos, e não deve ser feita automaticamente pelo SQL.
2. Revise relatórios e modelos compartilhados, que não pertencem exclusivamente às requisições removidas.
3. Use as URLs guardadas em `plan.json` para inventariar anexos no storage. Exclua manualmente apenas os objetos sem outras referências, no tenant/prefixo correto. O comando não apaga arquivos nem buckets, e não presume que a pasta inteira contém somente anexos dessas requisições.
4. Publique um processo e verifique criar → preencher grupo/tabela → salvar → reabrir → concluir tarefa. Teste a automação nas versões disponíveis na prévia.

A ferramenta foi testada contra PostgreSQL em uma cópia descartável de um banco de integração. Isso verifica o procedimento de banco, não substitui a conferência do ambiente e do storage escolhidos pelo operador.

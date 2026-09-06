# Correções implementadas

As correções abrangem o frontend `septem_v2_web` e o backend irmão `septem_v2`.

- **F01/F02:** removido o fallback global do formulário; o editor aguarda o XML do processo, invalida cargas antigas, serializa importações e bloqueia a persistência em caso de erro. A importação por planilha agora é aguardada antes de anunciar sucesso.
- **F03:** validação de data/hora usa precisão de minuto no calendário, cliente e servidor. Atualizar a restrição também atualiza a validade visual do campo.
- **F04/F05/F06:** validação recursiva de listas, anexos obrigatórios e regras de texto/número/máscara/data/hora. Os erros usam caminhos por linha (`itens.0.data`). O servidor valida o schema efetivo da tarefa e mescla os dados recebidos com os já persistidos. A matriz de visibilidade é compartilhada entre API e motor de execução.
- **F07/F08:** eventos leem o novo valor de forma síncrona e usam o escopo correto das listas, inclusive aninhadas. Campos desabilitados por eventos são ignorados pela validação do cliente. A validação do servidor permanece baseada nas regras e na visibilidade da definição; ações JavaScript do navegador não são executadas no servidor.
- **F09:** checklist e tags passam a permitir múltiplas escolhas e salvar arrays; HTML e imagens passam a ser renderizados. HTML é filtrado para remover scripts e atributos ativos. Tabelas foram retiradas da paleta até haver renderização compatível; tabelas já importadas exibem uma mensagem explícita de indisponibilidade.
- **F10:** formulários são remontados ao trocar tarefa, processo ou produção/homologação. Refetch da mesma identidade preserva a edição em andamento. No relatório, entrar/sair da edição reinicia o formulário a partir dos dados da instância.
- **F11/F12:** o selo usa o status devolvido pela publicação. Exportar BPMN aguarda o mesmo flush do formulário usado ao salvar.
- A exclusão de uma linha preserva a identidade das demais e reindexa erros/estado. O contador de obrigatórios usa a validação recursiva, incluindo campos somente-leitura e ocultos.

## Verificação

- `npm run build`: compilação TypeScript e build Vite de produção.
- `node tools/uitest/form-regressions.mjs`: cenários de comportamento em 1280 e 375 px, com componentes reais e API simulada.
- `node tools/uitest/form-editor-regressions.mjs`: isolamento de cache, prontidão, tipos/restrições de data, flush imediato, concorrência e falha de importação.
- Backend: `dotnet test tests/Septem.Integration.Tests/Septem.Integration.Tests.csproj --no-restore --filter FullyQualifiedName~FormValidatorTests`: 14 testes unitários, incluindo a compilação da API e infraestrutura.

Os testes de navegador não gravam na API real. Não foi realizado um ciclo completo de criação/publicação/conclusão contra um banco de aplicação. A restauração do backend emitiu avisos NuGet sobre dependências preexistentes; o Vite avisou sobre o tamanho do bundle.

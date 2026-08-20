import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { ModeladorPage } from './pages/modelador/ModeladorPage';
import { RelatorioBuilderPage } from './pages/relatorios/RelatorioBuilderPage';
import { ConsultaViewPage } from './pages/relatorios/ConsultaViewPage';
import { ProcessosPage } from './pages/processos/ProcessosPage';
import { UsuariosPage } from './pages/admin/UsuariosPage';
import { UnidadesPage } from './pages/admin/UnidadesPage';
import { UnidadePage } from './pages/UnidadePage';
import { PosicoesPage } from './pages/admin/PosicoesPage';
import { PerfisPage } from './pages/admin/PerfisPage';
import { LogsPage } from './pages/admin/LogsPage';
import { ParametrosPage } from './pages/admin/ParametrosPage';
import { MeuDadosPage } from './pages/admin/MeuDadosPage';
import { OrganogramaPage } from './pages/OrganogramaPage';
import { TarefasPage } from './pages/TarefasPage';
import { InstanciasPage } from './pages/InstanciasPage';
import { ConsultasPage } from './pages/ConsultasPage';
import { RelatoriosPage } from './pages/admin/RelatoriosPage';
import { FontesDadosPage } from './pages/admin/FontesDadosPage';
import { ModelosEmailPage } from './pages/admin/ModelosEmailPage';
import { ManuaisPage } from './pages/admin/ManuaisPage';
import { ModelosDocumentoPage } from './pages/admin/ModelosDocumentoPage';
import { CamposServicoPage } from './pages/CamposServicoPage';
import { ManualTemplatesPage } from './pages/ManualTemplatesPage';
import { ServicoFormPage } from './pages/ServicoFormPage';
import { TarefaPage } from './pages/TarefaPage';
import { SolicitacaoPage } from './pages/SolicitacaoPage';
import { GuidePage } from './pages/GuidePage';
import { FonteDadosPage } from './pages/FonteDadosPage';
import { ManualEditorPage } from './pages/ManualEditorPage';
import { StubPage } from './pages/StubPage';
import { SearchX } from 'lucide-react';
import { childPath, routes } from './lib/routes';

/** Açúcar para registrar uma rota que ainda só tem placeholder. */
function stub(path: string, title: string, opts?: { phase?: string; hint?: string }): RouteObject {
  return { path, element: <StubPage title={title} phase={opts?.phase} hint={opts?.hint} /> };
}

export const router = createBrowserRouter(
  [
    { path: routes.login, element: <LoginPage /> },
    // Guide público (Fase 10) — fora do AppShell, acessível deslogado.
    { path: routes.guide, element: <GuidePage /> },
    // Aba limpa (sem menus) para preencher e iniciar um serviço.
    { path: '/services/:processKey', element: <ServicoFormPage /> },
    // Tarefa pendente em aba própria (sem menus), como a de início.
    { path: '/tasks/:taskId', element: <TarefaPage /> },
    // Relatório/acompanhamento da solicitação em aba própria (sem menus).
    { path: '/requests/:instanceId', element: <SolicitacaoPage /> },
    // Criar/editar fonte de dados em aba própria (sem menus).
    { path: '/data-sources/:id', element: <FonteDadosPage /> },
    // Criar/editar manual em aba própria (sem menus) — como a fonte de dados.
    { path: '/manuals/:id', element: <ManualEditorPage /> },
    // Abrem em aba própria a partir do editor de modelos de documento (Fase 6e).
    { path: routes.serviceFields, element: <CamposServicoPage /> },
    { path: routes.manualTemplates, element: <ManualTemplatesPage /> },
    // Modelador em aba própria (sem menu lateral) — aberto via "Novo/Editar".
    { path: routes.flowEdit, element: <ModeladorPage /> },
    // Builder de relatórios em aba própria (Admin › Relatórios › Builder).
    { path: routes.reportEdit, element: <RelatorioBuilderPage /> },
    // Consulta (relatório publicado) em aba própria — aberta do catálogo (F7.1).
    { path: routes.reportView, element: <ConsultaViewPage /> },
    // Unidade organizacional em aba própria (Fase 3) — imprimível.
    { path: routes.orgUnit, element: <UnidadePage /> },
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to={routes.tasks} replace /> },

        // --- Geral ---------------------------------------------------------
        stub(childPath(routes.dashboard), 'Dashboard', { phase: 'Fase 7' }),
        { path: childPath(routes.tasks), element: <TarefasPage /> },
        { path: childPath(routes.requests), element: <InstanciasPage title="Requisições" lockMine initialStatus="em_andamento" /> },
        // /reports = catálogo de consultas (relatórios publicados) (req. 8).
        { path: childPath(routes.reports), element: <ConsultasPage /> },
        { path: childPath(routes.orgchart), element: <OrganogramaPage /> },

        // --- Admin › Processos --------------------------------------------
        { path: childPath(routes.adminFlows), element: <ProcessosPage /> },
        // Categorias de processos: geridas no modal da tela Admin › Processos.
        { path: childPath(routes.adminFlowCategories), element: <Navigate to={routes.adminFlows} replace /> },
        { path: childPath(routes.adminEmailTemplates), element: <ModelosEmailPage /> },
        { path: childPath(routes.adminDocumentTemplates), element: <ModelosDocumentoPage /> },
        { path: childPath(routes.adminDataSources), element: <FontesDadosPage /> },

        // --- Admin › Relatórios e Dashboards ------------------------------
        { path: childPath(routes.adminReports), element: <RelatoriosPage /> },
        // Categorias de relatórios: geridas no modal da tela Admin › Relatórios.
        { path: childPath(routes.adminReportCategories), element: <Navigate to={routes.adminReports} replace /> },
        stub(childPath(routes.adminDashboards), 'Dashboards', { phase: 'Fase 7' }),

        // --- Admin › Configurações ----------------------------------------
        { path: childPath(routes.adminSettings), element: <ParametrosPage /> },
        { path: childPath(routes.adminManuals), element: <ManuaisPage /> },
        { path: childPath(routes.adminUsers), element: <UsuariosPage /> },
        { path: childPath(routes.adminOrgUnits), element: <UnidadesPage /> },
        { path: childPath(routes.adminPositions), element: <PosicoesPage /> },
        { path: childPath(routes.adminProfiles), element: <PerfisPage /> },
        { path: childPath(routes.adminLogs), element: <LogsPage /> },

        // --- Conta / rodapé ------------------------------------------------
        { path: childPath(routes.me), element: <MeuDadosPage /> },
        stub(childPath(routes.support), 'Suporte', { phase: 'Fase 7' }),

        // Endereço inexistente (inclusive os antigos em português, descartados na
        // Fase 1): 404 com saída, não beco sem saída.
        {
          path: '*',
          element: (
            <StubPage
              title="Página não encontrada"
              icon={SearchX}
              hint="Os endereços do sistema mudaram para o inglês. Se você chegou por um link antigo, ele não vale mais."
              action={{ label: 'Ir para Tarefas pendentes', to: routes.tasks }}
            />
          ),
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

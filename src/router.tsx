import { createBrowserRouter, Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { ModeladorPage } from './pages/modelador/ModeladorPage';
import { RelatorioBuilderPage } from './pages/relatorios/RelatorioBuilderPage';
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
import { ServicosPage } from './pages/ServicosPage';
import { TarefasPage } from './pages/TarefasPage';
import { InstanciasPage } from './pages/InstanciasPage';
import { ConsultasPage } from './pages/ConsultasPage';
import { RelatoriosPage } from './pages/admin/RelatoriosPage';
import { FontesDadosPage } from './pages/admin/FontesDadosPage';
import { ModelosEmailPage } from './pages/admin/ModelosEmailPage';
import { ServicoFormPage } from './pages/ServicoFormPage';
import { TarefaPage } from './pages/TarefaPage';
import { SolicitacaoPage } from './pages/SolicitacaoPage';
import { FonteDadosPage } from './pages/FonteDadosPage';
import { StubPage } from './pages/StubPage';

/** Redirect que preserva a query string (ex.: /modelador?key=x → /processos/editar?key=x). */
function RedirectWithSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={to + search} replace />;
}

/** Açúcar para registrar uma rota que ainda só tem placeholder. */
function stub(path: string, title: string, opts?: { phase?: string; hint?: string }): RouteObject {
  return { path, element: <StubPage title={title} phase={opts?.phase} hint={opts?.hint} /> };
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    // Aba limpa (sem menus) para preencher e iniciar um serviço.
    { path: '/servico/:processKey', element: <ServicoFormPage /> },
    // Tarefa pendente em aba própria (sem menus), como a de início.
    { path: '/tarefa/:taskId', element: <TarefaPage /> },
    // Relatório/acompanhamento da solicitação em aba própria (sem menus).
    { path: '/solicitacao/:instanceId', element: <SolicitacaoPage /> },
    // Criar/editar fonte de dados em aba própria (sem menus).
    { path: '/fonte-dados/:id', element: <FonteDadosPage /> },
    // Modelador em aba própria (sem menu lateral) — aberto via "Novo/Editar".
    { path: '/processos/editar', element: <ModeladorPage /> },
    // Builder de relatórios em aba própria (Admin › Relatórios › Builder).
    { path: '/relatorios/editar', element: <RelatorioBuilderPage /> },
    // Unidade organizacional em aba própria (Fase 3) — imprimível.
    { path: '/unidade', element: <UnidadePage /> },
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/servicos" replace /> },

        // --- Geral ---------------------------------------------------------
        stub('dashboard', 'Dashboard', { phase: 'Fase 7' }),
        { path: 'servicos', element: <ServicosPage /> },
        { path: 'tarefas', element: <TarefasPage /> },
        { path: 'requisicoes', element: <InstanciasPage title="Requisições" lockMine initialStatus="em_andamento" /> },
        // Consultas = catálogo de relatórios publicados (req. 8).
        { path: 'consultas', element: <ConsultasPage /> },
        { path: 'organograma', element: <OrganogramaPage /> },

        // --- Admin › Processos --------------------------------------------
        { path: 'admin/processos', element: <ProcessosPage /> },
        // O modelador agora abre em aba própria (rota /processos/editar, fora do shell).
        { path: 'admin/processos/editar', element: <RedirectWithSearch to="/processos/editar" /> },
        // Categorias de processos: geridas no modal da tela Admin › Processos.
        { path: 'admin/processos/categorias', element: <Navigate to="/admin/processos" replace /> },
        { path: 'admin/modelos-email', element: <ModelosEmailPage /> },
        stub('admin/modelos-doc', 'Modelos de documentos', { phase: 'Fase 7' }),
        { path: 'admin/fontes-dados', element: <FontesDadosPage /> },

        // --- Admin › Relatórios e Dashboards ------------------------------
        { path: 'admin/relatorios', element: <RelatoriosPage /> },
        // Categorias de relatórios: geridas no modal da tela Admin › Relatórios.
        { path: 'admin/relatorios/categorias', element: <Navigate to="/admin/relatorios" replace /> },
        stub('admin/dashboards', 'Dashboards', { phase: 'Fase 7' }),

        // --- Admin › Configurações ----------------------------------------
        { path: 'admin/parametros', element: <ParametrosPage /> },
        stub('admin/manuais', 'Manuais', { phase: 'Fase 7' }),
        { path: 'admin/usuarios', element: <UsuariosPage /> },
        { path: 'admin/unidades', element: <UnidadesPage /> },
        { path: 'admin/posicoes', element: <PosicoesPage /> },
        { path: 'admin/perfis', element: <PerfisPage /> },
        { path: 'admin/logs', element: <LogsPage /> },

        // --- Conta / rodapé ------------------------------------------------
        { path: 'me', element: <MeuDadosPage /> },
        // Mudar senha virou MODAL dentro de Meus dados (Fase 2) — a rota antiga redireciona.
        { path: 'me/senha', element: <Navigate to="/me" replace /> },
        stub('suporte', 'Suporte', { phase: 'Fase 7' }),

        // Back-compat: a rota antiga /modelador agora abre o modelador standalone.
        { path: 'modelador', element: <RedirectWithSearch to="/processos/editar" /> },

        { path: '*', element: <StubPage title="Página não encontrada" hint="O endereço acessado não existe." /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

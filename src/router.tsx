import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { ModeladorPage } from './pages/modelador/ModeladorPage';
import { ProcessosPage } from './pages/processos/ProcessosPage';
import { UsuariosPage } from './pages/admin/UsuariosPage';
import { UnidadesPage } from './pages/admin/UnidadesPage';
import { PosicoesPage } from './pages/admin/PosicoesPage';
import { PerfisPage } from './pages/admin/PerfisPage';
import { LogsPage } from './pages/admin/LogsPage';
import { MeuDadosPage } from './pages/admin/MeuDadosPage';
import { MudarSenhaPage } from './pages/admin/MudarSenhaPage';
import { OrganogramaPage } from './pages/OrganogramaPage';
import { ServicosPage } from './pages/ServicosPage';
import { TarefasPage } from './pages/TarefasPage';
import { InstanciasPage } from './pages/InstanciasPage';
import { ConsultasPage } from './pages/ConsultasPage';
import { TarefasExecutadasPage } from './pages/TarefasExecutadasPage';
import { RelatoriosPage } from './pages/admin/RelatoriosPage';
import { FontesDadosPage } from './pages/admin/FontesDadosPage';
import { ModelosEmailPage } from './pages/admin/ModelosEmailPage';
import { ServicoFormPage } from './pages/ServicoFormPage';
import { TarefaPage } from './pages/TarefaPage';
import { SolicitacaoPage } from './pages/SolicitacaoPage';
import { StubPage } from './pages/StubPage';

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
    // Modelador em aba própria (sem menu lateral) — aberto via "Novo/Editar".
    { path: '/processos/editar', element: <ModeladorPage /> },
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/servicos" replace /> },

        // --- Geral ---------------------------------------------------------
        stub('dashboard', 'Dashboard', { phase: 'Fase 7' }),
        { path: 'servicos', element: <ServicosPage /> },
        // Tarefas pendentes = tarefas pendentes COM o usuário (inbox do executor).
        { path: 'tarefas', element: <TarefasPage /> },
        // Tarefas executadas = tarefas que o usuário concluiu (não estão mais com ele).
        { path: 'tarefas-executadas', element: <TarefasExecutadasPage /> },
        // Minhas solicitações (cidadão) = instâncias que o usuário iniciou, em andamento.
        { path: 'minhas-solicitacoes', element: <InstanciasPage title="Minhas solicitações" lockMine initialStatus="em_andamento" /> },
        // Consultas = catálogo de relatórios publicados (req. 8).
        { path: 'consultas', element: <ConsultasPage /> },
        { path: 'organograma', element: <OrganogramaPage /> },

        // --- Admin › Processos --------------------------------------------
        { path: 'admin/processos', element: <ProcessosPage /> },
        // O modelador agora abre em aba própria (rota /processos/editar, fora do shell).
        { path: 'admin/processos/editar', element: <Navigate to="/processos/editar" replace /> },
        stub('admin/processos/categorias', 'Categorias de processos', { phase: 'Fase 3' }),
        { path: 'admin/modelos-email', element: <ModelosEmailPage /> },
        stub('admin/modelos-doc', 'Modelos de documentos', { phase: 'Fase 7' }),
        { path: 'admin/fontes-dados', element: <FontesDadosPage /> },

        // --- Admin › Relatórios e Dashboards ------------------------------
        { path: 'admin/relatorios', element: <RelatoriosPage /> },
        stub('admin/relatorios/categorias', 'Categorias de relatórios', { phase: 'Fase 7' }),
        stub('admin/dashboards', 'Dashboards', { phase: 'Fase 7' }),

        // --- Admin › Configurações ----------------------------------------
        stub('admin/manuais', 'Manuais', { phase: 'Fase 7' }),
        { path: 'admin/usuarios', element: <UsuariosPage /> },
        { path: 'admin/unidades', element: <UnidadesPage /> },
        { path: 'admin/posicoes', element: <PosicoesPage /> },
        { path: 'admin/perfis', element: <PerfisPage /> },
        { path: 'admin/logs', element: <LogsPage /> },

        // --- Conta / rodapé ------------------------------------------------
        { path: 'me', element: <MeuDadosPage /> },
        { path: 'me/senha', element: <MudarSenhaPage /> },
        stub('suporte', 'Suporte', { phase: 'Fase 7' }),

        // Back-compat: a rota antiga /modelador agora abre o modelador standalone.
        { path: 'modelador', element: <Navigate to="/processos/editar" replace /> },

        { path: '*', element: <StubPage title="Página não encontrada" hint="O endereço acessado não existe." /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

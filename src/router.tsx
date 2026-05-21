import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { ModeladorPage } from './pages/modelador/ModeladorPage';
import { ProcessosPage } from './pages/processos/ProcessosPage';
import { StubPage } from './pages/StubPage';

/** Açúcar para registrar uma rota que ainda só tem placeholder. */
function stub(path: string, title: string, opts?: { phase?: string; hint?: string }): RouteObject {
  return { path, element: <StubPage title={title} phase={opts?.phase} hint={opts?.hint} /> };
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/servicos" replace /> },

        // --- Geral ---------------------------------------------------------
        stub('dashboard', 'Dashboard', { phase: 'Fase 7' }),
        stub('servicos', 'Serviços', { phase: 'Fase 3/4', hint: 'Catálogo de processos publicados que você pode iniciar.' }),
        stub('tarefas', 'Tarefas executadas', { phase: 'Fase 4', hint: 'Processos que você iniciou ou dos quais participou.' }),
        stub('consultas', 'Consultas', { phase: 'Fase 7' }),
        stub('organograma', 'Organograma', { phase: 'Fase 2/5' }),

        // --- Admin › Processos --------------------------------------------
        { path: 'admin/processos', element: <ProcessosPage /> },
        // Modelador (BPMN + form) — vive dentro de Processos, aberto via "Novo/Editar".
        { path: 'admin/processos/editar', element: <ModeladorPage /> },
        stub('admin/processos/categorias', 'Categorias de processos', { phase: 'Fase 3' }),
        stub('admin/modelos-email', 'Modelos de e-mails', { phase: 'Fase 3/4' }),
        stub('admin/modelos-doc', 'Modelos de documentos', { phase: 'Fase 7' }),
        stub('admin/fontes-dados', 'Fontes de dados', { phase: 'Fase 3/4' }),

        // --- Admin › Relatórios e Dashboards ------------------------------
        stub('admin/relatorios', 'Relatórios', { phase: 'Fase 7' }),
        stub('admin/relatorios/categorias', 'Categorias de relatórios', { phase: 'Fase 7' }),
        stub('admin/dashboards', 'Dashboards', { phase: 'Fase 7' }),

        // --- Admin › Configurações ----------------------------------------
        stub('admin/manuais', 'Manuais', { phase: 'Fase 7' }),
        stub('admin/usuarios', 'Usuários', { phase: 'Fase 2' }),
        stub('admin/unidades', 'Unidades organizacionais', { phase: 'Fase 2' }),
        stub('admin/posicoes', 'Posições', { phase: 'Fase 2' }),
        stub('admin/perfis', 'Perfis de acesso', { phase: 'Fase 2' }),
        stub('admin/logs', 'Logs', { phase: 'Fase 2/9' }),

        // --- Conta / rodapé ------------------------------------------------
        stub('me', 'Meus dados', { phase: 'Fase 2' }),
        stub('me/senha', 'Mudar senha', { phase: 'Fase 2' }),
        stub('suporte', 'Suporte', { phase: 'Fase 7' }),

        // Back-compat: a rota antiga /modelador agora vive em /admin/processos/editar.
        { path: 'modelador', element: <Navigate to="/admin/processos/editar" replace /> },

        { path: '*', element: <StubPage title="Página não encontrada" hint="O endereço acessado não existe." /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

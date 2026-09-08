import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Building2,
  Database,
  FileSearch,
  FileStack,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Mail,
  Network,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  Workflow,
} from 'lucide-react';
import type { MenuByMode } from './types';
import { routes } from '@/lib/routes';

/**
 * Fonte única da árvore de navegação. Cada `perm` será resolvido contra
 * `session.can(...)` na renderização — hoje o mock libera tudo (`*`).
 *
 * As rotas aqui DEVEM existir no router (src/router.tsx). Itens sem backend
 * ainda apontam para páginas-stub; trocamos por páginas reais item a item.
 */
export const MENU: MenuByMode = {
  // --- Layout INTERNO (back-office completo) --------------------------------
  interno: {
    main: [
      {
        label: 'Geral',
        items: [
          {
            kind: 'link',
            label: 'Dashboard',
            to: routes.dashboard,
            icon: LayoutDashboard,
            visible: (s) => s.user?.hasDashboard ?? false,
          },
          { kind: 'link', label: 'Tarefas', to: routes.tasks, icon: Inbox, badge: 'pendingTasks' },
          { kind: 'link', label: 'Requisições', to: routes.requests, icon: ListChecks },
          { kind: 'link', label: 'Consultas', to: routes.reports, icon: FileSearch },
          { kind: 'link', label: 'Organograma', to: routes.orgchart, icon: Network },
        ],
      },
      {
        label: 'Admin',
        items: [
          {
            kind: 'group',
            label: 'Processos',
            icon: Workflow,
            perm: 'workflow:read',
            children: [
              { kind: 'link', label: 'Processos', to: routes.adminFlows, icon: Workflow },
              // Categorias não têm mais página própria: modal "Categorias" em Admin › Processos.
              { kind: 'link', label: 'Modelos de e-mails', to: routes.adminEmailTemplates, icon: Mail },
              { kind: 'link', label: 'Modelos de documentos', to: routes.adminDocumentTemplates, icon: FileStack },
              { kind: 'link', label: 'Fontes de dados', to: routes.adminDataSources, icon: Database },
            ],
          },
          {
            kind: 'group',
            label: 'Relatórios e Dashboards',
            icon: BarChart3,
            perm: 'reports:read',
            children: [
              { kind: 'link', label: 'Relatórios', to: routes.adminReports, icon: FileSearch },
              // Categorias não têm mais página própria: modal "Categorias" em Admin › Relatórios.
              { kind: 'link', label: 'Dashboards', to: routes.adminDashboards, icon: BarChart3 },
              { kind: 'link', label: 'Fontes de dados', to: `${routes.adminDataSources}?scope=report`, icon: Database },
            ],
          },
          {
            kind: 'group',
            label: 'Configurações',
            icon: ShieldCheck,
            perm: 'admin:settings',
            children: [
              { kind: 'link', label: 'Parâmetros do sistema', to: routes.adminSettings, icon: SlidersHorizontal },
              { kind: 'link', label: 'Manuais', to: routes.adminManuals, icon: BookOpen },
              { kind: 'link', label: 'Usuários', to: routes.adminUsers, icon: Users },
              { kind: 'link', label: 'Unidades organizacionais', to: routes.adminOrgUnits, icon: Building2 },
              { kind: 'link', label: 'Posições', to: routes.adminPositions, icon: UserCog },
              { kind: 'link', label: 'Perfis de acesso', to: routes.adminProfiles, icon: ShieldCheck },
              { kind: 'link', label: 'Logs', to: routes.adminLogs, icon: ScrollText },
            ],
          },
        ],
      },
    ],
    footer: [
      { kind: 'action', label: 'Personificar', icon: ArrowLeftRight, action: 'impersonate', perm: 'users:impersonate' },
      { kind: 'link', label: 'Suporte', to: routes.support, icon: LifeBuoy },
      { kind: 'action', label: 'Sair', icon: LogOut, action: 'logout' },
    ],
  },

  // --- Layout EXTERNO (cidadão/requisitante, simplificado) ------------------
  externo: {
    main: [
      {
        items: [
          { kind: 'link', label: 'Tarefas', to: routes.tasks, icon: Inbox, badge: 'pendingTasks' },
          { kind: 'link', label: 'Requisições', to: routes.requests, icon: ListChecks },
          { kind: 'link', label: 'Organograma', to: routes.orgchart, icon: FolderTree },
        ],
      },
    ],
    footer: [
      { kind: 'link', label: 'Suporte', to: routes.support, icon: LifeBuoy },
      { kind: 'action', label: 'Sair', icon: LogOut, action: 'logout' },
    ],
  },
};

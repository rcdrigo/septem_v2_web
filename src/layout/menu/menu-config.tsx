import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  Database,
  FileSearch,
  FileStack,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  LogOut,
  Mail,
  Network,
  ScrollText,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  Workflow,
} from 'lucide-react';
import type { MenuByMode } from './types';

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
            to: '/dashboard',
            icon: LayoutDashboard,
            visible: (s) => s.user?.hasDashboard ?? false,
          },
          { kind: 'link', label: 'Serviços', to: '/servicos', icon: LayoutGrid },
          { kind: 'link', label: 'Tarefas pendentes', to: '/tarefas', icon: Inbox },
          { kind: 'link', label: 'Tarefas executadas', to: '/tarefas-executadas', icon: ClipboardCheck },
          { kind: 'link', label: 'Consultas', to: '/consultas', icon: FileSearch },
          { kind: 'link', label: 'Organograma', to: '/organograma', icon: Network },
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
              { kind: 'link', label: 'Processos', to: '/admin/processos', icon: Workflow },
              { kind: 'link', label: 'Categorias', to: '/admin/processos/categorias', icon: Tags },
              { kind: 'link', label: 'Modelos de e-mails', to: '/admin/modelos-email', icon: Mail },
              { kind: 'link', label: 'Modelos de documentos', to: '/admin/modelos-doc', icon: FileStack },
              { kind: 'link', label: 'Fontes de dados', to: '/admin/fontes-dados', icon: Database },
            ],
          },
          {
            kind: 'group',
            label: 'Relatórios e Dashboards',
            icon: BarChart3,
            perm: 'reports:read',
            children: [
              { kind: 'link', label: 'Relatórios', to: '/admin/relatorios', icon: FileSearch },
              { kind: 'link', label: 'Categorias', to: '/admin/relatorios/categorias', icon: Tags },
              { kind: 'link', label: 'Dashboards', to: '/admin/dashboards', icon: BarChart3 },
              { kind: 'link', label: 'Fontes de dados', to: '/admin/fontes-dados?scope=report', icon: Database },
            ],
          },
          {
            kind: 'group',
            label: 'Configurações',
            icon: ShieldCheck,
            perm: 'admin:settings',
            children: [
              { kind: 'link', label: 'Manuais', to: '/admin/manuais', icon: BookOpen },
              { kind: 'link', label: 'Usuários', to: '/admin/usuarios', icon: Users },
              { kind: 'link', label: 'Unidades organizacionais', to: '/admin/unidades', icon: Building2 },
              { kind: 'link', label: 'Posições', to: '/admin/posicoes', icon: UserCog },
              { kind: 'link', label: 'Perfis de acesso', to: '/admin/perfis', icon: ShieldCheck },
              { kind: 'link', label: 'Logs', to: '/admin/logs', icon: ScrollText },
            ],
          },
        ],
      },
    ],
    footer: [
      { kind: 'action', label: 'Personificar', icon: ArrowLeftRight, action: 'impersonate', perm: 'users:impersonate' },
      { kind: 'link', label: 'Suporte', to: '/suporte', icon: LifeBuoy },
      { kind: 'action', label: 'Sair', icon: LogOut, action: 'logout' },
    ],
  },

  // --- Layout EXTERNO (cidadão/requisitante, simplificado) ------------------
  externo: {
    main: [
      {
        items: [
          { kind: 'link', label: 'Serviços', to: '/servicos', icon: LayoutGrid },
          { kind: 'link', label: 'Minhas solicitações', to: '/minhas-solicitacoes', icon: ListChecks },
          { kind: 'link', label: 'Organograma', to: '/organograma', icon: FolderTree },
        ],
      },
    ],
    footer: [
      { kind: 'link', label: 'Suporte', to: '/suporte', icon: LifeBuoy },
      { kind: 'action', label: 'Sair', icon: LogOut, action: 'logout' },
    ],
  },
};

/**
 * Mapa único das rotas do SPA (Fase 1 — requisitos 2026-08-03).
 *
 * Toda rota do sistema mora aqui. Nada de `navigate('/tasks/123')` espalhado:
 * a próxima renomeação precisa mexer em UM arquivo, não caçar string em 60.
 *
 * ⚠️ Estes são os endereços que o USUÁRIO vê no navegador. Os endpoints da API
 * (`/api/v1/...`) já nasceram em inglês e NÃO passam por aqui.
 *
 * Decisão do dono (resposta 1, 2026-08-16): os endereços antigos em português
 * foram **descartados**, sem camada de redirect. Link antigo cai no 404, que por
 * isso precisa ser acionável (ver `StubPage` na rota curinga).
 */

export const routes = {
  // --- Fora do shell (abas próprias, sem menu) -------------------------------
  login: '/login',
  /** Guia público — acessível deslogado. */
  guide: '/guide',
  /** Formulário de um serviço, para iniciar uma requisição. */
  service: (processKey: string) => `/services/${processKey}`,
  /** Tarefa pendente em aba própria. */
  task: (taskId: string) => `/tasks/${taskId}`,
  /** Relatório/acompanhamento de uma requisição. */
  request: (instanceId: string) => `/requests/${instanceId}`,
  /** Criar/editar fonte de dados (`id = 'nova'` para criar). */
  dataSource: (id: string) => `/data-sources/${id}`,
  /** Criar/editar manual (`id = 'nova'` para criar). */
  manual: (id: string) => `/manuals/${id}`,
  serviceFields: '/service-fields',
  manualTemplates: '/manual-templates',
  /** Modelador de processos (BPMN) — aba própria. */
  flowEdit: '/flows/edit',
  /** Builder de relatórios — aba própria. */
  reportEdit: '/reports/edit',
  /** Consulta publicada (visualização) — aba própria. */
  reportView: '/reports/view',
  /** Unidade organizacional (imprimível) — aba própria. */
  orgUnit: '/org-unit',

  // --- Dentro do shell ------------------------------------------------------
  dashboard: '/dashboard',
  tasks: '/tasks',
  requests: '/requests',
  /** Catálogo de consultas (relatórios publicados). */
  reports: '/reports',
  orgchart: '/orgchart',
  support: '/support',
  me: '/me',

  // --- Admin ----------------------------------------------------------------
  adminFlows: '/admin/flows',
  adminFlowCategories: '/admin/flows/categories',
  adminEmailTemplates: '/admin/email-templates',
  adminDocumentTemplates: '/admin/document-templates',
  adminDataSources: '/admin/data-sources',
  adminReports: '/admin/reports',
  adminReportCategories: '/admin/reports/categories',
  adminDashboards: '/admin/dashboards',
  adminSettings: '/admin/settings',
  adminManuals: '/admin/manuals',
  adminUsers: '/admin/users',
  adminOrgUnits: '/admin/org-units',
  adminPositions: '/admin/positions',
  adminProfiles: '/admin/profiles',
  adminLogs: '/admin/logs',
} as const;

/**
 * Caminhos relativos usados no `children` do router (sem a barra inicial).
 * Derivados das constantes acima para não existir uma segunda fonte da verdade.
 */
export const childPath = (route: string) => route.replace(/^\//, '');
